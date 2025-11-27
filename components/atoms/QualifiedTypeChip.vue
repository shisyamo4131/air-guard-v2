<script setup>
/**
 * QualifiedTypeChip.vue
 * @description QualifiedTypeChip component to display qualified type as a chip.
 * @version 1.0.0
 * @author shisyamo4131
 */
import { computed } from "vue";
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

/** SETUP PROPS */
const _props = defineProps({
  type: {
    type: String,
    required: true,
    validator: (value) => ["BASE", "QUALIFIED"].includes(value),
  },
  label: { type: Boolean, default: true },
  variant: { type: String, default: "flat" },
});
const props = useDefaults(_props, "AtomsQualifiedTypeChip");

/** SETUP COMPOSABLES */
const { QUALIFIED_TYPE } = useConstants();

/** COMPUTED PROPERTIES */
const text = computed(() => {
  return QUALIFIED_TYPE.value[props.type]?.title || "ERROR";
});
const color = computed(() => {
  return QUALIFIED_TYPE.value[props.type]?.color || undefined;
});
</script>

<template>
  <v-chip :color="color" :text="text" />
</template>
