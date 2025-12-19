<script setup>
/**
 * @file pages/settings/employees.vue
 * @description Employee management page
 */
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useEmployeesManager } from "@/composables/useEmployeesManager";

/** SETUP */
const { docs } = useDocuments("Employee", {
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
