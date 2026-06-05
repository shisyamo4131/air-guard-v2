<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/UnbillableIcon.vue
 * @description 稼働実績が請求不可能状態であることを表すためのアイコンコンポーネント
 * @extends VTooltip
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationBillingUnbillableIcon", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  color: { type: String, default: "error" },
  icon: { type: String, default: "mdi-alert" },
  iconClass: { type: String, default: undefined },
  location: { type: String, default: "top" },
  size: { type: String, default: "small" },
  text: { type: String, default: "この稼働実績は請求不可能状態です。" },
});
const props = useDefaults(_props, "OperationBillingUnbillableIcon");
</script>

<template>
  <v-tooltip v-bind="$attrs" :location="props.location" :text="props.text">
    <template #activator="{ props: activatorProps }">
      <v-icon
        v-bind="activatorProps"
        :color="props.color"
        :icon="props.icon"
        :size="props.size"
        :class="props.iconClass"
      />
    </template>
  </v-tooltip>
</template>
