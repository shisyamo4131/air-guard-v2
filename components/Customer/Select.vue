<script setup>
/*****************************************************************************
 * @file ./components/Customer/Select.vue
 * @description 取引先選択用 Select コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomerSelect", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  itemTitle: { type: String, default: "abbreviation" },
  itemValue: { type: String, default: "docId" },
  label: { type: String, default: "取引先" },
});
const props = useDefaults(_props, "CustomerSelect");
</script>

<template>
  <air-select v-bind="{ ...$attrs, ...props }" />
</template>
