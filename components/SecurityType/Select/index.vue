<script setup>
/*****************************************************************************
 * @file ./components/SecurityType/Select/index.vue
 * @description 警備種別用 Select コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SecurityTypeSelect", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  label: { type: String, default: "警備種別" },
});
const props = useDefaults(_props, "SecurityTypeSelect");

/*****************************************************************************
 * SETUP CONSTANTS COMPOSABLE
 *****************************************************************************/
const { SECURITY_TYPE, toArray } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const items = computed(() => toArray(SECURITY_TYPE.value));
</script>

<template>
  <air-select v-bind="$attrs" :label="props.label" :items="items" />
</template>
