<script setup>
/**
 * ShiftTypeChip.vue
 * @description ShiftTypeChip component to display day type as a chip.
 * @version 1.0.0
 * @author shisyamo4131
 */
import { useDefaults } from "vuetify";
import { SHIFT_TYPE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { useAuthStore } from "@/stores/useAuthStore";

/** SETUP PROPS */
const _props = defineProps({
  shiftType: {
    type: String,
    required: true,
    validator: (value) => Object.keys(SHIFT_TYPE_VALUES).includes(value),
  },
  density: { type: String, default: "compact" },
  size: { type: String, default: "small" },
});
const props = useDefaults(_props, "AtomsShiftTypeChip");

/** SETUP COMPOSABLES AND STORES */
const { company } = useAuthStore();

/** COMPUTED PROPERTIES */
const text = computed(() => {
  return SHIFT_TYPE_VALUES[props.shiftType]?.title || "ERROR";
});
const color = computed(() => {
  const def = company?.colorDefinitions?.shiftType?.[props.shiftType];
  if (def && def.color) return def.color;
  return undefined;
});
</script>

<template>
  <v-chip
    :density="props.density"
    :color="color"
    :size="props.size"
    :text="text"
  />
</template>
