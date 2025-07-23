<script setup>
import {
  Employee,
  OperationResultDetail,
  Outsourcer,
  SiteOperationSchedule,
} from "@/schemas";
import draggable from "vuedraggable";
import { useFetchEmployee } from "@/composables/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/useFetchOutsourcer";

/** define use composables */
const { fetchEmployee, cachedEmployees } = useFetchEmployee();
const { fetchOutsourcer, cachedOutsourcers } = useFetchOutsourcer();

/** define instances */
const employeeInstance = new Employee();
const scheduleInstance = reactive(new SiteOperationSchedule());

/** define refs for vue-draggable */
const schedules = ref([]);
const employees = ref([]);
const outsourcers = ref([]);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(employees, (newVal) => fetchEmployee(newVal), { deep: true });
watch(outsourcers, (newVal) => fetchOutsourcer(newVal), { deep: true });
watch(schedules, (newVal) => fetchEmployee(newVal.employees), { deep: true });

/*****************************************************************************
 * LIFE CYCLE HOOKS
 *****************************************************************************/
onMounted(async () => {
  employees.value = (await employeeInstance.fetchDocs()).map(
    (doc) =>
      new OperationResultDetail({ workerId: doc.docId, isEmployee: true })
  );
  schedules.value = scheduleInstance.subscribeDocs();
  outsourcers.value = (await new Outsourcer().fetchDocs()).map(
    (doc) =>
      new OperationResultDetail({ workerId: doc.docId, isEmployee: false })
  );
});
</script>

<template>
  <v-container class="fill-height">
    <v-row class="fill-height">
      <v-col cols="4" class="d-flex flex-column fill-height">
        <draggable
          :model-value="employees"
          tag="div"
          class="flex-grow-1 overflow-y-auto"
          item-key="workerId"
          :group="{ name: 'workers', pull: 'clone', put: false }"
          :sort="false"
        >
          <template #item="{ element }">
            <ArrangementsTag
              v-bind="element"
              :label="cachedEmployees[element.workerId]?.fullName"
            />
          </template>
        </draggable>
      </v-col>
      <v-col cols="4">
        <v-card v-for="schedule in schedules" :key="schedule.docId">
          <v-card-title>
            {{ schedule.docId }}
          </v-card-title>
          <v-container>
            <ArrangementsDraggableCell
              :schedule="schedule"
              :cached-employees="cachedEmployees"
              :cached-outsourcers="cachedOutsourcers"
            />
          </v-container>
        </v-card>
      </v-col>
      <v-col cols="4" class="d-flex flex-column fill-height">
        <draggable
          :model-value="outsourcers"
          tag="div"
          class="flex-grow-1 overflow-y-auto"
          item-key="workerId"
          :group="{ name: 'workers', pull: 'clone', put: false }"
          :sort="false"
        >
          <template #item="{ element }">
            <ArrangementsTag
              v-bind="element"
              :label="cachedOutsourcers[element.workerId]?.abbr"
            />
          </template>
        </draggable>
      </v-col>
    </v-row>
  </v-container>
</template>
