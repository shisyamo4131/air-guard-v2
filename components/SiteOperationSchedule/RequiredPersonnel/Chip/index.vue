<script setup>
/*****************************************************************************
 * 現場稼働予定管理 - 必要人員チップコンポーネント
 *****************************************************************************/
import * as Vue from "vue";
import { useDefaults } from "vuetify";

defineOptions({
  name: "SiteOperationScheduleRequiredPersonnelChip",
  inheritAttrs: false,
});

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  count: { type: Number, default: 0 },
  hasMultiple: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
});
const props = useDefaults(_props, "SiteOperationScheduleRequiredPersonnelChip");
const emit = defineEmits(["click"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const attrs = Vue.computed(() => {
  return {
    modelValue: props.hasMultiple,
    content: props.count,
    color: "info",
  };
});

const chipAttrs = Vue.computed(() => {
  return {
    text: props.total || "-",
    size: "small",
    onClick: () => emit("click"),
  };
});
</script>

<template>
  <v-badge v-bind="attrs">
    <v-chip v-bind="chipAttrs" />
  </v-badge>
</template>
