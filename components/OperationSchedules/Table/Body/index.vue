<script setup>
/*****************************************************************************
 * @file ./components/OperationSchedules/Table/Body/index.vue
 * @description `OperationSchedulesTable` 専用コンポーネント
 * @extends TBody
 *
 * @param {Array} columns - 表示する列データの配列
 * @param {Array} rows - 表示する行データの配列
 * @param {Object} schedulesIndex - スケジュールのインデックス情報
 * @param {String} selectedDate - 選択されている日付
 *
 * @slot row-prepend - 行の先頭に表示するコンテンツを挿入するスロット
 *  @property {Object} row - 行データ
 * @slot row-header - 行のヘッダー部分に表示するコンテンツを挿入するスロット
 *  @property {Object} row - 行データ
 * @slot row-append - 行の末尾に表示するコンテンツを挿入するスロット
 *  @property {Object} row - 行データ
 * @slot cell - セルの内容をカスタマイズするためのスロット
 *  @property {Object} row - 行データ
 *  @property {Object} column - 列データ
 *
 * @emits click:add-schedule - スケジュール追加ボタンがクリックされたときに発火するイベント
 * @emits click:remove-site-order - サイトオーダー削除ボタンがクリックされたときに発火するイベント
 * @emits click:cell - セルがクリックされたときに発火するイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useOperationSchedulesTableBodyModel } from "./useOperationSchedulesTableBodyModel";
import Row from "./Row.vue";
import AddScheduleIcon from "../AddScheduleIcon.vue";
import RemoveSiteOrderIcon from "../RemoveSiteOrderIcon.vue";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationSchedulesTableBody", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  schedulesIndex: { type: Object, required: true },
  selectedDate: { type: String, default: null },
});
const props = useDefaults(_props, "OperationSchedulesTableBody");
const emit = defineEmits([
  "click:add-schedule",
  "click:remove-site-order",
  "click:cell",
]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const {
  createCellSlotProps,
  getSiteDisplayName,
  genCellContentAttrs,
  isRemoveDisabled,
} = useOperationSchedulesTableBodyModel(props, emit);
</script>

<template>
  <tbody v-bind="$attrs">
    <template v-for="row in props.rows" :key="row.key">
      <Row :columns="props.columns" :row="row">
        <template #row-prepend>
          <slot name="row-prepend" v-bind="{ row }">
            <AddScheduleIcon
              v-bind="row"
              @click="emit('click:add-schedule', { ...row })"
            />
            <RemoveSiteOrderIcon
              v-bind="row"
              :disabled="isRemoveDisabled(row)"
              @click="emit('click:remove-site-order', row.key)"
            />
          </slot>
        </template>

        <template #row-header>
          <slot name="row-header" v-bind="{ row }">
            <div class="py-1 d-flex align-center">
              <ShiftTypeChip
                :shift-type="row.shiftType"
                class="mr-2"
                density="compact"
                label
                size="small"
              />
              {{ getSiteDisplayName(row.siteId) }}
            </div>
          </slot>
        </template>

        <template #row-append>
          <slot name="row-append" v-bind="{ row }" />
        </template>

        <template #cell="{ row, column }">
          <div v-bind="genCellContentAttrs(column)">
            <slot name="cell" v-bind="createCellSlotProps(row, column)" />
          </div>
        </template>
      </Row>
    </template>
  </tbody>
</template>
