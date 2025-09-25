<script setup>
/**
 * @file components/arrangements/NotificationChip.vue
 * @description A chip component that displays a notification status.
 */
import { useAttrs } from "vue";
import { ArrangementNotification } from "@/schemas";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE VUE UTILITIES
 *****************************************************************************/
const attrs = useAttrs();

/*****************************************************************************
 * INJECT COMPOSABLES
 *****************************************************************************/
const { get, set } = inject("arrangementNotificationManagerComposable");

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  scheduleId: { type: String, required: true },
  workerId: { type: String, required: true },
});

const emit = defineEmits(["click"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/**
 * Returns the notification object for the given schedule and worker IDs.
 * @returns {Object|null} - The notification object or null if not found.
 */
const notification = computed(() => {
  return get(props.scheduleId, props.workerId);
});

/**
 * Returns the status definition of the notification.
 * - If the notification is not found, returns the `TEMPORARY` status definition.
 * @returns {Object} - The status definition object.
 */
const status = computed(() => {
  if (!notification.value) {
    return ArrangementNotification.STATUS.TEMPORARY;
  }
  return ArrangementNotification.STATUS[notification.value.status];
});

/**
 * Returns the binding options for the chip component.
 * - The object includes all provided attributes and event handlers.
 * - `onClick` event handler is also included if the notification is found.
 * - `onClick` event calls `set` method with the notification object.
 * @returns {Object} - The binding options object.
 */
const bindOptions = computed(() => {
  const defaultOptions = {
    ...attrs,
    ...status.value,
    label: true,
    size: "x-small",
  };
  if (notification.value) {
    defaultOptions["onClick"] = () => set(notification.value);
  }
  return defaultOptions;
});
</script>

<template>
  <v-chip v-bind="bindOptions">
    {{ status.label }}
  </v-chip>
</template>
