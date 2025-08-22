<script setup>
/**
 * @file components/arrangements/NotificationChip.vue
 * @description A chip component that displays a notification status.
 */
import { ARRANGEMENT_NOTIFICATION_STATUS } from "air-guard-v2-schemas/constants";

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
  return ARRANGEMENT_NOTIFICATION_STATUS[props.notification.status];
});
</script>

<template>
  <div>
    <v-chip
      v-if="notification"
      v-bind="{ ...$attrs, label: true }"
      @click="emit('click', props.notification)"
    >
      {{ status }}
    </v-chip>
  </div>
</template>
