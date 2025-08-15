<script setup>
/**
 * @file components/molecules/card/SubmitCancel.vue
 * @description A component that displays a card with submit and cancel buttons.
 *
 * @prop {string} cancelText - The text for the cancel button.
 * @prop {boolean} disableCancel - Whether to disable the cancel button.
 * @prop {boolean} disableSubmit - Whether to disable the submit button.
 * @prop {boolean} loading - Whether the component is in a loading state.
 * @prop {string} submitText - The text for the submit button.
 *
 * @emit {Function} click:cancel - Event emitted when the cancel button is clicked.
 * @emit {Function} click:submit - Event emitted when the submit button is clicked.
 *
 * @slot default - The default slot for the card content.
 * @slot btn-cancel - The slot for the cancel button.
 * @slot btn-submit - The slot for the submit button.
 */

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  cancelText: { type: String, default: "キャンセル" },
  disableCancel: { type: Boolean, default: false },
  disableSubmit: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  submitText: { type: String, default: "確定" },
});

/*****************************************************************************
 * DEFINE EMITS
 *****************************************************************************/
const emit = defineEmits(["click:cancel", "click:submit"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const cancelAttrs = computed(() => {
  return {
    disabled: props.loading || props.disableCancel,
    text: props.cancelText,
    onClick: () => emit("click:cancel"),
  };
});

const submitAttrs = computed(() => {
  return {
    color: "primary",
    disabled: props.loading || props.disableSubmit,
    text: props.submitText,
    onClick: () => emit("click:submit"),
  };
});
</script>

<template>
  <v-card>
    <slot name="default" />
    <v-card-actions>
      <slot name="btn-cancel" v-bind="cancelAttrs">
        <v-btn v-bind="cancelAttrs" />
      </slot>
      <slot name="btn-submit" v-bind="submitAttrs">
        <v-btn v-bind="submitAttrs" />
      </slot>
    </v-card-actions>
  </v-card>
</template>
