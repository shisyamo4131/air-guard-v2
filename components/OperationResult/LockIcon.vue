<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/LockIcon.vue
 * @description 稼働実績がロックされていることを表すためのアイコンコンポーネント
 * @extends VTooltip
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationResultLockIcon", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  color: { type: String, default: "primary" },
  icon: { type: String, default: "mdi-lock-check-outline" },
  iconClass: { type: String, default: undefined },
  location: { type: String, default: "top" },
  size: { type: String, default: "small" },
  text: { type: String, default: "この稼働実績は編集ロックされています。" },
});
const props = useDefaults(_props, "OperationResultLockIcon");
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
