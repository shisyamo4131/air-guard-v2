<script setup>
import { Employee, SiteOperationSchedule } from "@/schemas";
import draggable from "vuedraggable";
import { useFetchEmployee } from "@/composables/useFetchEmployee";

/** define use composables */
const { fetchEmployee, cachedEmployees } = useFetchEmployee();

/** define instances */
const employeeInstance = new Employee();
const scheduleInstance = reactive(new SiteOperationSchedule());

/** define refs for vue-draggable */
const employees = ref([]);
const schedules = ref([]);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(employees, (newVal) => fetchEmployee(newVal), { deep: true });
watch(schedules, (newVal) => fetchEmployee(newVal.employees), { deep: true });

/*****************************************************************************
 * LIFE CYCLE HOOKS
 *****************************************************************************/
onMounted(async () => {
  employees.value = await employeeInstance.fetchDocs();
  schedules.value = scheduleInstance.subscribeDocs();
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleChange(event, schedule) {
  if (event.added) {
    console.log("added:", event.added.element);
    schedule.addEmployee(event.added.element);
  } else if (event.removed) {
    console.log("removed:", event.removed.element);
    schedule.removeEmployee(event.removed.element.employeeId);
  } else if (event.moved) {
    console.log("moved:", event.moved.element);
    schedule.changeEmployee(event.moved.oldIndex, event.moved.newIndex);
  }
  schedule.update();
}
</script>

<template>
  <v-container class="fill-height">
    <v-row class="fill-height">
      <v-col cols="4" class="d-flex flex-column fill-height">
        <draggable
          :model-value="employees"
          tag="div"
          class="flex-grow-1 overflow-y-auto"
          item-key="docId"
          :group="{ name: 'employees', pull: 'clone', put: false }"
          :sort="false"
          :clone="(item) => item.docId"
        >
          <template #item="{ element }">
            <v-list-item>{{ element.fullName }}</v-list-item>
          </template>
        </draggable>
      </v-col>
      <v-col cols="4">
        <v-card v-for="schedule in schedules" :key="schedule.docId">
          <v-card-title>
            {{ schedule.docId }}
          </v-card-title>
          <v-container>
            <draggable
              class="px-2 pt-2"
              :model-value="schedule.employees"
              key="employeeId"
              tag="div"
              item-key="employeeId"
              style="border: 1px solid grey; min-height: 24px"
              group="employees"
              @change="handleChange($event, schedule)"
            >
              <template #item="{ element }">
                <v-list-item class="mb-2" rounded variant="outlined">
                  <v-list-item-title class="text-subtitle-2">
                    <v-icon color="red">mdi-new-box</v-icon>
                    {{ cachedEmployees[element.employeeId]?.fullName || "N/A" }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption text-no-wrap">
                    {{ `${element.startTime} - ${element.endTime}` }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-list-item-action class="mr-2">
                      <v-chip size="x-small" label>上番済</v-chip>
                    </v-list-item-action>
                    <v-list-item-action>
                      <v-icon
                        size="small"
                        @click="schedule.removeEmployee(element.employeeId)"
                        >mdi-close</v-icon
                      >
                    </v-list-item-action>
                  </template>
                </v-list-item>
              </template>
            </draggable>
          </v-container>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
