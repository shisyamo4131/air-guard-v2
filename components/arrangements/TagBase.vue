<script setup>
/**
 * TagBase.vue
 *
 * Base component for displaying a tag in arrangements.
 * The tag has a fixed height of 48px.
 *
 * @props {Boolean} highlight - Whether the tag is highlighted.
 * @props {String} label - The label to display on the tag.
 *
 * @slots
 * - prepend-label: Content before the label.
 * - label: Custom label content.
 * - append-label: Content after the label.
 * - append: Content in the append area.
 * - footer: Content in the footer area.
 */

/** define props */
const props = defineProps({
  /** Displays clear button and emit `remove` event when clicked */
  clearable: { type: Boolean, default: false },
  /** Whether the tag is highlighted. */
  highlight: { type: Boolean, default: false },
  /** The label to display on the tag. */
  label: { type: String, default: undefined },
});

/** define emits */
const emit = defineEmits(["remove"]);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * A handler for the remove button click event.
 * Emits the 'remove' event.
 */
function onClickRemove() {
  emit("remove");
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
      <!-- label (shown if props.label is defined) -->
      <span v-if="props.label">
        <slot name="prepend-label" v-bind="{ label: props.label }" />
        <slot name="label" v-bind="{ label: props.label }">
          {{ props.label }}
        </slot>
        <slot name="append-label" />
      </span>
      <!-- progress circular (shown if props.label is not defined) -->
      <v-progress-circular v-else indeterminate size="x-small" />
    </v-list-item-title>
    <slot name="footer" />
    <template #append>
      <slot name="append">
        <v-list-item-action>
          <v-icon size="small" @click="onClickRemove">mdi-close</v-icon>
        </v-list-item-action>
      </slot>
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
