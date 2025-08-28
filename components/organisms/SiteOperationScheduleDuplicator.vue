<script setup>
/**
 * @file components/organisms/SiteOperationScheduleDuplicator.vue
 * @description A component for duplicating site operation schedules.
 */

defineOptions({ inheritAttrs: false });

/***************************************************************************
 * DEFINE PROPS & EMITS
 ***************************************************************************/
const dialog = defineModel({ type: Boolean, default: false });
const props = defineProps({
  allowedDates: { type: Function, default: () => true },
  disableCancel: { type: Boolean, default: false },
  disableSubmit: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  selectedDates: { type: Array, default: () => [] },
  submitText: { type: String, default: "複製" },
});

const emit = defineEmits([
  "click:cancel",
  "click:submit",
  "update:selected-dates",
]);
</script>

<template>
  <v-dialog v-model="dialog" width="328" persistent>
    <MoleculesCardsSubmitCancel
      :disableCancel="loading"
      :disableSubmit="disableSubmit"
      :loading="loading"
      :submit-text="submitText"
      @click:cancel="emit('click:cancel')"
      @click:submit="emit('click:submit')"
    >
      <v-date-picker
        :model-value="selectedDates"
        :allowed-dates="allowedDates"
        hide-header
        multiple
        @update:model-value="emit('update:selected-dates', $event)"
      />
    </MoleculesCardsSubmitCancel>
  </v-dialog>
</template>
