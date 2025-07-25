<script setup>
import {
  Employee,
  OperationResultDetail,
  Outsourcer,
  SiteOperationSchedule,
} from "@/schemas";
import { useFetchEmployee } from "@/composables/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/useFetchOutsourcer";
import { useFloatingWindow } from "@/composables/useFloatingWindow";

/** define use composables */
const { fetchEmployee, cachedEmployees, pushEmployees } = useFetchEmployee();
const { fetchOutsourcer, cachedOutsourcers, pushOutsourcers } =
  useFetchOutsourcer();
const {
  isVisible: showEmployeeWindow,
  position: employeeWindowPosition,
  toggle: toggleEmployeeWindow,
  close: closeEmployeeWindow,
  updatePosition: onWindowMove,
} = useFloatingWindow();

/** define instances */
const employeeInstance = new Employee();
const scheduleInstance = reactive(new SiteOperationSchedule());
const outsourcerInstance = new Outsourcer();

/** define refs for vue-draggable */
const schedules = ref([]);
const employees = ref([]);
const outsourcers = ref([]);

const DAYS_COUNT = 7;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(schedules, handleSchedulesChange, { deep: true });

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
 * Handle changes in schedules and fetch related employee and outsourcer data.
 * @param {Array} newSchedules - Updated schedules array
 */
function handleSchedulesChange(newSchedules) {
  if (!Array.isArray(newSchedules) || newSchedules.length === 0) {
    return;
  }

  const allEmployees = newSchedules.flatMap((schedule) =>
    Array.isArray(schedule.employees) ? schedule.employees : []
  );

  const allOutsourcers = newSchedules.flatMap((schedule) =>
    Array.isArray(schedule.outsourcers) ? schedule.outsourcers : []
  );

  if (allEmployees.length > 0) fetchEmployee(allEmployees);
  if (allOutsourcers.length > 0) fetchOutsourcer(allOutsourcers);
}

/**
 * Fetch employee documents and set them to the employees ref.
 * Employee documents are converted to OperationResultDetail instances.
 * @returns {Promise<void>}
 */
async function fetchEmployees() {
  let fetchResult = await employeeInstance.fetchDocs({
    constraints: [["where", "employmentStatus", "==", "ACTIVE"]],
  });
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
  <div class="d-flex flex-column fill-height">
    <v-toolbar density="comfortable">
      <v-toolbar-title>配置管理</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        @click="toggleEmployeeWindow($event)"
        :color="showEmployeeWindow ? 'primary' : 'default'"
      >
        <v-icon>mdi-account-group</v-icon>
      </v-btn>

      <!-- フローティング作業員選択ウィンドウ -->
      <ArrangementsWorkerSelector
        :is-visible="showEmployeeWindow"
        :initial-x="employeeWindowPosition.x"
        :initial-y="employeeWindowPosition.y"
        :employees="employees"
        :outsourcers="outsourcers"
        :cached-employees="cachedEmployees"
        :cached-outsourcers="cachedOutsourcers"
        @close="closeEmployeeWindow"
        @move="onWindowMove"
      />
    </v-toolbar>

    <!-- スケジュール管理テーブル -->
    <ArrangementsScheduleTable
      :schedules="schedules"
      :cached-employees="cachedEmployees"
      :cached-outsourcers="cachedOutsourcers"
      :day-count="DAYS_COUNT"
    />
  </div>
</template>

<style scoped>
/* 必要に応じて追加のスタイルをここに記述 */
</style>
