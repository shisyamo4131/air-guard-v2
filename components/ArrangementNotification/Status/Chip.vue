<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/Status/Chip.vue
 * @description A chip component of `ArrangementNotification` status.
 * @extends VChip
 *****************************************************************************/
import { useConstants } from "@/composables/useConstants";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  status: { type: String, required: true },
});
const props = useDefaults(_props, "ArrangementNotificationStatusChip");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { ARRANGEMENT_NOTIFICATION_STATUS } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const definition = computed(() => {
  return ARRANGEMENT_NOTIFICATION_STATUS.value?.[props.status] || null;
});

const color = computed(() => {
  return definition.value?.color || "grey";
});

const text = computed(() => {
  return definition.value?.title || "N/A";
});
</script>

<template>
  <v-chip :color="color" :text="text" />
</template>
