<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Iterator/index.vue
 * @description 取極め情報表示用データイテレーターコンポーネント
 * - `useExtendDataIterator` を使用して v-data-iterator を拡張しています。
 * - `update:modelValue` イベントのペイロードは、`selectStrategy` に応じて、単一の値、配列、またはオブジェクトになります。
 *
 * @author shisyamo4131
 *
 * @property {Array} agreements - 表示する取極め情報の配列
 * @property {Boolean} hideDefaultFooter - デフォルトのフッターを非表示にするかどうかを指定するプロパティ
 * @property {Object|Array|String|Number} modelValue - 選択されたアイテムの値。selectStrategy に応じて、単一の値、配列、またはオブジェクトになる。
 * @property {String} shiftType - 勤務区分のフィルタリング条件（"ALL" | Agreement.SHIFT_TYPE のいずれか）
 * @property {Boolean} showCreate - 新規登録機能の表示有無
 * @property {Boolean} showEdit - 編集機能の表示有無
 * @property {Boolean} useAll - 勤務区分フィルタに "ALL" オプションを表示するかどうか
 *
 * - その他、v-data-iterator に実装されているすべてのプロパティが使用可能です。
 * @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#props
 *
 * @emits click:create - 新規登録ボタンがクリックされたときに発火するイベント。
 * @emits click:edit - 編集ボタンがクリックされたときに発火するイベント。引数は編集対象の取極め情報オブジェクト。
 * @emits update:modelValue - 選択されたアイテムが変更されたときに発火するイベント。引数は selectStrategy に応じた形式の選択された値。
 * @emits update:shift-type - 勤務区分が変更されたときに発火するイベント。引数は新しい勤務区分の値。
 *
 * @slot header - ヘッダーコンテンツを挿入するためのスロット。
 *  @property {Array} agreements - 現在表示されている取極め情報の配列
 *  @property {String} shiftType - 現在選択されている勤務区分
 *  @property {Function} setShiftType - 勤務区分を選択するための関数
 *  @property {Boolean} useAll - 勤務区分フィルタに "ALL" オプションを表示するかどうか
 *  - その他、v-data-iterator の header スロットで提供されるプロパティも使用可能です。
 *  @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#slots-header
 *
 * @slot default - 取極めオブジェクト群を表示するためのスロット。
 *  @property {Array} agreements - 現在表示されている取極め情報の配列
 *  @property {String} shiftType - 現在選択されている勤務区分
 *  @property {Function} setShiftType - 勤務区分を選択するための関数
 *  @property {Boolean} useAll - 勤務区分フィルタに "ALL" オプションを表示するかどうか
 *  @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#slots-default
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
 *  @property {Array} agreements - 現在表示されている取極め情報の配列
 *  @property {String} shiftType - 現在選択されている勤務区分
 *  @property {Function} setShiftType - 勤務区分を選択するための関数
 *  @property {Boolean} useAll - 勤務区分フィルタに "ALL" オプションを表示するかどうか
 *  @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-footer
 *
 * @expose agreements - 現在表示されている取極め情報の配列
 * @expose shiftType - 現在選択されている勤務区分
 * @expose setShiftType - 勤務区分を選択するための関数
 *****************************************************************************/
import {
  props as compProps,
  emit as compEmit,
  useExtendDataIterator,
} from "@/composables/extends/useExtendDataIterator.js";
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex.js";
import { Agreement } from "@/schemas";

defineOptions({ name: "AgreementsIterator" });

/** SETUP PROPS & EMITS */
const _props = defineProps({
  ...compProps,
  agreements: { type: Array, default: () => [] },
  shiftType: {
    type: String,
    default: "DAY",
    validator: (value) =>
      ["ALL", ...Object.keys(Agreement.SHIFT_TYPE)].includes(value),
  },
  showCreate: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  showExpand: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false },
  useAll: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementsIterator");
const emit = defineEmits([
  ...compEmit,
  "click:create",
  "click:edit",
  "update:shift-type",
]);

/** SETUP COMPOSABLES */
const { attrs } = useExtendDataIterator(props, emit);
const { agreements, shiftType, setShiftType } = useIndex(props, emit);

/** EXPOSE */
defineExpose({
  agreements,
  shiftType,
  setShiftType,
});
</script>

<template>
  <v-data-iterator
    v-bind="attrs"
    item-value="key"
    :items="agreements"
    :show-expand="props.showExpand"
    :show-select="props.showSelect"
  >
    <!-- HEADER -->
    <template #header="slotProps">
      <!-- SLOT: header -->
      <!-- @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-header -->
      <slot
        name="header"
        v-bind="{
          ...slotProps,
          agreements,
          shiftType,
          setShiftType,
          useAll,
        }"
      >
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
    <template #default="defaultSlotProps">
      <!-- SLOT: default -->
      <slot
        name="default"
        v-bind="{
          ...defaultSlotProps,
          agreements,
          shiftType,
          setShiftType,
          useAll,
        }"
      >
        <!-- grid container -->
        <div class="grid-container">
          <!-- 新規登録カード -->
          <v-card v-if="props.showCreate" @click="() => emit('click:create')">
            <v-empty-state color="primary" text="新規登録" icon="mdi-plus" />
          </v-card>

          <!-- ELEMENTS -->
          <div v-for="item in defaultSlotProps.items" :key="item.key">
            <!-- SLOT: item -->
            <slot
              name="item"
              v-bind="{
                agreement: item.raw,
                isSelected: defaultSlotProps.isSelected([item]),
                showEdit: props.showEdit,
                showExpand: props.showExpand,
                showSelect: props.showSelect,
                'onClick:edit': () => emit('click:edit', item.raw),
                'onClick:select': () =>
                  defaultSlotProps.select(
                    [item],
                    !defaultSlotProps.isSelected([item]),
                  ),
              }"
            >
              <AgreementCard
                v-bind="{
                  agreement: item.raw,
                  isSelected: defaultSlotProps.isSelected([item]),
                  showEdit: props.showEdit,
                  showExpand: props.showExpand,
                  showSelect: props.showSelect,
                  'onClick:edit': () => emit('click:edit', item.raw),
                  'onClick:select': () =>
                    defaultSlotProps.select(
                      [item],
                      !defaultSlotProps.isSelected([item]),
                    ),
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
          :action-text="props.showCreate ? '新規登録' : undefined"
          color="primary"
          @click:action="() => emit('click:create')"
        >
          <template #text>
            <div>指定された条件に該当する取極め情報は登録されていません。</div>
          </template>
        </v-empty-state>
      </v-card>
    </template>

    <!-- FOOTER -->
    <template v-if="!props.hideDefaultFooter" #footer="slotProps">
      <!-- SLOT: footer -->
      <!-- @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-footer -->
      <slot
        name="footer"
        v-bind="{ ...slotProps, agreements, shiftType, setShiftType, useAll }"
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
}

/* grid container の設定 */
.grid-container {
  display: grid;
  gap: 16px;
  /* 1列あたりの最小幅を252px、最大幅を利用可能なスペース全体に設定 */
  /* 最小幅は AgreementCard の min-width に合わせている */
  /* minmax: 指定した最小値、最大値の範囲内で定義 */
  /* repeat: 繰り返し定義。auto-fill は利用可能なスペースに収まるだけ列を作成する。 */
  /* 結果、親要素の横幅に対して最小幅252pxの列ができるだけ多く配置される */
  grid-template-columns: repeat(auto-fill, minmax(252px, 1fr));
}
</style>
