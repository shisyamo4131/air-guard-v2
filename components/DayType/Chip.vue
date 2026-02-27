<script setup>
/*****************************************************************************
 * @file ./components/DayType/Chip.vue
 * @description 曜日区分チップコンポーネント
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

const { DAY_TYPE } = useConstants();

/** SETUP PROPS */
const _props = defineProps({
  dayType: { type: String, required: true },
});
const props = useDefaults(_props, "DayTypeChip");

/** COMPUTED PROPERTIES */
const text = Vue.computed(() => {
  return DAY_TYPE.value[props.dayType]?.title || "ERROR";
});
const color = Vue.computed(() => {
  return DAY_TYPE.value[props.dayType]?.color || undefined;
});
</script>

<template>
  <v-chip :color="color" :text="text" />
</template>
