<script setup>
/*****************************************************************************
 * @file ./components/OperationSchedules/Table/RemoveSiteOrderIcon.vue
 * @description OperationSchedulesTable 専用現場オーダー行削除アイコン
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "OperationSchedulesTableRemoveSiteOrderIcon",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  siteId: { type: String, required: true },
  shiftType: { type: String, required: true },
});
const props = useDefaults(_props, "OperationSchedulesTableRemoveSiteOrderIcon");

/*****************************************************************************
 * SETUP USE FETCH COMPOSABLE
 *****************************************************************************/
const { fetchSiteComposable } = useFetch(
  "OperationSchedulesTableRemoveSiteOrderIcon",
);
const { cachedSites } = fetchSiteComposable;

/*****************************************************************************
 * SETUP USE CONSTANTS COMPOSABLE
 *****************************************************************************/
const { SHIFT_TYPE } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const site = computed(() => {
  return cachedSites.value?.[props.siteId] || null;
});

const shiftTypeTitle = computed(() => {
  return SHIFT_TYPE.value?.[props.shiftType]?.title || null;
});

const tooltipText = computed(() => {
  if (!site.value) return null;
  return `${site.value.name}【${shiftTypeTitle.value}】の行を削除します。`;
});
</script>

<template>
  <v-icon
    v-bind="$attrs"
    icon="mdi-close"
    size="x-small"
    class="me-2"
    v-tooltip:top="tooltipText"
  />
</template>
