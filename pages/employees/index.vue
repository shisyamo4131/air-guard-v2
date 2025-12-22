<script setup>
/**
 * @file pages/employees/index.vue
 * @description Active employee list page
 */
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useEmployeesManager } from "@/composables/useEmployeesManager";

/** SETUP */
const options = [["where", "employmentStatus", "==", Employee.STATUS_ACTIVE]];
const { docs } = useDocuments("Employee", {
  options: toRef(options),
  fetchAllOnEmpty: true,
});
const { attrs } = useEmployeesManager({ docs });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs">
      <template #input-default="props">
        <MoleculesInputsEmployee v-bind="props" type="default" />
      </template>
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
