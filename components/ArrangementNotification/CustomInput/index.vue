<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/CustomInput/index.vue
 * @description A custom-input component of `ArrangementNotification`.
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
import { ArrangementNotification } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";

defineOptions({
  name: "ArrangementNotificationCustomInput",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, required: true },
  includesStatus: { type: Boolean, default: false },
  item: {
    type: Object,
    default: null,
    validator: (value) =>
      value === null || value instanceof ArrangementNotification,
  },
});
const props = useDefaults(_props, "ArrangementNotificationCustomInput");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const {
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = useFetch("ArrangementNotificationCustomInput");
const { cachedSites, fetchSite } = fetchSiteComposable;
const { cachedEmployees, fetchEmployee } = fetchEmployeeComposable;
const { cachedOutsourcers, fetchOutsourcer } = fetchOutsourcerComposable;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const site = computed(() => {
  return cachedSites.value[props.item?.siteId] || null;
});
const siteName = computed(() => {
  return site.value?.name || "N/A";
});
const worker = computed(() => {
  if (!props.item) return null;
  if (props.item.isEmployee) {
    return cachedEmployees.value[props.item.id] || null;
  } else {
    return cachedOutsourcers.value[props.item.id] || null;
  }
});
const displayName = computed(() => {
  return worker.value?.displayName || "N/A";
});
const dateTime = computed(() => {
  if (!props.item) return "N/A";
  const date = dayjs(props.item.dateAt)
    .tz("Asia/Tokyo")
    .format("YYYY年MM月DD日（ddd）");
  const start = props.item.startTime || "N/A";
  const end = props.item.endTime || "N/A";
  return `${date}${start}～${end}`;
});
/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.item,
  (newItem) => {
    if (newItem) {
      fetchSite(newItem.siteId);
      if (newItem.isEmployee) {
        fetchEmployee(newItem.id);
      } else {
        fetchOutsourcer(newItem.id);
      }
    }
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <div>
    <div class="text-subtitle-1 mb-4">作業員: {{ displayName }}</div>
    <v-input>
      <v-card class="w-100">
        <air-list>
          <v-list-item>
            <v-list-item-title>配置先</v-list-item-title>
            <v-list-item-subtitle>{{ siteName }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>日時</v-list-item-title>
            <v-list-item-subtitle>{{ dateTime }}</v-list-item-subtitle>
          </v-list-item>
        </air-list>
      </v-card>
    </v-input>
    <template v-if="props.includesStatus">
      <span class="text-overline text-medium-emphasis">状態</span>
      <v-input>
        <ArrangementNotificationStatusChipGroup
          v-bind="props.componentAttrs['status']"
          mandatory
          column
        />
      </v-input>
    </template>
    <v-expand-transition>
      <v-row v-show="props.item.isLeaved" dense>
        <!-- ACTUAL START TIME -->
        <v-col cols="12" md="6">
          <air-time-picker-input
            v-bind="props.componentAttrs[`actualStartTime`]"
          />
        </v-col>

        <!-- ACTUAL END TIME -->
        <v-col cols="12" md="6">
          <air-time-picker-input
            v-bind="props.componentAttrs[`actualEndTime`]"
          />
        </v-col>

        <!-- ACTUAL IS START NEXT DAY -->
        <v-col cols="12">
          <IsStartNextDayCheckbox
            v-bind="props.componentAttrs[`actualIsStartNextDay`]"
          />
        </v-col>

        <!-- ACTUAL BREAK MINUTES -->
        <v-col cols="12">
          <AtomsHourInput
            v-bind="props.componentAttrs[`actualBreakMinutes`]"
            label="休憩時間"
            :step="0.5"
          />
        </v-col>
      </v-row>
    </v-expand-transition>
    <v-row dense>
      <v-col cols="12" md="6">
        <air-checkbox v-bind="props.componentAttrs['isQualified']" />
      </v-col>
      <v-col cols="12" md="6">
        <air-checkbox v-bind="props.componentAttrs['isOjt']" />
      </v-col>
    </v-row>
  </div>
</template>
