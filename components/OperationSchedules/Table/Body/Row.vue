<script setup>
/*****************************************************************************
 * @file ./components/OperationSchedules/Table/Body/Row.vue
 * @description `OperationSchedulesTableBody` 専用の行レイアウトコンポーネント
 * @extends Tr
 *
 * - 1件の現場勤務区分オーダーを、行ヘッダー行と日付セル行の2行で描画します。
 * - スケジュール集計や選択日の表示制御は親の `Body/index.vue` が担当し、
 *   このコンポーネントは行・セル構造の提供のみを行います。
 *
 * @param {Array} columns - 表示する列データの配列
 * @param {Object} row - 表示する行データ
 * @param {String} row.siteId - 現場ID
 * @param {String} row.shiftType - 勤務区分
 * @param {String} row.key - 現場勤務区分オーダーキー
 *
 * @slot row-prepend - 行ヘッダーの先頭に表示するコンテンツ
 *  @property {Object} row - 行データ
 * @slot row-header - 行ヘッダーの主表示部分
 *  @property {Object} row - 行データ
 * @slot row-append - 行ヘッダーの末尾に表示するコンテンツ
 *  @property {Object} row - 行データ
 * @slot cell - 日付セル内に表示するコンテンツ
 *  @property {Object} row - 行データ
 *  @property {Object} column - 列データ
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationSchedulesTableBodyRow", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  columns: { type: Array, required: true },
  row: { type: Object, required: true },
});
const props = useDefaults(_props, "OperationSchedulesTableBodyRow");
</script>

<template>
  <!-- TR: row header -->
  <tr>
    <td
      class="bg-grey-lighten-4"
      style="height: unset"
      :colspan="props.columns.length"
    >
      <div :id="props.row.key" class="fixed-left d-inline-flex align-center">
        <!-- SLOT: row-prepend -->
        <slot name="row-prepend" v-bind="{ row: props.row }" />

        <!-- SLOT: row-header -->
        <slot name="row-header" v-bind="{ row: props.row }" />

        <!-- SLOT: row-append -->
        <slot name="row-append" v-bind="{ row: props.row }" />
      </div>
    </td>
  </tr>

  <!-- TR: cells -->
  <tr>
    <td
      v-for="column in props.columns"
      :key="column.date"
      :style="{ padding: '8px' }"
      :class="column.colorClass"
    >
      <!-- SLOT: cell -->
      <slot name="cell" v-bind="{ row: props.row, column }" />
    </td>
  </tr>
</template>
