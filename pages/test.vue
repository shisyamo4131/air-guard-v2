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
const { fetchEmployee, cachedEmployees, pushEmployees } = useFetchEmployee();
const { fetchOutsourcer, cachedOutsourcers, pushOutsourcers } =
  useFetchOutsourcer();

/** define instances */
const employeeInstance = new Employee();
const scheduleInstance = reactive(new SiteOperationSchedule());
const outsourcerInstance = new Outsourcer();

/** define refs for vue-draggable */
const schedules = ref([]);
const employees = ref([]);
const outsourcers = ref([]);

/** define constants */
const onlyActive = ref(true);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(employees, fetchEmployee, { deep: true });
watch(outsourcers, fetchOutsourcer, { deep: true });
watch(schedules, handleSchedulesChange, { deep: true });
watch(onlyActive, fetchEmployees);

/*****************************************************************************
 * LIFE CYCLE HOOKS
 *****************************************************************************/
onMounted(async () => {
  await fetchEmployees();
  await fetchOutsourcers();
  schedules.value = scheduleInstance.subscribeDocs();
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Handle changes in schedules and fetch related employee data
 * useFetchEmployeeコンポーザブルが効率的なキャッシュとバッチ処理を行うため、
 * 単純にemployeesの配列をそのまま渡すことで最適化される
 * @param {Array} newSchedules - Updated schedules array
 */
function handleSchedulesChange(newSchedules) {
  if (!Array.isArray(newSchedules) || newSchedules.length === 0) {
    return;
  }

  // schedulesからemployeesを直接抽出してfetchEmployeeに渡す
  // useFetchEmployeeが重複排除とキャッシュチェックを自動で行う
  const allEmployees = newSchedules.flatMap((schedule) =>
    Array.isArray(schedule.employees) ? schedule.employees : []
  );

  // fetchEmployeeは内部でworkerIdを自動抽出し、キャッシュ済みは除外する
  if (allEmployees.length > 0) {
    fetchEmployee(allEmployees);
  }
}

/**
 * Fetch employee documents and set them to the employees ref.
 * Employee documents are converted to OperationResultDetail instances.
 * @returns {Promise<void>}
 */
async function fetchEmployees() {
  let fetchResult = onlyActive.value
    ? await employeeInstance.fetchDocs({
        constraints: [["where", "employmentStatus", "==", "ACTIVE"]],
      })
    : await employeeInstance.fetchDocs();
  pushEmployees(fetchResult); // コンポーザブルにキャッシュさせる
  employees.value = fetchResult.map(
    (doc) =>
      new OperationResultDetail({ workerId: doc.docId, isEmployee: true })
  );
}

/**
 * Fetch outsourcer documents and set them to the outsourcers ref.
 * Outsourcer documents are converted to OperationResultDetail instances.
 */
async function fetchOutsourcers() {
  const fetchResult = await outsourcerInstance.fetchDocs();
  pushOutsourcers(fetchResult); // コンポーザブルにキャッシュさせる
  outsourcers.value = fetchResult.map(
    (doc) =>
      new OperationResultDetail({ workerId: doc.docId, isEmployee: false })
  );
}
</script>

<template>
  <v-container class="fill-height">
    <v-row class="fill-height">
      <v-col cols="4" class="fill-height">
        <v-card class="fill-height">
          <v-card-text class="d-flex flex-column fill-height">
            <air-checkbox
              v-model="onlyActive"
              label="在職中のみ"
              density="compact"
            />
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
                  :cached-employees="cachedEmployees"
                />
              </template>
            </draggable>
          </v-card-text>
        </v-card>
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
              :cached-outsourcers="cachedOutsourcers"
            />
          </template>
        </draggable>
      </v-col>
    </v-row>
  </v-container>
</template>
