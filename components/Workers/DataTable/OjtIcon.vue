<script setup>
import * as Vue from "vue";
import { useDefaults } from "vuetify";
import { OperationDetail } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationDetail,
  },
});
const props = useDefaults(_props, "WorkersDataTableOjtIcon");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const icon = Vue.computed(() => {
  return props.item?.isOjt
    ? "mdi-checkbox-marked"
    : "mdi-checkbox-blank-outline";
});
</script>

<template>
  <v-icon v-bind="$attrs" color="primary" :icon="icon" />
</template>
