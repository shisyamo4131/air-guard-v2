<script setup>
/*****************************************************************************
 * @file ./components/SiteShiftTypeOrderList/index.vue
 * @description 現場勤務区分オーダー用 List コンポーネント
 * @extends VList
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SiteShiftTypeOrderList", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  siteShiftTypeOrder: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "SiteShiftTypeOrderList");
</script>

<template>
  <v-list v-bind="$attrs">
    <SiteShiftTypeOrderListItem
      v-for="(order, index) in props.siteShiftTypeOrder"
      v-bind="order"
      :key="index"
      :value="order"
    />
  </v-list>
</template>
