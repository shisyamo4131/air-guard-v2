<script setup>
/**
 * @file components/organisms/SiteOperationScheduleDuplicator.vue
 * @description A component for duplicating site operation schedules.
 * - Use this component with `useSiteOperationScheduleDuplicator` composable.
 */

/** define props */
const props = defineProps({
  dates: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  pickerProps: { type: Object, default: () => ({}) },
});

/** define emits */
const emit = defineEmits(["update:dates", "click:cancel", "click:submit"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const computedDates = computed({
  get: () => props.dates,
  set: (v) => emit("update:dates", v),
});
</script>

<template>
  <v-dialog width="auto">
    <v-card>
      <v-date-picker
        v-model="computedDates"
        v-bind="pickerProps"
        hide-header
        multiple
      />
      <v-card-actions>
        <v-btn :disabled="loading" @click="emit('click:cancel')"
          >キャンセル</v-btn
        >
        <v-btn
          :disabled="computedDates.length === 0 || loading"
          :loading="loading"
          @click="emit('click:submit')"
          >複製</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
