<script setup>
defineOptions({ inheritAttrs: false });

defineProps({
  allowedDates: { type: Function, default: () => true },
  selectedDates: { type: Array, default: () => [] },
});
const emit = defineEmits(["update:selected-dates"]);
const manager = useTemplateRef("manager");

defineExpose({
  toCreate: (...args) => manager.value?.toCreate(...args),
  toUpdate: (...args) => manager.value?.toUpdate(...args),
  toDelete: (...args) => manager.value?.toDelete(...args),
});
</script>

<template>
  <air-item-manager ref="manager" v-bind="$attrs">
    <template #input>
      <v-date-picker
        :model-value="selectedDates"
        :allowed-dates="allowedDates"
        hide-header
        multiple
        @update:model-value="emit('update:selected-dates', $event)"
      />
    </template>
  </air-item-manager>
</template>
