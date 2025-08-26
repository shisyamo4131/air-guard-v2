<script setup>
/**
 * @file components/molecules/WorkerTag.vue
 * @description A component for displaying a worker tag based on TagBase.
 * - Displays the worker's `startTime` and `endTime`.
 * - Displays the amount at the end of label if `isEmployee` is false.
 * @props {Number} amount - The amount associated with the tag.
 * @props {String} endTime - The end time to display.
 * @props {Boolean} isEmployee - Whether the worker is an employee.
 * @props {String} startTime - The start time to display.
 */

/** define props */
const props = defineProps({
  /** Amount of workers (used outsourcer only) */
  amount: { type: Number, required: true },
  /** End time of the worker's shift */
  endTime: { type: String, required: true },
  /** Whether the worker is an employee. */
  isEmployee: { type: Boolean, required: true },
  /** Start time of the worker's shift */
  startTime: { type: String, required: true },
});
</script>

<template>
  <MoleculesTagBase removable>
    <template #prepend-label>
      <slot name="prepend-label" />
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
      <slot name="prepend-action" />
    </template>
  </MoleculesTagBase>
</template>

<style scoped></style>
