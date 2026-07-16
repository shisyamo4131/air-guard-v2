<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/Manager/Table.vue
 * @extends OperationSchedulesTable
 * @description ArrangementManager 専用 配置管理テーブルコンポーネント
 * - `selectedDate` プロパティを参照し、cell スロットに渡すスコープに `disabled` プロパティを追加します。
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArrangementsManagerTable", inheritAttrs: false });

/*****************************************************************************
 * METHODS
 *****************************************************************************/
const attrs = useAttrs();
/**
 * `cell` スロットに渡すプロパティを生成して返します。
 * @param scope - OperationSchedulesTable の `cell` スロットが提供するスコープ
 * @return {Object} - `cell` スロットに渡すプロパティ
 */
function createCellSlotProps(scope = {}) {
  const { date } = scope;
  const selectedDate = attrs.selectedDate;
  const disabled = !!selectedDate && selectedDate !== date;
  return {
    ...scope,
    disabled,
  };
}
</script>

<template>
  <OperationSchedulesTable v-bind="$attrs">
    <!-- すべてのスロットをパススルー -->
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot
        :name="slotName"
        v-bind="
          slotName === 'cell' ? createCellSlotProps(scope) : (scope ?? {})
        "
      />
    </template>
  </OperationSchedulesTable>
</template>
