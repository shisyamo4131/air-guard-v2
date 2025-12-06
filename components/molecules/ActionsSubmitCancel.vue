<script setup>
/**
 * @file components/molecules/ActionsSubmitCancel.vue
 * @description A component that provides submit and cancel action buttons.
 * @version 1.0.0
 * @author shisyamo4131
 *
 * @prop {string} cancelText - The text for the cancel button.
 * @prop {boolean|Array} disabled - Whether to disable the buttons. Can be a boolean or an array specifying which buttons to disable.
 * @prop {boolean} loading - Whether the submit button is in a loading state.
 * @prop {string} submitText - The text for the submit button.
 *
 * @emit click:cancel - Event emitted when the cancel button is clicked.
 * @emit click:submit - Event emitted when the submit button is clicked.
 */
const props = defineProps({
  cancelText: { type: String, default: "キャンセル" },
  color: { type: String, default: "primary" },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  submitText: { type: String, default: "確定" },
});
const emit = defineEmits(["click:cancel", "click:submit"]);

const cancelAttrs = computed(() => {
  return {
    disabled: props.loading,
    text: props.cancelText,
    onClick: () => emit("click:cancel"),
  };
});

const submitAttrs = computed(() => {
  return {
    disabled: props.disabled || props.loading,
    loading: props.loading,
    text: props.submitText,
    color: props.color,
    onClick: () => emit("click:submit"),
  };
});
</script>

<template>
  <div>
    <v-btn v-bind="cancelAttrs" />
    <v-btn v-bind="submitAttrs" />
  </div>
</template>
