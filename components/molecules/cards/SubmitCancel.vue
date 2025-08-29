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
 * @prop {string} title - The title of the card.
 *
 * @emit {Function} click:cancel - Event emitted when the cancel button is clicked.
 * @emit {Function} click:submit - Event emitted when the submit button is clicked.
 *
 * @slot default - The default slot for the card content.
 * @slot title - The slot for the card title.
 * @slot btn-cancel - The slot for the cancel button.
 * @slot btn-submit - The slot for the submit button.
 */

/*****************************************************************************
 * DEFINE PROPS / EMITS
 *****************************************************************************/
const props = defineProps({
  cancelText: { type: String, default: "キャンセル" },
  disableCancel: { type: Boolean, default: false },
  disableSubmit: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  submitText: { type: String, default: "確定" },
  title: { type: String, default: undefined },
});

const emit = defineEmits(["click:cancel", "click:submit", "update:valid"]);

/*****************************************************************************
 * DEFINE REFS
 *****************************************************************************/
const formIsValid = ref(false);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(formIsValid, (newVal) => emit("update:valid", newVal), {
  immediate: true,
});

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
    disabled: props.loading || !formIsValid.value || props.disableSubmit,
    loading: props.loading,
    text: props.submitText,
    onClick: () => emit("click:submit"),
  };
});
</script>

<template>
  <v-card>
    <v-card-title v-if="title">
      <slot name="title" :title="title" :is-valid="formIsValid">
        {{ title }}
      </slot>
    </v-card-title>
    <v-card-text>
      <v-form v-model="formIsValid">
        <slot name="default" :title="title" :is-valid="formIsValid" />
      </v-form>
    </v-card-text>
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
