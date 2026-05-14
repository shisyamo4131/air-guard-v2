<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedules/Calendar/index.vue
 * @description A component to display `SiteOperationSchedules` as calendar format.
 *
 * @property {Object} modelValue - The date to display in the calendar (default: new Date()).
 * @property {Array} schedules - An array of schedule objects to display on the calendar.
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  events: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => new Date() },
});
const props = useDefaults(_props, "SiteOperationSchedulesCalendar");
const emit = defineEmits([
  "update:modelValue",
  "update:date-range",
  "click:event",
]);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalModelValue = ref(props.modelValue);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.modelValue,
  (newVal) => {
    internalModelValue.value = newVal;
  },
  { immediate: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const computedModelValue = computed({
  get() {
    return internalModelValue.value;
  },
  set(v) {
    internalModelValue.value = v;
    emit("update:modelValue", v);
  },
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function onClickEvent(nativeEvent, { event }) {
  emit("click:event", event.item);
}
</script>

<template>
  <div class="d-flex flex-column">
    <MoleculesMonthSelector
      class="pb-2"
      v-model="computedModelValue"
      @date-range="emit('update:date-range', $event)"
    />
    <air-calendar
      style="min-height: 520px"
      :model-value="computedModelValue"
      :events="props.events"
      @click:event="onClickEvent"
    />
  </div>
</template>
