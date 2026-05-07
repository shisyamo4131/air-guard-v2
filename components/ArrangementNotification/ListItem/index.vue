<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/ListItem/index.vue
 * @description A component for displaying a single `ArrangementNotification`.
 * @extends VListItem
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useDateUtil } from "@/composables/useDateUtil";
import { useMessage } from "./useMessage";
import { ArrangementNotification } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  notification: { type: [Object, null], required: true },
  showMessage: { type: Boolean, default: false },
  showStatus: { type: Boolean, default: false },
});
const props = useDefaults(_props, "ArrangementNotificationListItem");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("ArrangementNotificationListItem");
const { cachedSites } = fetchSiteComposable;
const { formatDate } = useDateUtil();
const { message } = useMessage(props);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalNotification = reactive(new ArrangementNotification());

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.notification,
  (newVal) => {
    internalNotification.initialize(newVal);
  },
  { immediate: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const title = computed(() => {
  const dateString = formatDate(
    internalNotification.dateAt || new Date(),
    "YYYY年MM月DD日(ddd)",
  );
  return `${dateString}`;
});

const site = computed(() => {
  return cachedSites.value?.[internalNotification.siteId] || null;
});

const siteName = computed(() => {
  return site.value?.name || "...loading";
});

const address = computed(() => {
  return site.value?.fullAddress || "...loading";
});

const timeRange = computed(() => {
  const startAt = internalNotification.isLeaved
    ? internalNotification.actualStartAt
    : internalNotification.startAt;
  const endAt = internalNotification.isLeaved
    ? internalNotification.actualEndAt
    : internalNotification.endAt;
  const formattedStartAt = formatDate(startAt || new Date(), "HH:mm");
  const formattedEndAt = formatDate(endAt || new Date(), "HH:mm");
  return `${formattedStartAt} - ${formattedEndAt}`;
});
</script>

<template>
  <v-list-item>
    <template #prepend>
      <v-list-item-action>
        <ShiftTypeChip
          class="me-4"
          :shift-type="internalNotification.shiftType"
          label
        />
      </v-list-item-action>
    </template>
    <v-list-item-title>
      <div class="d-flex align-center">
        <div class="d-flex flex-column">
          <div>{{ title }}</div>
          <div>{{ timeRange }}</div>
        </div>
        <div class="flex-grow-1 text-right">
          <ArrangementNotificationStatusChip
            class="ms-4"
            :status="internalNotification.status"
          />
        </div>
      </div>
    </v-list-item-title>
    <v-list-item-title class="pt-2">{{ siteName }}</v-list-item-title>
    <v-list-item-title>{{ address }}</v-list-item-title>
    <v-list-item-title v-if="props.showMessage" class="py-2">
      <v-icon class="me-2" :color="message.color" :icon="message.icon" />
      <span :class="`text-${message.color}`">{{ message.text }}</span>
    </v-list-item-title>
  </v-list-item>
</template>
