<script setup>
/**
 * @file pages/employees/terminated.vue
 * @description Terminated employees management page
 */
import { Employee } from "@/schemas";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useEmployeesManager } from "@/composables/useEmployeesManager";

/** SETUP */
const search = ref(null);
const options = [
  ["where", "employmentStatus", "==", Employee.STATUS_TERMINATED],
];

/** SETUP DATA LAYER */
const { docs } = useDocuments("Employee", {
  search,
  options: toRef(options),
});

/** SETUP MANAGER */
const { attrs } = useEmployeesManager(
  {
    docs,
    useDelay: 300,
    onUpdateSearch: (val) => (search.value = val),
  },
  {
    hideCreateBtn: true,

    tableProps: {
      hideAction: true,
      searchProps: { hint: "2文字以上入力してください。" },
      sortBy: [{ key: "code", order: "desc" }],
    },
  }
);
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs" />
  </TemplatesFixedHeightContainer>
</template>
