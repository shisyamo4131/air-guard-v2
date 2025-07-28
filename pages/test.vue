<script setup>
import {
  Employee,
  OperationResultDetail,
  Outsourcer,
  SiteOperationSchedule,
} from "@/schemas";
import { useFetchSite } from "@/composables/useFetchSite";
import { useFetchEmployee } from "@/composables/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/useFetchOutsourcer";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { SITE_OPERATION_SCHEDULE_STATUS_DRAFT } from "air-guard-v2-schemas/constants";

/** define use composables */
const { fetchSite, cachedSites, pushSites } = useFetchSite();
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

const editSchedule = ref(new SiteOperationSchedule());
const scheduleManager = useTemplateRef("scheduleManager");

const DAYS_COUNT = 7;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(schedules, handleSchedulesChange, { deep: true });

/*****************************************************************************
 * LIFE CYCLE HOOKS
 *****************************************************************************/
onMounted(async () => {
  /** fetch all active employees for selector */
  await fetchEmployees();
  /** fetch all outsourcers for selector */
  await fetchOutsourcers();
  schedules.value = scheduleInstance.subscribeDocs();
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function onClickEdit(schedule) {
  editSchedule.value = schedule.clone();
  scheduleManager.value.toUpdate();
}

/**
 * Handle changes in schedules and fetch related employee and outsourcer data.
 * @param {Array} newSchedules - Updated schedules array
 */
function handleSchedulesChange(newSchedules) {
  if (!Array.isArray(newSchedules) || newSchedules.length === 0) {
    return;
  }

  const allSites = newSchedules.map((schedule) => schedule.siteId);
  const allEmployees = newSchedules.flatMap((schedule) =>
    Array.isArray(schedule.employees) ? schedule.employees : []
  );
  const allOutsourcers = newSchedules.flatMap((schedule) =>
    Array.isArray(schedule.outsourcers) ? schedule.outsourcers : []
  );

  if (allSites.length > 0) fetchSite(allSites);
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
      :cached-sites="cachedSites"
      :day-count="DAYS_COUNT"
      @click:edit="onClickEdit"
    />

    <!-- スケジュール編集ダイアログ -->
    <ItemManager
      ref="scheduleManager"
      :input-props="{
        excludedKeys: ['status', 'employees', 'outsourcers'],
      }"
      :model="editSchedule"
      :dialog-props="{ maxWidth: 600 }"
      v-slot="slotProps"
    >
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesEditCard
          v-bind="slotProps.editorProps"
          :disable-delete="
            slotProps.item.status !== SITE_OPERATION_SCHEDULE_STATUS_DRAFT
          "
          :disable-submit="
            slotProps.item.status !== SITE_OPERATION_SCHEDULE_STATUS_DRAFT
          "
        >
          <template #header>
            <v-alert
              v-if="
                slotProps.item.status !== SITE_OPERATION_SCHEDULE_STATUS_DRAFT
              "
              color="info"
              variant="outlined"
              class="mb-4"
              density="compact"
              >確定された現場稼働予定であるため編集・削除できません。</v-alert
            >
          </template>
          <template #default>
            <air-item-input v-bind="slotProps.inputProps">
              <template #dateAt="{ attrs }">
                <air-date-input
                  v-bind="attrs"
                  @update:modelValue="
                    slotProps.updateProperties({ dayType: getDayType($event) })
                  "
                />
              </template>
              <template #after-dateAt>
                <v-col cols="12">
                  <MoleculesAgreementSelector
                    :items="
                      cachedSites[slotProps.item.siteId]?.agreements || []
                    "
                    @select="
                      $event.dateAt = slotProps.item.dateAt;
                      slotProps.updateProperties($event);
                    "
                  >
                    <template #activator="{ props: activatorProps }">
                      <v-btn v-bind="activatorProps" block color="primary"
                        >取極めから複製</v-btn
                      >
                    </template>
                  </MoleculesAgreementSelector>
                </v-col>
              </template>
            </air-item-input>
          </template>
        </MoleculesEditCard>
      </v-dialog>
    </ItemManager>
  </div>
</template>

<style scoped>
/* 必要に応じて追加のスタイルをここに記述 */
</style>
