<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Iterator/index.vue
 * @description 取極め情報表示用データイテレーターコンポーネント
 * @author shisyamo4131
 * @extends AirDataIterator
 *
 * @property {Array} agreements - 表示する取極め情報の配列
 * @property {String} shiftType - 勤務区分のフィルタリング条件（"ALL" | Agreement.SHIFT_TYPE のいずれか）
 * @property {Boolean} showCreate - 新規登録機能の表示有無
 * @property {Boolean} showEdit - 編集機能の表示有無
 * @property {Boolean} useAll - 勤務区分フィルタに "ALL" オプションを表示するかどうか
 *
 * - その他、AirDataIterator に実装されているすべてのプロパティが使用可能です。
 * @property {String|Number} gap - アイテム間のギャップ。CSS の gap プロパティと同様の値を取ります。数値の場合はピクセル単位として解釈されます。
 * @property {Boolean} grid - アイテムをグリッドレイアウトで表示するかどうか
 * @property {Boolean} hideDefaultFooter - デフォルトのフッターを非表示にするかどうかを指定するプロパティ
 * @property {String|Number} minColumnWidth - グリッドレイアウトの最小列幅。CSS の minmax 関数の最小値として使用されます。数値の場合はピクセル単位として解釈されます。
 * @property {Object|Array} modelValue - 選択されたアイテムの値。`selectStrategy` に応じて、単一の値、配列、またはオブジェクトになる。
 * @property {String} selectStrategy - 選択戦略を指定するプロパティ。例: "single"（単一選択）や "page"（ページ単位選択）や "all"（全選択）など。
 * @property {Boolean} showExpand - 展開機能の表示有無
 * @property {Boolean} showSelect - 選択機能の表示有無
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
 *  @property {Function} isSelected - アイテムが選択されているかどうか
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
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex.js";
import { Agreement } from "@/schemas";

defineOptions({ name: "AgreementsIterator" });

/** SETUP PROPS & EMITS */
const _props = defineProps({
  agreements: { type: Array, default: () => [] },
  hideDefaultFooter: { type: Boolean, default: false },
  shiftType: {
    type: String,
    default: "DAY",
    validator: (value) =>
      ["ALL", ...Object.keys(Agreement.SHIFT_TYPE)].includes(value),
  },
  showCreate: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  useAll: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementsIterator");
const emit = defineEmits(["click:create", "click:edit", "update:shift-type"]);

/** SETUP COMPOSABLES */
const { agreements, shiftType, setShiftType } = useIndex(props, emit);

/** EXPOSE */
defineExpose({
  agreements,
  shiftType,
  setShiftType,
});
</script>

<template>
  <air-data-iterator
    item-value="key"
    :items="agreements"
    :min-column-width="252"
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

    <!-- SLOT: DEFAULT -->
    <template v-if="$slots.default" #default="slotProps">
      <slot name="default" v-bind="slotProps" />
    </template>

    <template #item="{ item, isSelected, select, showExpand, showSelect }">
      <AgreementCard
        v-bind="{
          agreement: item.raw,
          isSelected: isSelected(item),
          showEdit: props.showEdit,
          showExpand: showExpand,
          showSelect: showSelect,
          'onClick:edit': () => emit('click:edit', item.raw),
          'onClick:select': () => select([item], !isSelected(item)),
        }"
      />
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
  </air-data-iterator>
</template>

<style scoped></style>
