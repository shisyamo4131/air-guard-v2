<script setup>
/**
 * @file components/molecules/WorkerTag.vue
 * @description A component for displaying a worker tag based on TagBase.
 * - Displays the worker's `startTime` and `endTime`.
 * @props {Number} amount - The amount associated with the tag.
 * @props {String} endTime - The end time to display.
 * @props {Boolean} highlight - Whether the tag is highlighted.
 * @props {String} label - The label to display on the tag.
 * @props {Boolean} loading - Whether the tag is in loading state.
 * @props {Boolean} removable - Displays clear button and emit `remove` event when clicked.
 * @props {String} removeIcon - Icon for the remove button.
 * @props {Boolean} showAmount - Whether to show the amount at the end of label.
 * @props {String} size - Size variant of the tag. One of "small", "medium", "large".
 * @props {String} startTime - The start time to display.
 * @props {String} variant - Visual variant of the tag. One of "default", "success", "warning", "error", "disabled".
 *
 * @emits {Event} click:remove - Emitted when the remove button is clicked.
 */

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  /** Amount of workers (used outsourcer only) */
  amount: { type: Number, required: true },
  /** End time of the worker's shift */
  endTime: { type: String, required: true },
  /** Whether the tag is highlighted. */
  highlight: { type: Boolean, default: false },
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
  /** Displays clear button and emit `remove` event when clicked */
  removable: { type: Boolean, default: false },
  /** Icon for the remove button */
  removeIcon: { type: String, default: "mdi-close" },
  /** Whether to show the amount at the end of label */
  showAmount: { type: Boolean, required: true },
  /** Size variant of the tag */
  size: {
    type: String,
    default: "medium",
    validator: (value) => ["small", "medium", "large"].includes(value),
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
    <template #prepend-label>
      <slot name="prepend-label" />
    </template>
    <template #append-label>
      <span v-if="showAmount">{{ `(${amount})` }}</span>
    </template>
    <template #footer>
      <v-list-item-subtitle class="text-caption text-no-wrap">
        {{ `${startTime} - ${endTime}` }}
      </v-list-item-subtitle>
    </template>
    <template #prepend-action>
      <slot name="prepend-action" />
    </template>
  </MoleculesTagBase>
</template>

<style scoped></style>
