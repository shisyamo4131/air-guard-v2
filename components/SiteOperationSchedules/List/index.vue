<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedules/List/index.vue
 * @description A List component of SiteOperationSchedules.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { SiteOperationSchedule } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  schedules: {
    type: Array,
    default: () => [],
    validator: (v) =>
      v.every((item) => toRaw(item) instanceof SiteOperationSchedule),
  },
  selectable: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SiteOperationSchedulesList");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
useFetch("SiteOperationSchedulesList");
</script>

<template>
  <air-list>
    <template v-for="(schedule, index) in props.schedules" :key="index">
      <SiteOperationScheduleListItem
        :schedule="schedule"
        :value="props.selectable ? schedule : undefined"
      />
      <v-divider />
    </template>
  </air-list>
</template>
