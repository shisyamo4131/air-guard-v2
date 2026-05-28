<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/CustomInput/index.vue
 * @description A custom-input component of `ArrangementNotification`.
 *****************************************************************************/
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
            <v-list-item-subtitle
              >2026年05月27日（水）08:00～17:00</v-list-item-subtitle
            >
          </v-list-item>
        </air-list>
      </v-card>
    </v-input>
    <span class="text-overline text-medium-emphasis">状態</span>
    <v-input>
      <ArrangementNotificationStatusChipGroup
        v-bind="componentAttrs['status']"
        mandatory
        column
      />
    </v-input>
    <v-expand-transition>
      <v-row v-show="props.item.isLeaved" dense>
        <!-- ACTUAL START TIME -->
        <v-col cols="12" md="6">
          <air-time-picker-input v-bind="componentAttrs[`actualStartTime`]" />
        </v-col>

        <!-- ACTUAL END TIME -->
        <v-col cols="12" md="6">
          <air-time-picker-input v-bind="componentAttrs[`actualEndTime`]" />
        </v-col>

        <!-- ACTUAL IS START NEXT DAY -->
        <v-col cols="12">
          <IsStartNextDayCheckbox
            v-bind="componentAttrs[`actualIsStartNextDay`]"
          />
        </v-col>

        <!-- ACTUAL BREAK MINUTES -->
        <v-col cols="12">
          <AtomsHourInput
            v-bind="componentAttrs[`actualBreakMinutes`]"
            label="休憩時間"
            :step="0.5"
          />
        </v-col>
      </v-row>
    </v-expand-transition>
  </div>
</template>
