<script setup>
/*****************************************************************************
 * @file ./components/EmploymentStatus/Chip.vue
 * @description 従業員雇用状態表示チップコンポーネント
 * @author shisyamo4131
 *****************************************************************************/
import { useConstants } from "@/composables/useConstants.js";

const props = defineProps({
  value: { type: String, required: true },
});
const { EMPLOYMENT_STATUS } = useConstants();
</script>

<template>
  <v-chip :color="EMPLOYMENT_STATUS[props.value].color">{{
    EMPLOYMENT_STATUS[props.value].title
  }}</v-chip>
</template>
