<script setup>
import { provide, computed, useTemplateRef, watch } from "vue";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useWorkerManager } from "@/composables/useWorkerManager";
import { useDateRange } from "@/composables/useDateRange";
import {
  useDebouncedRef,
  useMemoryMonitor,
} from "@/composables/usePerformanceOptimization";

const DAYS_COUNT = 14;

/** 開発環境の判定 */
const isDev = process.env.NODE_ENV === "development";

/** define template refs */
const scheduleManager = useTemplateRef("scheduleManager");

/** define date range management */
const dateRange = useDateRange({
  baseDate: new Date(),
  dayCount: DAYS_COUNT,
  offsetDays: -1,
});

/** デバウンス機能付きの日付範囲 */
const debouncedDateRange = useDebouncedRef(dateRange.dateRange.value, 500);

/** メモリ監視機能 */
const memoryMonitor = useMemoryMonitor();
const memoryMonitorId = memoryMonitor.startMonitoring(10000); // 10秒間隔

/** パフォーマンス統計 */
const performanceStats = computed(() => {
  return {
    memoryUsage: memoryMonitor.getMemoryUsagePercentage.value,
    memoryInfo: memoryMonitor.memoryInfo.value,
    workerStats: workerManager.statistics.value,
    scheduleCount: schedules.value?.length || 0,
  };
});

/** define worker management */
const workerManager = useWorkerManager();
const {
  employeeComposable,
  outsourcerComposable,
  cachedEmployees,
  cachedOutsourcers,
  availableEmployees: employees,
  availableOutsourcers: outsourcers,
} = workerManager;

const {
  isVisible: showEmployeeWindow,
  position: employeeWindowPosition,
  toggle: toggleEmployeeWindow,
  close: closeEmployeeWindow,
  updatePosition: onWindowMove,
} = useFloatingWindow();

const managerComposable = useSiteOperationScheduleManager({
  manager: scheduleManager,
  fetchEmployeeComposable: employeeComposable,
  fetchOutsourcerComposable: outsourcerComposable,
  from: dateRange.startDate.value,
  to: dateRange.currentDayCount.value,
});
const {
  cachedSites,
  docs: schedules,
  initialize: initializeSchedules,
  toUpdate: toUpdateSchedule,
  itemManagerAttrs,
} = managerComposable;

/** provide composable to child components */
provide("scheduleManagerComposable", managerComposable);
provide("workerManagerComposable", workerManager);

/***************************************************************************
 * WATCHERS
 ***************************************************************************/
watch(
  () => debouncedDateRange.debouncedValue,
  (newRange) => {
    if (newRange) {
      initializeSchedules({
        from: newRange.from,
        to: newRange.dayCount,
      });
    }
  }
);

// 通常の日付範囲変更の監視
watch(
  () => dateRange.dateRange.value,
  (newRange) => {
    debouncedDateRange.value.value = newRange;
  }
);
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <v-toolbar density="comfortable">
      <v-toolbar-title>配置管理</v-toolbar-title>
      <v-spacer />

      <!-- パフォーマンス情報 (開発モード時のみ) -->
      <template v-if="isDev">
        <v-chip
          size="small"
          variant="outlined"
          :color="
            performanceStats.memoryUsage > 80
              ? 'error'
              : performanceStats.memoryUsage > 60
              ? 'warning'
              : 'success'
          "
        >
          Memory: {{ performanceStats.memoryUsage.toFixed(1) }}%
        </v-chip>
        <v-spacer class="mx-2" />
        <v-chip size="small" variant="outlined">
          Workers: {{ performanceStats.workerStats.totalWorkers }}
        </v-chip>
        <v-spacer class="mx-2" />
        <v-chip size="small" variant="outlined">
          Schedules: {{ performanceStats.scheduleCount }}
        </v-chip>
        <v-spacer class="mx-2" />
      </template>

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
      :day-count="dateRange.currentDayCount.value"
      @click:edit="toUpdateSchedule"
    />

    <!-- スケジュール編集ダイアログ -->
    <ItemManager
      ref="scheduleManager"
      v-bind="itemManagerAttrs"
      :dialog-props="{ maxWidth: 600 }"
      :input-props="{
        excludedKeys: ['status', 'employees', 'outsourcers'],
      }"
    >
      <template #editor="{ editorProps, inputProps }">
        <MoleculesSiteOperationScheduleEditor
          v-bind="editorProps"
          :agreements="cachedSites[inputProps.item.siteId]?.agreements || []"
        />
      </template>
    </ItemManager>
  </div>
</template>

<style scoped>
/* 必要に応じて追加のスタイルをここに記述 */
</style>
