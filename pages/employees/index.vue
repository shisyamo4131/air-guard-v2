<script setup>
/**
 * @file pages/settings/employees.vue
 * @description Employee management page
 */
import { Employee } from "@/schemas";
import { useEmployees } from "@/composables/dataLayers/useEmployees";
import { useEmployeesManager } from "@/composables/useEmployeesManager";

/** SETUP */
const { docs } = useEmployees({
  constraints: [["where", "employmentStatus", "==", Employee.STATUS_ACTIVE]],
});
const { attrs } = useEmployeesManager({ docs });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs" label="在職者一覧">
      <template #input-default="props">
        <MoleculesInputsEmployeeRegist v-bind="props" />
      </template>
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
