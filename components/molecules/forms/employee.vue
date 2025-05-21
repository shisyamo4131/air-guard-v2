<script setup>
import { Employee } from "air-guard-v2-schemas";
defineOptions({ name: "MoleculesFormsEmployee" });
const props = defineProps({
  item: { type: Object, required: true },
  updateProperties: { type: Function, required: true },
});

const schema = Object.entries(Employee.classProps).map(([key, value]) => {
  return { key, ...value };
});
</script>

<template>
  <air-form
    v-bind="$attrs"
    :item="props.item"
    :update-properties="props.updateProperties"
    :schema="schema"
  >
  </air-form>
</template>
