<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/Manager/Table.vue
 * @description ArrangementManager 専用 配置管理テーブルコンポーネント
 * - `cell` スロットで `notificationIndexes` を提供するように `OperationSchedulesTable` を拡張しています。
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
  notificationIndexes: { type: Object, required: true },
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
  return {
    ...scope,
    notificationIndexes: props.notificationIndexes || {},
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
