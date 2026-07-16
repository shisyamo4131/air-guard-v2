<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/Manager/Table.vue
 * @description ArrangementManager 専用 配置管理テーブルコンポーネント
 * @extends OperationSchedulesTable
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArrangementsManagerTable", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  /**
   * 選択された日付
   * - 指定された日付に該当するセル以外をぼやけさせます。
   */
  selectedDate: { type: String, default: undefined },
});
const props = useDefaults(_props, "ArrangementsManagerTable");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * `cell` スロットに渡すプロパティを生成して返します。
 * @param scope - OperationSchedulesTable の `cell` スロットが提供するスコープ
 * @return {Object} - `cell` スロットに渡すプロパティ
 */
function createCellSlotProps(scope = {}) {
  const { date } = scope;
  const disabled = !!props.selectedDate && props.selectedDate !== date;
  return {
    ...scope,
    disabled,
  };
}
</script>

<template>
  <OperationSchedulesTable
    v-bind="{ ...$attrs, selectedDate: props.selectedDate }"
  >
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
