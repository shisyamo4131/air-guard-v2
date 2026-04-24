<script setup>
/*****************************************************************************
 * @file ./components/Insurance/Status/Chip.vue
 * @description 保険加入状態表示用チップコンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  isProcessing: { type: Boolean, default: false },
  status: { type: String, required: true },
});
const props = useDefaults(_props, "InsuranceStatusChip");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { INSURANCE_STATUS } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const text = computed(() => {
  const result = INSURANCE_STATUS.value[props.status]?.title || "N/A";
  return props.isProcessing ? `${result} (手続中)` : result;
});
const attrs = computed(() => {
  return {
    ...INSURANCE_STATUS.value[props.status],
    text: text.value,
  };
});
</script>

<template>
  <v-chip v-bind="attrs" />
</template>
