<script setup>
import { inject } from "vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  agreement: { type: Object, default: null },
  notification: { type: Object, default: undefined },
  worker: { type: Object, default: undefined },
});

const emit = defineEmits(["click", "click:notify"]);

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

const overtimeWorkMinutes = computed(() => {
  if (!props.agreement) return "-";
  if (props.notification) {
    return (
      props.notification.totalWorkMinutes -
      props.agreement.regulationWorkMinutes
    );
  } else {
    return (
      props.worker.totalWorkMinutes - props.agreement.regulationWorkMinutes
    );
  }
});
</script>

<template>
  <tr>
    <td>
      <AtomsIconsHasLicense v-if="notification?.isQualified" />
      <AtomsIconsIsOjt v-if="notification?.isOjt" />
      {{ displayName }}
    </td>
    <td>
      <div class="d-flex align-center" style="position: relative">
        <AtomsChipsIsStartNextDay
          v-if="notification.actualIsStartNextDay"
          style="position: absolute; top: -10px"
        />
        {{ notification?.actualStartTime || worker?.startTime || "" }}
        -
        {{ notification?.actualEndTime || worker?.endTime || "" }}
        {{
          `(休憩: ${
            notification?.actualBreakMinutes || worker?.breakMinutes || 0
          }分 / 残業: ${overtimeWorkMinutes}分)`
        }}
      </div>
    </td>
    <td>
      <span v-if="!notification">
        <v-chip
          color="error"
          prepend-icon="mdi-alert"
          size="small"
          @click="emit('click:notify', worker)"
          >配置通知がありません</v-chip
        >
      </span>
      <span v-else>
        <AtomsChipsArrangementNotification
          :notification="notification"
          @click="emit('click', notification)"
        />
      </span>
    </td>
  </tr>
</template>
