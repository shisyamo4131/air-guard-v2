<script setup>
import { provide, computed, useTemplateRef, watch } from "vue";
import dayjs from "dayjs";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
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

/** フローティング作業員選択ウィンドウ用のコンポーザブル */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

const managerComposable = useSiteOperationScheduleManager({
  manager: scheduleManager,
});

const {
  currentFrom,
  currentTo,
  cached,
  docs: schedules,
  workers,
  statistics,
  initialize,
  toUpdate: toUpdateSchedule,
  itemManagerAttrs,
} = managerComposable;

/** provide composable to child components */
provide("scheduleManagerComposable", managerComposable);

/** パフォーマンス統計 */
const performanceStats = computed(() => {
  return {
    memoryUsage: memoryMonitor.getMemoryUsagePercentage.value,
    memoryInfo: memoryMonitor.memoryInfo.value,
    workerStats: statistics.value,
    scheduleCount: schedules.value?.length || 0,
  };
});

/***************************************************************************
 * WATCHERS
 ***************************************************************************/
watch(
  () => debouncedDateRange.debouncedValue,
  (newRange) => {
    if (newRange) {
      initialize({
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

const dateRangeLabel = computed(() => {
  const from = dayjs(currentFrom.value).format("YYYY/MM/DD");
  const to = dayjs(currentTo.value).format("YYYY/MM/DD");
  return `${from} - ${to}`;
});
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- パフォーマンス情報 (開発モード時のみ) -->
    <v-toolbar v-if="isDev" density="compact">
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
      <v-chip size="small" variant="outlined">
        Workers: {{ performanceStats.workerStats.totalWorkers }}
      </v-chip>
      <v-chip size="small" variant="outlined">
        Schedules: {{ performanceStats.scheduleCount }}
      </v-chip>
    </v-toolbar>
    <v-toolbar density="comfortable">
      <v-toolbar-title>配置管理（{{ dateRangeLabel }}）</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        @click="toggleFloatingWindow"
        :color="floatingWindowAttrs.isVisible ? 'primary' : 'default'"
      >
        <v-icon>mdi-account-group</v-icon>
      </v-btn>

      <!-- フローティング作業員選択ウィンドウ -->
      <ArrangementsWorkerSelector
        v-bind="floatingWindowAttrs"
        :employees="workers.employees"
        :outsourcers="workers.outsourcers"
        :cached-employees="cached.employees"
        :cached-outsourcers="cached.outsourcers"
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
          :agreements="cached.sites[inputProps.item.siteId]?.agreements || []"
        />
      </template>
    </ItemManager>
  </div>
</template>

<style scoped>
/* 必要に応じて追加のスタイルをここに記述 */
</style>
