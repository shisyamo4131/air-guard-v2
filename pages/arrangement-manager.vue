<script setup>
import { provide, useTemplateRef } from "vue";
import dayjs from "dayjs";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";

/** define template refs */
const scheduleManager = useTemplateRef("scheduleManager");

/** フローティング作業員選択ウィンドウ用のコンポーザブル */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/** define manager composable */
const managerComposable = useSiteOperationSchedulesManager({
  manager: scheduleManager,
  from: dayjs().subtract(1, "day").toDate(),
});

const {
  cachedData,
  dayCount,
  toUpdate: toUpdateSchedule,
  itemManagerAttrs,
  workerSelectorAttrs,
  getWorkerName,
} = managerComposable;

/** provide composable to child components */
provide("scheduleManagerComposable", managerComposable);
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <ArrangementsToolbar
      v-model="dayCount"
      @click:workers="toggleFloatingWindow"
    />

    <!-- フローティング作業員選択ウィンドウ -->
    <MoleculesFloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <ArrangementsWorkerSelector v-bind="workerSelectorAttrs">
        <template #default="{ worker }">
          <MoleculesTagBase :label="getWorkerName(worker)" />
        </template>
      </ArrangementsWorkerSelector>
    </MoleculesFloatingWindow>

    <!-- スケジュール管理テーブル -->
    <ArrangementsScheduleTable @click:edit="toUpdateSchedule" />

    <!-- スケジュール編集ダイアログ -->
    <ItemManager ref="scheduleManager" v-bind="itemManagerAttrs">
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
