<script setup>
/*****************************************************************************
 * @file ./components/Employee/ScheduleCalendar/index.vue
 * @description A component for displaying the specific employee's schedule.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  employeeId: { type: String, required: true },
});
const props = useDefaults(_props, "EmployeeScheduleCalendar");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { fetchSite, cachedSites } = useFetchSite();
const { docs } = useDocuments(
  "ArrangementNotification",
  {
    options: computed(() => [["where", "id", "==", props.employeeId]]),
    fetchAllOnEmpty: true,
  },
  (doc) => fetchSite(doc),
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const items = computed(() => {
  return docs.toSorted((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    if (a.shiftType > b.shiftType) return 1;
    if (a.shiftType < b.shiftType) return -1;
    return 0;
  });
});
</script>

<template>
  <div>
    <air-list v-if="docs.length !== 0">
      <ArrangementNotificationListItem
        v-for="(item, index) of items"
        :key="index"
        v-bind="item"
        :cachedSites="cachedSites"
      />
    </air-list>
  </div>
</template>
