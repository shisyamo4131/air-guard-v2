<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedules/ListItem/index.vue
 * @description A List Item component of SiteOperationSchedule.
 *
 * @property {Object} schedule - 現場稼働予定ドキュメントモデル
 *
 * @use fetchSiteComposable
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
import { SiteOperationSchedule } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  schedule: {
    type: Object,
    required: true,
    validator: (v) => toRaw(v) instanceof SiteOperationSchedule,
  },
});
const props = useDefaults(_props, "SiteOperationScheduleListItem");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("SiteOperationScheduleListItem");
const { fetchSite, cachedSites } = fetchSiteComposable;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.schedule,
  (newVal) => {
    if (newVal && newVal.siteId) fetchSite(newVal.siteId);
  },
  { immediate: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const date = computed(() => {
  return dayjs(props.schedule.date).tz("Asia/Tokyo").format("YYYY/MM/DD (ddd)");
});

/** 時間 */
const time = computed(() => {
  const start = props.schedule.startTime;
  const end = props.schedule.endTime;
  return `${start} 〜 ${end}`;
});
</script>

<template>
  <v-list-item>
    <!-- SLOT: prepend -->
    <template #prepend>
      <ShiftTypeChip
        :shift-type="props.schedule.shiftType"
        class="me-2"
        size="x-small"
      />
    </template>

    <v-list-item-title>
      {{ `${date} ${time}` }}
    </v-list-item-title>
    <v-list-item-subtitle>
      {{ cachedSites[props.schedule.siteId]?.name || "...loading" }}
    </v-list-item-subtitle>
    <v-list-item-subtitle>
      {{
        `必要人数: ${props.schedule.requiredPersonnel} / 配置人数: ${props.schedule.workers.length}`
      }}
    </v-list-item-subtitle>
    <template #append="slotProps">
      <slot name="append" v-bind="slotProps || {}" />
    </template>
  </v-list-item>
</template>
