<script setup>
/**
 * @file WorkerTag.vue
 * @description Component for displaying an tag in arrangements based on TagBase.
 *
 * @props {Number} amount - The amount associated with the tag.
 * @props {String} endTime - The end time to display.
 * @props {Boolean} isEmployee - Whether the worker is an employee.
 * @props {String} startTime - The start time to display.
 */

/** define props */
const props = defineProps({
  amount: { type: Number, required: true },
  endTime: { type: String, required: true },
  /** Whether the worker is an employee. */
  isEmployee: { type: Boolean, required: true },
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
