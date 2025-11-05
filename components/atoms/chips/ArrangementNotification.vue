<script setup>
/**
 * @file components/atoms/chips/ArrangementNotification.vue
 * @description A chip component that displays a notification status.
 *
 * @prop {Object} notification - The arrangement notification instance.
 *
 * @emits {click} - Emitted when the chip is clicked, passing the notification instance.
 */
import { useAttrs } from "vue";
import { ArrangementNotification } from "@/schemas";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE VUE UTILITIES
 *****************************************************************************/
const attrs = useAttrs();

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  notification: { type: Object, default: undefined },
});

const emit = defineEmits(["click"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/**
 * Returns the status definition of the notification.
 * - If the notification is not found, returns the `TEMPORARY` status definition.
 * @returns {Object} - The status definition object.
 */
const status = computed(() => {
  if (!props.notification) {
    return ArrangementNotification.STATUSES.TEMPORARY;
  }
  return ArrangementNotification.STATUSES[props.notification.status];
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
  if (props.notification) {
    defaultOptions["onClick"] = () => emit("click", props.notification);
  }
  return defaultOptions;
});
</script>

<template>
  <v-chip v-bind="bindOptions">
    {{ status.label }}
  </v-chip>
</template>
