<script setup>
/**
 * @file WorkerTag.vue
 * @description Component for displaying an tag in arrangements.
 *
 * @props {Number} amount - The amount associated with the tag.
 * @props {String} endTime - The end time to display.
 * @props {Boolean} highlight - Whether the tag is highlighted.
 * @props {Boolean} isEmployee - Whether the worker is an employee.
 * @props {Boolean} isNotificated - Whether the tag is in notification state.
 * @props {Boolean} isNew - Indicates 'new' icon.
 * @props {String|undefined} label - The label to display on the tag.
 * @props {Boolean} loading - Whether the tag is in loading state.
 * @props {String} removeIcon - Icon for the remove button.
 * @props {String} size - Size variant of the tag ('small', 'default', 'large').
 * @props {String} startTime - The start time to display.
 * @props {String} variant - Visual variant of the tag ('default', 'success', 'warning', 'error').
 * @props {String} status - Status of the arrangement notification.
 * @props {String} workerId - The worker's unique identifier.
 *
 * @emits update:status - Event to update the status.
 * @emits click:remove - Event to remove from the arrangement.
 */
import {
  ARRANGEMENT_NOTIFICATION_STATUS,
  ARRANGEMENT_NOTIFICATION_STATUS_ARRAY,
  ARRANGEMENT_NOTIFICATION_STATUS_DEFAULT,
} from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  amount: { type: Number, required: true },
  endTime: { type: String, required: true },
  /** Whether the tag is highlighted. */
  highlight: { type: Boolean, default: false },
  /** Whether the worker is an employee. */
  isEmployee: { type: Boolean, required: true },
  /** Whether the tag is in notification state. */
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
  /** Icon for the remove button */
  removeIcon: { type: String, default: "mdi-close" },
  /** Size variant of the tag */
  size: {
    type: String,
    default: "default",
    validator: (value) => ["small", "default", "large"].includes(value),
  },
  startTime: { type: String, required: true },
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
  workerId: { type: String, required: true },
});

/** define emits */
const emit = defineEmits(["update:status", "click:remove"]);

/** define refs */
const menu = ref(false); // for v-menu

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/

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
  emit("click:remove", {
    workerId: props.workerId,
    amount: 1,
    isEmployee: props.isEmployee,
  });
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
      <span v-if="!isEmployee">{{ `(${amount})` }}</span>
    </template>
    <template #footer>
      <v-list-item-subtitle class="text-caption text-no-wrap">
        {{ `${startTime} - ${endTime}` }}
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
