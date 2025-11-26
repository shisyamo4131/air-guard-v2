<script>
// そのうちschemas側に移動するかも
const QUALIFIED_TYPE_VALUES = {
  BASE: { value: "BASE", title: "基本" },
  QUALIFIED: { value: "QUALIFIED", title: "資格" },
};
</script>
<script setup>
/**
 * QualifiedTypeChip.vue
 * @description QualifiedTypeChip component to display day type as a chip.
 * @version 1.0.0
 * @author shisyamo4131
 */
import { useDefaults } from "vuetify";
import { useAuthStore } from "@/stores/useAuthStore";

/** SETUP PROPS */
const _props = defineProps({
  type: {
    type: String,
    required: true,
    validator: (value) => Object.keys(QUALIFIED_TYPE_VALUES).includes(value),
  },
  density: { type: String, default: "compact" },
  label: { type: Boolean, default: true },
  size: { type: String, default: "small" },
  variant: { type: String, default: "flat" },
});
const props = useDefaults(_props, "AtomsQualifiedTypeChip");

/** SETUP COMPOSABLES AND STORES */
const { company } = useAuthStore();

/** COMPUTED PROPERTIES */
const text = computed(() => {
  return QUALIFIED_TYPE_VALUES[props.type]?.title || "ERROR";
});
const color = computed(() => {
  const def = company?.colorDefinitions?.qualifiedType?.[props.type];
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
    :label="props.label"
    :variant="props.variant"
  />
</template>
