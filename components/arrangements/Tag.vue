<script setup>
/**
 * @file ArrangementsTag.vue
 * @description Component for displaying an tag in arrangements.
 * The tag size is set to a height of 48px.
 * @props {String} endTime - The end time of the shift.
 * @props {Boolean} highlight - Whether to highlight the employee tag.
 * @props {Boolean} isNew - Indicates 'new' icon.
 * @props {String} label - The label to display on the tag.
 * @props {String} startTime - The start time of the shift.
 * @props {String} status - The status of the arrangement.
 * @emits update:status - Event to update the status.
 * @emits remove - Event to remove from the arrangement.
 */
import {
  OPERATION_RESULT_DETAIL_STATUS,
  OPERATION_RESULT_DETAIL_STATUS_ARRAY,
} from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  amount: { type: Number, default: 0 },
  endTime: { type: String, default: undefined },
  highlight: { type: Boolean, default: false },
  isArranged: { type: Boolean, default: false },
  isEmployee: { type: Boolean, default: true },
  isNew: { type: Boolean, default: false },
  label: { type: String, default: undefined },
  startTime: { type: String, default: undefined },
  status: { type: String, default: OPERATION_RESULT_DETAIL_STATUS.DEFAULT },
});

/** define emits */
const emit = defineEmits(["update:status", "remove"]);

/** define consts */
const menu = ref(false);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function updateStatus(newVal) {
  emit("update:status", newVal);
  menu.value = false;
}
</script>

<template>
  <v-list-item
    class="mb-2"
    style="height: 48px"
    rounded
    variant="outlined"
    :class="{ 'highlighted-employee': props.highlight }"
  >
    <v-list-item-title class="text-subtitle-2">
      <!-- 'new' icon -->
      <v-icon v-if="props.isNew" color="red">mdi-new-box</v-icon>
      <!-- label (shown if props.label is defined) -->
      <span v-if="props.label">
        {{ props.label }}
        <span v-if="!props.isEmployee && props.isArranged">
          {{ `(${props.amount})` }}
        </span>
      </span>
      <!-- progress circular (shown if props.label is not defined) -->
      <v-progress-circular v-else indeterminate size="x-small" />
    </v-list-item-title>
    <v-list-item-subtitle v-if="isArranged" class="text-caption text-no-wrap">
      {{ `${props.startTime} - ${props.endTime}` }}
    </v-list-item-subtitle>
    <template v-if="isArranged" #append>
      <v-menu>
        <template #activator="{ props: activatorProps }">
          <!-- status chip -->
          <v-chip v-bind="activatorProps" size="x-small" label>
            {{ OPERATION_RESULT_DETAIL_STATUS[props.status] }}
          </v-chip>
        </template>
        <v-card>
          <v-container>
            <v-chip-group>
              <v-chip
                v-for="status in OPERATION_RESULT_DETAIL_STATUS_ARRAY"
                :key="status.value"
                :value="status.value"
                label
                @click="updateStatus(status.value)"
              >
                {{ status.title }}
              </v-chip>
            </v-chip-group>
          </v-container>
        </v-card>
      </v-menu>
      <v-list-item-action class="mr-2"> </v-list-item-action>
      <v-list-item-action>
        <v-icon size="small" @click="emit('remove')">mdi-close</v-icon>
      </v-list-item-action>
    </template>
  </v-list-item>
</template>

<style scoped>
.highlighted-employee {
  animation: highlight-pulse 2s ease-in-out;
  background-color: rgba(255, 193, 7, 0.3) !important;
  border-color: #ffc107 !important;
  border-width: 2px !important;
}

@keyframes highlight-pulse {
  0% {
    background-color: rgba(255, 193, 7, 0.1);
    transform: scale(1);
  }
  50% {
    background-color: rgba(255, 193, 7, 0.5);
    transform: scale(1.02);
  }
  100% {
    background-color: rgba(255, 193, 7, 0.3);
    transform: scale(1);
  }
}
</style>
