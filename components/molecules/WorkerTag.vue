<script setup>
/**
 * @file WorkerTag.vue
 * @description Component for displaying an tag in arrangements.
 *
 * @props {String} date - The date the worker is arranged.
 * @props {Boolean} highlight - Whether the tag is highlighted.
 * @props {Boolean} isNew - Indicates 'new' icon.
 * @props {String} label - The label to display on the tag.
 * @props {Boolean} loading - Whether the tag is in loading state.
 * @props {Object} modelValue - The worker (SiteOperationScheduleDetail) instance to display.
 * @props {String} removeIcon - Icon for the remove button.
 * @props {String} siteId - The siteId of this worker.
 * @props {String} size - Size variant of the tag ('small', 'default', 'large').
 * @props {String} shiftType - The shiftType of this worker.
 * @props {String} variant - Visual variant of the tag ('default', 'success', 'warning', 'error').
 *
 * note: 'date', 'siteId', and 'shiftType' are not used in this component.
 *       These properties may be needed in the future as the component's functionality is expanded.
 *
 * @emits update:status - Event to update the status.
 * @emits click:remove - Event to remove from the arrangement.
 */
import { SiteOperationScheduleDetail } from "@/schemas";
import {
  ARRANGEMENT_NOTIFICATION_STATUS,
  ARRANGEMENT_NOTIFICATION_STATUS_ARRAY,
  ARRANGEMENT_NOTIFICATION_STATUS_DEFAULT,
} from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  /** The date the worker is arranged */
  date: { type: String, required: true },
  /** Whether the tag is highlighted. */
  highlight: { type: Boolean, default: false },
  isNotificated: { type: Boolean, default: false },
  /** Indicates `new` icon. */
  isNew: { type: Boolean, default: false },
  /** The label to display on the tag. */
  label: {
    type: String,
    default: undefined,
    validator: (value) =>
      value === undefined ||
      (typeof value === "string" && value.trim().length > 0),
  },
  /** Whether the tag is in loading state. */
  loading: { type: Boolean, default: false },
  /** The worker (SiteOperationScheduleDetail) instance */
  modelValue: { type: Object, required: true },
  /** Icon for the remove button */
  removeIcon: { type: String, default: "mdi-close" },
  /** The siteId of this worker */
  siteId: { type: String, required: true },
  /** Size variant of the tag */
  size: {
    type: String,
    default: "default",
    validator: (value) => ["small", "default", "large"].includes(value),
  },
  /** The shiftType of this worker */
  shiftType: { type: String, required: true },
  /** Visual variant of the tag */
  variant: {
    type: String,
    default: "default",
    validator: (value) =>
      ["default", "success", "warning", "error"].includes(value),
  },
  status: {
    type: String,
    default: ARRANGEMENT_NOTIFICATION_STATUS_DEFAULT,
    validator: (value) => {
      return Object.keys(ARRANGEMENT_NOTIFICATION_STATUS).includes(value);
    },
  },
});

/** define emits */
const emit = defineEmits(["update:status", "click:remove"]);

/** define refs */
const menu = ref(false); // for v-menu
const worker = ref(new SiteOperationScheduleDetail());

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.modelValue,
  (newVal) => worker.value.initialize(newVal),
  { immediate: true, deep: true }
);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * A handler for the remove button click event.
 * Emits the 'remove' event with the workerId and amount.
 * This is used to remove the worker from the arrangement.
 * `amount` is set to 1 cause the outsourcer's tag should be removed one by one.
 */
function onClickRemove() {
  const { workerId, isEmployee } = worker.value;
  emit("click:remove", { workerId, amount: 1, isEmployee });
}

/**
 * Updates the status of the arrangement.
 * @param newVal The new status to set.
 */
function updateStatus(newVal) {
  emit("update:status", newVal);
  menu.value = false;
}
</script>

<template>
  <MoleculesTagBase
    :highlight="highlight"
    :label="label"
    :loading="loading"
    removable
    :remove-icon="removeIcon"
    :size="size"
    :variant="variant"
    @click:remove="onClickRemove"
  >
    <template #prepend-label>
      <!-- 'new' icon -->
      <v-icon v-if="isNew" color="red" :size="size">mdi-new-box</v-icon>
      <v-icon v-if="isNotificated" color="info" :size="size"
        >mdi-bullhorn</v-icon
      >
    </template>
    <template #append-label>
      <span v-if="!worker.isEmployee">{{ `(${worker.amount})` }}</span>
    </template>
    <template #footer>
      <v-list-item-subtitle class="text-caption text-no-wrap">
        {{ `${worker.startTime} - ${worker.endTime}` }}
      </v-list-item-subtitle>
    </template>
    <template #prepend-action>
      <v-menu v-if="isNotificated" v-model="menu">
        <template #activator="{ props: activatorProps }">
          <!-- status chip -->
          <v-chip v-bind="activatorProps" size="x-small" label>
            {{ ARRANGEMENT_NOTIFICATION_STATUS[status] }}
          </v-chip>
        </template>
        <v-card>
          <v-container>
            <v-chip-group>
              <v-chip
                v-for="status of ARRANGEMENT_NOTIFICATION_STATUS_ARRAY"
                :key="status.value"
                :value="status.value"
                :disabled="status.value === props.status"
                label
                @click="updateStatus(status.value)"
              >
                {{ status.title }}
              </v-chip>
            </v-chip-group>
          </v-container>
        </v-card>
      </v-menu>
    </template>
  </MoleculesTagBase>
</template>

<style scoped></style>
