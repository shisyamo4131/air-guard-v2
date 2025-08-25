<script setup>
/**
 * @file components/arrangements/NotificationChip.vue
 * @description A chip component that displays a notification status.
 */
import {
  ARRANGEMENT_NOTIFICATION_STATUS,
  ARRANGEMENT_NOTIFICATION_STATUS_TEMPORARY,
} from "air-guard-v2-schemas/constants";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  notification: { type: Object, default: null },
});

const emit = defineEmits(["click"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const status = computed(() => {
  if (!props.notification) {
    return ARRANGEMENT_NOTIFICATION_STATUS[
      ARRANGEMENT_NOTIFICATION_STATUS_TEMPORARY
    ];
  }
  return ARRANGEMENT_NOTIFICATION_STATUS[props.notification.status];
});

const bindOptions = computed(() => {
  const defaultOptions = {
    ...status.value,
    label: true,
  };
  if (props.notification) {
    defaultOptions["onClick"] = () => emit("click", props.notification);
  }
  return defaultOptions;
});
</script>

<template>
  <v-chip v-bind="{ ...$attrs, ...bindOptions }">
    {{ status.label }}
  </v-chip>
</template>
