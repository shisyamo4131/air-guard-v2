<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/WorkerSelector.vue
 * @description 配置管理専用作業員選択コンポーネント
 *
 * [更新履歴]
 * 2026-06-22 - `employees`, `outsourcers`, `isEmployeeArranged` を inject で取得するように修正。
 *****************************************************************************/

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArrangementsWorkerSelector", inheritAttrs: false });

/*****************************************************************************
 * INJECTS
 *****************************************************************************/
const employees = inject("selectableEmployees");
const outsourcers = inject("selectableOutsourcers");
const isEmployeeArranged = inject("isEmployeeArranged");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function getEmployeeVariant(employeeId) {
  return isEmployeeArranged(employeeId) ? "disabled" : "default";
}
</script>

<template>
  <MoleculesWorkerSelector
    v-bind="$attrs"
    :employees="employees"
    :outsourcers="outsourcers"
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
