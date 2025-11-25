<script setup>
/**
 * @file components/atoms/chips/ShiftType.vue
 * @description A component that displays the shift type as a chip.
 */
import {
  SHIFT_TYPE_VALUES as VALUES,
  SHIFT_TYPE_VALIDATOR as VALIDATOR,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  shiftType: {
    type: String,
    required: true,
    validator: (value) => VALIDATOR(value),
  },
  size: { type: String, default: "small" },
});

/** define computed properties */
const color = computed(() => {
  return VALUES[props.shiftType]?.color || "ERROR";
});

const label = computed(() => {
  return VALUES[props.shiftType]?.title || "ERROR";
});
</script>

<template>
  <v-chip :color="color" :size="size" label>{{ label }}</v-chip>
</template>
