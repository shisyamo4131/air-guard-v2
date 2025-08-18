<script setup>
/**
 * @file components/atoms/chips/ShiftType.vue
 * @description A component that displays the shift type as a chip.
 */
import {
  SHIFT_TYPE,
  SHIFT_TYPE_VALIDATOR,
} from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  shiftType: {
    type: String,
    required: true,
    validator: (value) => SHIFT_TYPE_VALIDATOR(value),
  },
  size: { type: String, default: "small" },
});

/** define computed properties */
const color = computed(() => {
  return SHIFT_TYPE[props.shiftType]?.color || "ERROR";
});

const label = computed(() => {
  return SHIFT_TYPE[props.shiftType]?.title || "ERROR";
});
</script>

<template>
  <v-chip :color="color" :size="size" label>{{ label }}</v-chip>
</template>
