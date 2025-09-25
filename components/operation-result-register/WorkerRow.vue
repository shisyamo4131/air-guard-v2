<script setup>
import { inject } from "vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  notification: { type: Object, default: undefined },
  worker: { type: Object, default: undefined },
});

const emit = defineEmits(["click"]);

/*****************************************************************************
 * DEFINE(INJECT) COMPOSABLES
 *****************************************************************************/
const cachedEmployees = inject("cachedEmployees");
const cachedOutsourcers = inject("cachedOutsourcers");

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const displayName = computed(() => {
  return (
    cachedEmployees.value[props.worker.id]?.displayName ||
    cachedOutsourcers.value[props.worker.id]?.displayName ||
    "loading..."
  );
});
</script>

<template>
  <tr>
    <td>
      {{ displayName }}
    </td>
    <td>
      {{ notification?.actualStartTime || worker?.startTime || "" }}
      -
      {{ notification?.actualEndTime || worker?.endTime || "" }}
    </td>
    <td>
      <span v-if="!notification">
        <v-chip color="error" prepend-icon="mdi-alert" size="x-small"
          >上下番実績がありません</v-chip
        >
      </span>
      <span v-else>
        <v-chip
          density="compact"
          size="small"
          @click="emit('click', notification)"
        >
          {{ notification.status }}
        </v-chip>
      </span>
    </td>
  </tr>
</template>
