<script setup>
/*****************************************************************************
 * @file ./components/DailyAttendance/Index/index.vue
 * @description 従業員別勤怠情報確認コンポーネント
 *****************************************************************************/
import { useIndex } from "./useIndex";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "DailyAttendanceIndex", inheritAttrs: false });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { ui, statistics } = useIndex();
</script>

<template>
  <v-card v-bind="$attrs" class="d-flex flex-column" :border="false" tile>
    <v-toolbar v-bind="ui.toolbar">
      <!-- <div class="px-4">
        <EmployeeSelect v-bind="ui.employeeSelect" />
      </div>
      <v-spacer /> -->
      <MoleculesMonthSelector v-bind="ui.monthSelector" />
    </v-toolbar>
    <div class="d-flex flex-grow-1 overflow-hidden">
      <v-card
        class="fill-height overflow-y-auto"
        :border="false"
        width="360"
        tile
      >
        <v-list v-bind="ui.employeesList" />
      </v-card>
      <DailyAttendanceCalendar v-bind="ui.calendar" />
      <v-card class="flex-shrink-0 overflow-y-auto" tile width="420">
        <v-card-title>勤怠サマリー</v-card-title>

        <template v-if="statistics">
          <DailyAttendanceStatisticsList
            density="compact"
            :statistics="statistics"
          />

          <v-divider />

          <v-card-subtitle class="pt-4">勤務区分別</v-card-subtitle>
          <DailyAttendanceStatisticsTable
            density="compact"
            :statistics="statistics"
          />

          <v-alert
            v-if="statistics.unexportableAttendanceCount > 0"
            class="ma-3"
            density="compact"
            type="warning"
            variant="tonal"
          >
            エクスポートできない勤怠が
            {{ statistics.unexportableAttendanceCount }}件あります。
          </v-alert>
        </template>

        <v-card-text v-else class="text-medium-emphasis">
          従業員が未選択であるか、勤怠情報がありません。
        </v-card-text>
      </v-card>
    </div>
  </v-card>
</template>
