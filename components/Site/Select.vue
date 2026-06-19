<script setup>
/*****************************************************************************
 * @file ./components/Site/Select.vue
 * @description 現場選択用 Select コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SiteSelect", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  itemTitle: { type: String, default: "name" },
  itemValue: { type: String, default: "docId" },
  label: { type: String, default: "現場" },
});
const props = useDefaults(_props, "SiteSelect");
</script>

<template>
  <air-select v-bind="{ ...$attrs, ...props }" />
</template>
