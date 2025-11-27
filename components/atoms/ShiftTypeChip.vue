<script setup>
/**
 * ShiftTypeChip.vue
 * @description ShiftTypeChip component to display shift type as a chip.
 * @version 1.0.0
 * @author shisyamo4131
 */
import { computed } from "vue";
import { useDefaults } from "vuetify";
import { SHIFT_TYPE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { useConstants } from "@/composables/useConstants";

/** SETUP PROPS */
const _props = defineProps({
  shiftType: {
    type: String,
    required: true,
    validator: (value) => Object.keys(SHIFT_TYPE_VALUES).includes(value),
  },
});
const props = useDefaults(_props, "AtomsShiftTypeChip");

/** SETUP COMPOSABLES */
const { SHIFT_TYPE } = useConstants();

/** COMPUTED PROPERTIES */
const text = computed(() => {
  return SHIFT_TYPE.value[props.shiftType]?.title || "ERROR";
});
const color = computed(() => {
  return SHIFT_TYPE.value[props.shiftType]?.color || undefined;
});
</script>

<template>
  <v-chip :color="color" :text="text" />
</template>
