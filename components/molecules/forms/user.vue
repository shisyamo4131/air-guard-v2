<script setup>
import { User } from "air-guard-v2-schemas";

const props = defineProps({
  item: { type: Object, required: true },
  updateProperties: { type: Function, required: true },
});

const schema = Object.entries(User.classProps).map(([key, value]) => {
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
    <template #roles="{ modelValue, updateModelValue }">
      <v-checkbox
        :model-value="modelValue"
        label="管理者"
        value="admin"
        @update:model-value="updateModelValue"
      />
    </template>
  </air-form>
</template>
