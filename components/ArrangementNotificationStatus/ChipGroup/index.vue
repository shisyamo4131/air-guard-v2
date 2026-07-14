<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotificationStatus/ChipGroup/index.vue
 * @description A `ChipGroup` component of `ArrangementNotificationStatus`.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

defineOptions({
  name: "ArrangementNotificationStatusChipGroup",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  /** Attributes for the chips */
  chipProps: { type: Object, default: () => ({}) },
});
const props = useDefaults(_props, "ArrangementNotificationStatusChipGroup");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { ARRANGEMENT_NOTIFICATION_STATUS: STATUS } = useConstants();
</script>

<template>
  <v-chip-group v-bind="$attrs">
    <v-chip
      v-for="item of STATUS"
      v-bind="props.chipProps"
      :key="item.value"
      :value="item.value"
      :style="{ color: item.color }"
      :text="item.title"
      filter
      label
      size="small"
    />
  </v-chip-group>
</template>
