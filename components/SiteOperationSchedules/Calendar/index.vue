<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedules/Calendar/index.vue
 * @description A component to display `SiteOperationSchedules` as calendar format.
 *
 * @property {Object} dateAt - The date to display in the calendar (default: new Date()).
 * @property {Array} schedules - An array of schedule objects to display on the calendar.
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  dateAt: { type: Object, default: () => new Date() },
  events: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "SiteOperationSchedulesCalendar");
const emit = defineEmits(["update:date-range", "click:event"]);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function onClickEvent(nativeEvent, { event }) {
  emit("click:event", event.item);
}
</script>

<template>
  <div>
    <MoleculesMonthSelector
      class="pb-2"
      :model-value="props.dateAt"
      @date-range="emit('update:date-range', $event)"
    />
    <air-calendar
      style="min-height: 520px"
      :model-value="props.dateAt"
      :events="props.events"
      @click:event="onClickEvent"
    />
  </div>
</template>
