<script setup>
import { SiteOperationSchedule } from "@/schemas";
import { useOperationGenerator } from "@/composables/application/operation/useOperationGenerator";
import { useMessagesStore } from "@/stores/useMessagesStore";
import List from "./List.vue";
import Detail from "./Detail.vue";
const props = defineProps({ siteOperationSchedules: { type: Array, default: () => [], validator: (items) => items.every((item) => item instanceof SiteOperationSchedule) } });
const selectedSchedule = ref(null), messages = useMessagesStore();
const generator = useOperationGenerator(selectedSchedule);
const notifications = generator.notifications;
const notificationsMap = computed(() => Object.fromEntries(notifications.value.map((item) => [item.docId, item])));
const sortedSchedules = computed(() => [...props.siteOperationSchedules].sort((a, b) => a.date.localeCompare(b.date) || a.shiftType.localeCompare(b.shiftType)));
async function convert() { if (await generator.convert()) messages.add("上下番を確定しました。"); }
provide("selectedSchedule", selectedSchedule);
provide("notifications", notifications);
provide("notificationsMap", notificationsMap);
</script>
<template>
  <SiteOperationSchedulesManager :docs="sortedSchedules">
    <template #table="{ items }">
      <div class="d-flex flex-column fill-height ga-2">
        <v-alert v-if="generator.error.value" type="warning">{{ generator.error.value }}</v-alert>
        <v-btn v-if="selectedSchedule" :disabled="generator.busy.value || generator.preparing.value || generator.uncertain.value" aria-label="上下番情報を再読込" @click="generator.prepare">再読込</v-btn>
        <div class="d-flex flex-grow-1 ga-2">
          <List class="fill-height" :items="items" />
          <Detail class="fill-height" :loading="!generator.ready.value" @click:submit="convert" />
        </div>
      </div>
    </template>
  </SiteOperationSchedulesManager>
</template>
