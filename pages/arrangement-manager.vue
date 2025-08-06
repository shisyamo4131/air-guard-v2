<script setup>
import { provide, useTemplateRef } from "vue";
import dayjs from "dayjs";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";

/** define template refs */
const scheduleManager = useTemplateRef("scheduleManager");

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
  workers,
  dayCount,
  toUpdate: toUpdateSchedule,
  itemManagerAttrs,
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
