<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Iterator/index.vue
 * @description 取極め情報表示用データイテレーターコンポーネント
 * @author shisyamo4131
 *
 * @property {Array} agreements - 表示する取極め情報の配列
 * @property {Number} itemsPerPage - 1ページあたりのアイテム数
 * @property {String} shiftType - 勤務区分のフィルタリング条件（"ALL" | Agreement.SHIFT_TYPE のいずれか）
 * @property {Boolean} showEdit - 編集機能の表示有無
 * @property {Boolean} showExpand - 展開機能の表示有無
 * @property {Boolean} showSelect - 選択機能の表示有無
 * @property {Boolean} useAll - 勤務区分フィルタに "ALL" オプションを表示するかどうか
 *
 * @emits click:edit - 編集ボタンがクリックされたときに発火するイベント。引数は編集対象の取極め情報オブジェクト。
 *
 * @slot header - ヘッダーコンテンツを挿入するためのスロット。
 *  @property {Array} agreements - 現在表示されている取極め情報の配列
 *  @property {String} shiftType - 現在選択されている勤務区分
 *  @property {Function} setShiftType - 勤務区分を選択するための関数
 *  @property {Object} components - ヘッダーで使用するコンポーネントのプロパティオブジェクト
 *   @property {Object} shiftTypeGroup - 勤務区分選択コンポーネント用のプロパティオブジェクト
 *
 * @slot default - 取極めオブジェクト群を表示するためのスロット。
 *  @property {Array} agreements - 現在表示されている取極め情報の配列
 *  @property {Function} isSelected - アイテムが選択されているかどうかを判定する関数
 *  @property {Function} select - アイテムを選択・非選択するための関数
 *
 * @slot item - 各取極め情報アイテムの表示をカスタマイズするためのスロット。スロットプロパティには、取極め情報オブジェクト、選択状態、編集・展開・選択機能の表示有無などが含まれます。
 *  @property {Object} agreement - アイテムに対応する取極め情報オブジェクト
 *  @property {Boolean} isSelected - アイテムが選択されているかどうか
 *  @property {Boolean} showEdit - 編集機能の表示有無
 *  @property {Boolean} showExpand - 展開機能の表示有無
 *  @property {Boolean} showSelect - 選択機能の表示有無
 *  @property {Function} onClick:edit - 編集ボタンがクリックされたときのイベントハンドラー
 *  @property {Function} onClick:select - アイテムが選択されたときのイベントハンドラー
 *
 * @slot footer - フッターコンテンツを挿入するためのスロット。
 *  @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-footer
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex.js";
import { Agreement } from "@/schemas";

defineOptions({ name: "AgreementsIterator" });

/** SETUP PROPS & EMITS */
const _props = defineProps({
  agreements: { type: Array, default: () => [] },
  itemsPerPage: { type: Number, default: 5 },
  shiftType: {
    type: String,
    default: "DAY",
    validator: (value) =>
      ["ALL", ...Object.keys(Agreement.SHIFT_TYPE)].includes(value),
  },
  showEdit: { type: Boolean, default: false },
  showExpand: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false },
  useAll: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementsIterator");
const emit = defineEmits(["click:edit", "update:shift-type"]);

/** SETUP COMPOSABLES */
const { agreements, shiftType, length, setShiftType } = useIndex(props, emit);

/** EXPOSE */
defineExpose({
  agreements,
  shiftType,
  length,
  setShiftType,
});
</script>

<template>
  <v-data-iterator
    item-value="key"
    :items="agreements"
    :items-per-page="props.itemsPerPage"
    :select-strategy="props.selectStrategy"
    :show-expand="props.showExpand"
    :show-select="props.showSelect"
  >
    <!-- HEADER -->
    <template #header="slotProps">
      <!-- SLOT: header -->
      <!-- @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-header -->
      <slot name="header" v-bind="slotProps || {}">
        <v-toolbar class="bg-transparent" density="compact">
          <v-spacer />
          <div class="px-4">
            <ShiftTypeRadioGroup
              :model-value="shiftType"
              inline
              hide-details
              density="comfortable"
              :useAll="props.useAll"
              @update:model-value="setShiftType"
            />
          </div>
        </v-toolbar>
      </slot>
    </template>

    <!-- DEFAULT -->
    <template #default="{ items, isSelected, select }">
      <!-- SLOT: default -->
      <slot name="default" v-bind="{ items: agreements, isSelected, select }">
        <!-- grid container -->
        <div class="grid-container">
          <div v-for="item in items" :key="item.key">
            <!-- SLOT: item -->
            <slot
              name="item"
              v-bind="{
                agreement: item.raw,
                isSelected: isSelected([item]),
                showEdit: props.showEdit,
                showExpand: props.showExpand,
                showSelect: props.showSelect,
                'onClick:edit': () => emit('click:edit', item.raw),
                'onClick:select': () => select([item], !isSelected([item])),
              }"
            >
              <AgreementCard
                v-bind="{
                  agreement: item.raw,
                  isSelected: isSelected([item]),
                  showEdit: props.showEdit,
                  showExpand: props.showExpand,
                  showSelect: props.showSelect,
                  'onClick:edit': () => emit('click:edit', item.raw),
                  'onClick:select': () => select([item], !isSelected([item])),
                }"
              />
            </slot>
          </div>
        </div>
      </slot>
    </template>

    <!-- NO DATA -->
    <template #no-data>
      <v-card>
        <v-empty-state
          title="取極め情報はありません"
          icon="mdi-alert-circle-outline"
        >
          <template #text>
            <div>指定された条件に該当する取極め情報は登録されていません。</div>
          </template>
        </v-empty-state>
      </v-card>
    </template>

    <!-- FOOTER -->
    <template #footer="slotProps">
      <!-- SLOT: footer -->
      <!-- @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-footer -->
      <slot
        name="footer"
        v-if="props.itemsPerPage > -1"
        v-bind="slotProps || {}"
      >
        <MoleculesPagination
          v-bind="{ page: slotProps.page, pageCount: slotProps.pageCount }"
        />
      </slot>
    </template>
  </v-data-iterator>
</template>

<style scoped>
/* v-data-iterator 自体の設定 */
.v-data-iterator {
  display: flex; /* フレックスコンテナにして、子要素を縦に並べる */
  flex-direction: column;
  height: 100%; /* 高さを100%にして、親コンテナの高さを継承 */
  overflow-y: hidden; /* overflow-y: hidden を設定して、スクロールバーを非表示にする */
}

/* v-data-iterator は default スロットのルート要素に div を描画する */
/* これをスクロールコンテナとして使用する */
.v-data-iterator > :deep(div) {
  overflow-y: auto;
  flex-grow: 1; /* フレックスアイテムが利用可能なスペースを全て占有するようにする */
}

/* grid container の設定 */
.grid-container {
  display: grid;
  gap: 16px;
  /* 1列あたりの最小幅を252px、最大幅を利用可能なスペース全体に設定 */
  /* 最小幅は AgreementCard の min-width に合わせている */
  grid-template-columns: repeat(auto-fit, minmax(252px, 1fr));
}
</style>
