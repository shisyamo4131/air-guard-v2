<script setup>
/*****************************************************************************
 * @file ./components/ShiftType/Tabs.vue
 * @description 勤務区分用 Tabs コンポーネント
 *
 * @property {String} modelValue - 選択されている勤務区分の値
 *
 * @emits update:modelValue - 勤務区分の値が更新されたときに発火するイベント
 *****************************************************************************/
import {
  SHIFT_TYPE_VALUES,
  SHIFT_TYPE_OPTIONS,
} from "@shisyamo4131/air-guard-v2-schemas/constants";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  modelValue: {
    type: String,
    default: SHIFT_TYPE_OPTIONS[0].value,
    validator: (value) => Object.keys(SHIFT_TYPE_VALUES).includes(value),
  },
});
const props = useDefaults(_props, "ShiftTypeTabs");
const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * SETUP STATES
 *****************************************************************************/
const tab = ref(SHIFT_TYPE_OPTIONS[0].value);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.modelValue,
  (newValue) => (tab.value = newValue),
  { immediate: true },
);
watch(tab, (newValue, oldValue) => {
  emit("update:modelValue", newValue);
});
</script>

<template>
  <v-tabs v-model="tab">
    <v-tab
      v-for="option in SHIFT_TYPE_OPTIONS"
      :key="option.value"
      :text="option.title"
      :value="option.value"
    />
  </v-tabs>
</template>
