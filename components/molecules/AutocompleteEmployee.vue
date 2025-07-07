<script setup>
/**
 * @file @/components/molecules/AutocompleteEmployee.vue
 * @description 従業員選択用 Autocomplete コンポーネント
 */
import { Employee } from "@/schemas";
import { fetchDocsApi } from "air-guard-v2-schemas/apis";

const props = defineProps({
  api: {
    type: Function,
    default: fetchDocsApi(Employee),
  },
  label: { type: String, default: "従業員" },
  itemTitle: { type: String, default: "fullName" },
  itemValue: { type: String, default: "docId" },
});
</script>

<template>
  <air-autocomplete-api
    v-bind="{ ...props, ...$attrs }"
    autocomplete="off"
    no-cache
  >
  </air-autocomplete-api>
</template>
