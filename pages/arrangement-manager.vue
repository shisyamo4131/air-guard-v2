<script setup>
import { onMounted, provide, useTemplateRef } from "vue";
import dayjs from "dayjs";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useWorkersList } from "@/composables/useWorkersList";

import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";

/** define template refs */
const scheduleManager = useTemplateRef("scheduleManager");

/** フローティング作業員選択ウィンドウ用のコンポーザブル */
const { attrs: floatingWindowAttrs, toggle: toggleFloatingWindow } =
  useFloatingWindow();

/** define composables */
// for fetching and caching employees.
const fetchEmployeeComposable = useFetchEmployee();
// for fetching and caching outsourcers.
const fetchOutsourcerComposable = useFetchOutsourcer();
// for providing a list of workers using `fetchEmployeeComposable` and `fetchOutsourcerComposable`.
const {
  availableEmployees,
  availableOutsourcers,
  initialize: initWorkers,
} = useWorkersList({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
});

const managerComposable = useSiteOperationSchedulesManager({
  manager: scheduleManager,
  from: dayjs().subtract(1, "day").toDate(),
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
});

const {
  cachedData,
  dayCount,
  toUpdate: toUpdateSchedule,
  itemManagerAttrs,
} = managerComposable;

/** provide composable to child components */
provide("scheduleManagerComposable", managerComposable);

onMounted(() => {
  // Initialize the workers list when the component is mounted.
  initWorkers();
});
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <ArrangementsToolbar
      v-model="dayCount"
      @click:workers="toggleFloatingWindow"
    />

    <!-- フローティング作業員選択ウィンドウ -->
    <MoleculesFloatingWindow v-bind="floatingWindowAttrs" title="作業員選択">
      <MoleculesWorkerSelector
        :employees="availableEmployees"
        :outsourcers="availableOutsourcers"
      >
        <template #employee="{ rawElement }">
          <MoleculesTagBase :label="rawElement.displayName" />
        </template>
        <template #outsourcer="{ rawElement }">
          <MoleculesTagBase :label="rawElement.displayName" />
        </template>
      </MoleculesWorkerSelector>
    </MoleculesFloatingWindow>

    <!-- スケジュール管理テーブル -->
    <ArrangementsTable @click:edit="toUpdateSchedule" />

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
