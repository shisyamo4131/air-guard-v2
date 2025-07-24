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

/** define refs for floating window */
const showEmployeeWindow = ref(false);
const employeeWindowPosition = ref({ x: 200, y: 100 });
const workerTabs = ref([
  { label: "従業員", key: "employees" },
  { label: "外注先", key: "outsourcers" },
]);
const activeWorkerTab = ref(0);

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

/**
 * Toggle employee selection window
 */
function toggleEmployeeWindow(event) {
  if (!showEmployeeWindow.value) {
    // ウィンドウを開く時は、クリック位置を初期位置として設定
    const rect = event.target.getBoundingClientRect();
    const windowWidth = 280; // FloatingWindowのwidth
    const windowHeight = 400; // FloatingWindowのheight

    let x = event.clientX || rect.left;
    let y = (event.clientY || rect.bottom) + 10;

    // 画面の境界チェック
    if (x + windowWidth > window.innerWidth) {
      x = window.innerWidth - windowWidth - 20;
    }
    if (y + windowHeight > window.innerHeight) {
      y = window.innerHeight - windowHeight - 20;
    }
    if (x < 0) x = 20;
    if (y < 0) y = 20;

    employeeWindowPosition.value = { x, y };
  }
  showEmployeeWindow.value = !showEmployeeWindow.value;
}

/**
 * Handle window position change
 */
function onWindowMove(newPosition) {
  employeeWindowPosition.value = newPosition;
}
</script>

<template>
  <div>
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
    </v-toolbar>
    <v-container class="fill-height" fluid>
      <v-row class="fill-height justify-center">
        <v-col cols="8">
          <ArrangementsDraggableCell
            v-for="schedule in schedules"
            :key="schedule.docId"
            :schedule="schedule"
            :cached-employees="cachedEmployees"
            :cached-outsourcers="cachedOutsourcers"
          />
        </v-col>
      </v-row>

      <!-- フローティング作業員選択ウィンドウ -->
      <MoleculesFloatingWindow
        :is-visible="showEmployeeWindow"
        title="作業員選択"
        :initial-x="employeeWindowPosition.x"
        :initial-y="employeeWindowPosition.y"
        @close="showEmployeeWindow = false"
        @move="onWindowMove"
      >
        <div class="fill-height d-flex flex-column">
          <!-- タブナビゲーション -->
          <v-tabs v-model="activeWorkerTab" class="flex-shrink-0" grow>
            <v-tab
              v-for="(tab, index) in workerTabs"
              :key="index"
              :value="index"
            >
              {{ tab.label }}
            </v-tab>
          </v-tabs>

          <!-- タブコンテンツ -->
          <v-window v-model="activeWorkerTab" class="fill-height">
            <!-- 従業員タブ -->
            <v-window-item :value="0" class="fill-height">
              <div class="pa-2 fill-height">
                <draggable
                  :model-value="employees"
                  tag="div"
                  class="fill-height overflow-y-auto"
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
              </div>
            </v-window-item>

            <!-- 外注先タブ -->
            <v-window-item :value="1" class="fill-height">
              <div class="pa-2 fill-height">
                <draggable
                  :model-value="outsourcers"
                  tag="div"
                  class="fill-height overflow-y-auto"
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
              </div>
            </v-window-item>
          </v-window>
        </div>
      </MoleculesFloatingWindow>
    </v-container>
  </div>
</template>
