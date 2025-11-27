<script setup>
/**
 * DayTypeChip.vue
 * @description DayTypeChip component to display day type as a chip.
 * @version 1.0.0
 * @author shisyamo4131
 */
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

const { DAY_TYPE } = useConstants();

/** SETUP PROPS */
const _props = defineProps({
  dayType: { type: String, required: true },
});
const props = useDefaults(_props, "AtomsDayTypeChip");

/** COMPUTED PROPERTIES */
const text = computed(() => {
  return DAY_TYPE.value[props.dayType]?.title || "ERROR";
});
const color = computed(() => {
  return DAY_TYPE.value[props.dayType]?.color || undefined;
});
</script>

<template>
  <v-chip :color="color" :text="text" />
</template>
