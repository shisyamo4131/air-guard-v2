<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/WorkersSelector.vue
 * @description 配置管理専用作業員選択コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useEmployeesInRange } from "@/composables/dataLayers/useEmployeesInRange";
import { useOutsourcersInRange } from "@/composables/dataLayers/useOutsourcersInRange";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArrangementsWorkersSelector", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  isEmployeeArranged: { type: Function, required: true },
  startDate: {
    type: Object,
    required: true,
    validator: (v) => v instanceof Date,
  },
  endDate: {
    type: Object,
    required: true,
    validator: (v) => v instanceof Date,
  },
});
const props = useDefaults(_props, "ArrangementsWorkersSelector");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { docs: employees } = useEmployeesInRange({
  from: toRef(() => props.startDate),
  to: toRef(() => props.endDate),
});
const { docs: outsourcers } = useOutsourcersInRange({
  from: toRef(() => props.startDate),
  to: toRef(() => props.endDate),
});
</script>

<template>
  <MoleculesWorkerSelector
    :employees="employees"
    :outsourcers="outsourcers"
    :is-draggable="true"
  >
    <template #employee-tag="slotProps">
      <EmployeeTag
        v-bind="slotProps"
        :variant="
          props.isEmployeeArranged(slotProps.id) ? 'disabled' : 'default'
        "
      />
    </template>
    <template #outsourcer-tag="slotProps">
      <OutsourcerTag v-bind="slotProps" />
    </template>
  </MoleculesWorkerSelector>
</template>
