<script setup>
/*****************************************************************************
 * @file ./components/Workers/Table/index.vue
 * @description A table component to display `workers` information.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { OperationDetail, ArrangementNotification } from "@/schemas";
import Tr from "./Tr.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  arrangementNotifications: {
    type: Array,
    default: () => [],
    validator: (v) =>
      v.every((item) => item instanceof ArrangementNotification),
  },
  workers: {
    type: Array,
    default: () => [],
    validator: (v) => v.every((item) => item instanceof OperationDetail),
  },
});
const props = useDefaults(_props, "WorkersTable");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function getArrangementNotification(worker) {
  return props.arrangementNotifications.find(
    (notification) =>
      notification.workerId === worker.workerId &&
      notification.siteOperationScheduleId === worker.siteOperationScheduleId,
  );
}
</script>

<template>
  <v-table>
    <thead>
      <tr>
        <slot name="prepend-header" />
        <th>作業員名</th>
        <th>勤務時間</th>
        <th>休憩時間</th>
        <th>残業時間</th>
        <slot name="append-header" />
      </tr>
    </thead>
    <tbody>
      <Tr
        v-for="worker in props.workers"
        :key="worker.id"
        :worker="worker"
        :arrangement-notification="getArrangementNotification(worker)"
      >
        <template #prepend="slotProps">
          <slot name="prepend" v-bind="slotProps" />
        </template>
        <template #append="slotProps">
          <slot name="append" v-bind="slotProps" />
        </template>
      </Tr>
    </tbody>
  </v-table>
</template>
