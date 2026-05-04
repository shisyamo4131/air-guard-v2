<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/ListItem/index.vue
 * @description A component for displaying a single `ArrangementNotification`.
 * @extends VListItem
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useDateUtil } from "@/composables/useDateUtil";
import { useConstants } from "@/composables/useConstants";
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
const { SHIFT_TYPE } = useConstants();
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

const siteName = computed(() => {
  // const site = props.cachedSites?.[internalNotification.siteId] || "...loading";
  const site = cachedSites.value?.[internalNotification.siteId] || "...loading";
  return `${site.name}`;
});

const address = computed(() => {
  // const site = props.cachedSites?.[internalNotification.siteId];
  const site = cachedSites.value?.[internalNotification.siteId];
  return site ? `${site.fullAddress}` : "...loading";
});

const timeRange = computed(() => {
  const shiftTypeString =
    SHIFT_TYPE.value?.[internalNotification.shiftType]?.title || "N/A";
  const startAt = formatDate(
    internalNotification.startAt || new Date(),
    "HH:mm",
  );
  const endAt = formatDate(internalNotification.endAt || new Date(), "HH:mm");
  return `${shiftTypeString} ${startAt} - ${endAt}`;
});
</script>

<template>
  <v-list-item>
    <template v-if="showStatus" #prepend>
      <v-list-item-action>
        <ArrangementNotificationStatusChip
          class="me-4"
          :status="internalNotification.status"
          size="x-small"
        />
      </v-list-item-action>
    </template>
    <v-list-item-title>{{ title }}</v-list-item-title>
    <v-list-item-title>{{ timeRange }}</v-list-item-title>
    <v-list-item-subtitle>{{ siteName }}</v-list-item-subtitle>
    <v-list-item-subtitle>{{ address }}</v-list-item-subtitle>
    <v-list-item-title v-if="props.showMessage" class="py-2">
      <v-icon class="me-2" :color="message.color" :icon="message.icon" />
      <span :class="`text-${message.color}`">{{ message.text }}</span>
    </v-list-item-title>
  </v-list-item>
</template>
