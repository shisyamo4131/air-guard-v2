<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/WorkerSelector.vue
 * @description 配置管理専用作業員選択コンポーネント
 *
 * [更新履歴]
 * 2026-06-22 - `employees`, `outsourcers`, `isEmployeeArranged` を inject で取得するように修正。
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArrangementsWorkerSelector", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  employees: { type: Array, default: () => [] },
  outsourcers: { type: Array, default: () => [] },
  isEmployeeArranged: { type: Function, default: () => false },
});
const props = useDefaults(_props, "ArrangementsWorkerSelector");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function getEmployeeVariant(employeeId) {
  return props.isEmployeeArranged(employeeId) ? "disabled" : "default";
}
</script>

<template>
  <MoleculesWorkerSelector
    v-bind="$attrs"
    :employees="props.employees"
    :outsourcers="props.outsourcers"
    :is-draggable="true"
  >
    <template #employee-tag="slotProps">
      <EmployeeTag
        v-bind="slotProps"
        :variant="getEmployeeVariant(slotProps.id)"
      />
    </template>
    <template #outsourcer-tag="slotProps">
      <OutsourcerTag v-bind="slotProps" />
    </template>
  </MoleculesWorkerSelector>
</template>
