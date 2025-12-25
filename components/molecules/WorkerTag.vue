<script setup>
/**
 * @file components/molecules/WorkerTag.vue
 * @description A component for displaying a worker tag based on TagBase.
 * - Displays the worker's `startTime` and `endTime`.
 *
 * @props {String} endTime - End time of the worker's shift.
 * @props {Boolean} highlight - Whether the tag is highlighted.
 * @props {String} label - The label to display on the tag.
 * @props {Boolean} loading - Whether the tag is in loading state.
 * @props {Boolean} removable - Displays clear button and emits `click:remove` event when clicked.
 * @props {String} removeIcon - Icon for the remove button.
 * @props {String} size - Size variant of the tag ('SMALL', 'MEDIUM', 'LARGE').
 * @props {String} startTime - Start time of the worker's shift.
 * @props {String} variant - Visual variant of the tag ('default', 'success', 'warning', 'error', 'disabled').
 *
 * @emits click:remove - Emitted when the remove button is clicked.
 *
 * @slots
 *   - prepend-label: Content before the label.
 *   - append-label: Content after the label.
 *   - startTime: Slot for customizing the start time display.
 *   - endTime: Slot for customizing the end time display.
 *   - append-footer: Slot for customizing the footer display.
 *   - prepend-action: Content in the prepend action area.
 *
 * @update 2025-12-25 Removed deprecated `amount` and `showAmount` props.
 * @update 2025-12-25 Modified `size` prop to be based on `TAG_SIZE_VALUES`.
 */
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  /** End time of the worker's shift */
  endTime: { type: String, required: true },

  /** Whether the tag is highlighted */
  highlight: { type: Boolean, default: false },

  /** The label to display on the tag */
  label: {
    type: String,
    default: undefined,
    validator: (value) =>
      value === undefined ||
      (typeof value === "string" && value.trim().length > 0),
  },

  /** Whether the tag is in loading state */
  loading: { type: Boolean, default: false },

  /** Displays clear button and emits `click:remove` event when clicked */
  removable: { type: Boolean, default: false },

  /** Icon for the remove button */
  removeIcon: { type: String, default: "mdi-close" },

  /** Size variant of the tag (SMALL, MEDIUM, LARGE) */
  size: {
    type: String,
    default: TAG_SIZE_VALUES.MEDIUM.value,
    validator: (value) => Object.keys(TAG_SIZE_VALUES).includes(value),
  },

  /** Start time of the worker's shift */
  startTime: { type: String, required: true },

  /** Visual variant of the tag */
  variant: {
    type: String,
    default: "default",
    validator: (value) =>
      ["default", "success", "warning", "error", "disabled"].includes(value),
  },
});

const emit = defineEmits(["click:remove"]);
</script>

<template>
  <MoleculesTagBase
    :highlight="highlight"
    :label="label"
    :loading="loading"
    :removable="removable"
    :remove-icon="removeIcon"
    :size="size"
    :variant="variant"
    @click:remove="emit('click:remove')"
  >
    <!-- Pass through: prepend-label slot with slot props -->
    <template #prepend-label="slotProps">
      <slot name="prepend-label" v-bind="slotProps" />
    </template>

    <!-- Pass through: append-label slot with slot props -->
    <template #append-label="slotProps">
      <slot name="append-label" v-bind="slotProps" />
    </template>

    <!-- Footer: display start and end times -->
    <template #footer>
      <v-list-item-subtitle class="text-caption text-no-wrap">
        <!-- Slot: startTime -->
        <slot name="startTime" :start-time="startTime">
          <span>{{ startTime }}</span>
        </slot>

        <span> - </span>

        <!-- Slot: endTime -->
        <slot name="endTime" :end-time="endTime">
          <span>{{ endTime }}</span>
        </slot>

        <!-- Slot: append-footer -->
        <slot name="append-footer" />
      </v-list-item-subtitle>
    </template>

    <!-- Pass through: prepend-action slot -->
    <template #prepend-action>
      <slot name="prepend-action" />
    </template>
  </MoleculesTagBase>
</template>

<style scoped></style>
