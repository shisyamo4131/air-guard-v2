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
    <air-array-manager class="fill-height" v-bind="attrs" label="従業員登録">
      <template #input-default="props">
        <MoleculesInputsEmployee v-bind="props" type="default" />
      </template>
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
