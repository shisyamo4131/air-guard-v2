<script setup>
import { provide, computed, useTemplateRef } from "vue";
import dayjs from "dayjs";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useMemoryMonitor } from "@/composables/usePerformanceOptimization";

/** 開発環境の判定 */
const isDev = process.env.NODE_ENV === "development";

/** define template refs */
const scheduleManager = useTemplateRef("scheduleManager");

/** メモリ監視機能 */
const memoryMonitor = useMemoryMonitor();
const memoryMonitorId = memoryMonitor.startMonitoring(10000); // 10秒間隔

/** フローティング作業員選択ウィンドウ用のコンポーザブル */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/** define manager composable */
const managerComposable = useSiteOperationScheduleManager({
  manager: scheduleManager,
  from: dayjs().subtract(1, "day").toDate(),
});

const {
  cachedData,
  dateRange,
  docs: schedules,
  workers,
  statistics,
  setDayCount,
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
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- パフォーマンス情報 (開発モード時のみ) -->
    <!-- <v-toolbar v-if="isDev" density="compact">
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
    </v-toolbar> -->
    <v-toolbar density="comfortable" :title="`配置管理`">
      <template #append>
        <v-spacer />
        <v-btn
          prepend-icon="mdi-account-group"
          @click="toggleFloatingWindow"
          :color="floatingWindowAttrs.isVisible ? 'primary' : 'default'"
        >
          作業員
        </v-btn>
        <air-select
          width="120"
          :model-value="dateRange.dayCount"
          label="表示日数"
          hide-details
          density="compact"
          :items="[
            { title: '7日間', value: 7 },
            { title: '14日間', value: 14 },
          ]"
          @update:model-value="setDayCount"
        />
      </template>
    </v-toolbar>

    <!-- フローティング作業員選択ウィンドウ -->
    <ArrangementsWorkerSelector
      v-bind="floatingWindowAttrs"
      :employees="workers.employees"
      :outsourcers="workers.outsourcers"
      :cached-employees="cachedData.employees"
      :cached-outsourcers="cachedData.outsourcers"
    />

    <!-- スケジュール管理テーブル -->
    <ArrangementsScheduleTable @click:edit="toUpdateSchedule" />

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
          :agreements="
            cachedData.sites[inputProps.item.siteId]?.agreements || []
          "
        />
      </template>
    </ItemManager>
  </div>
</template>

<style scoped>
/* 必要に応じて追加のスタイルをここに記述 */
</style>
