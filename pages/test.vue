<script setup>
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import dayjs from "dayjs";

const DAYS_COUNT = 7;

/** define use composables */
const {
  isVisible: showEmployeeWindow,
  position: employeeWindowPosition,
  toggle: toggleEmployeeWindow,
  close: closeEmployeeWindow,
  updatePosition: onWindowMove,
} = useFloatingWindow();

const scheduleManager = useTemplateRef("scheduleManager");
const {
  selectableEmployees: employees,
  selectableOutsourcers: outsourcers,
  cachedEmployees,
  cachedOutsourcers,
  cachedSites,
  docs: schedules,
  initialize: initializeSchedules,
  toUpdate: toUpdateSchedule,
  itemManager,
} = useSiteOperationScheduleManager({ manager: scheduleManager });

watch(
  () => DAYS_COUNT,
  () => {
    const from = dayjs();
    const to = dayjs().add(DAYS_COUNT - 1, "day");
    initializeSchedules({ from: from.toDate(), to: to.toDate() });
  },
  { immediate: true }
);
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
      @click:edit="toUpdateSchedule"
    />

    <!-- スケジュール編集ダイアログ -->
    <ItemManager
      ref="scheduleManager"
      :input-props="{
        excludedKeys: ['status', 'employees', 'outsourcers'],
      }"
      v-bind="itemManager"
      :dialog-props="{ maxWidth: 600 }"
      v-slot="slotProps"
    >
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesSiteOperationScheduleEditor
          v-bind="slotProps.editorProps"
          :agreements="cachedSites[slotProps.item.siteId]?.agreements || []"
        />
      </v-dialog>
    </ItemManager>
  </div>
</template>

<style scoped>
/* 必要に応じて追加のスタイルをここに記述 */
</style>
