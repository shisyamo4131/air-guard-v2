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
const { ui } = useIndex();
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
      <div class="fill-height overflow-y-auto">
        <v-list v-bind="ui.employeesList" />
      </div>
      <DailyAttendanceCalendar v-bind="ui.calendar" />
      <v-card width="360">
        <v-card-text>ここに勤怠サマリー</v-card-text>
      </v-card>
    </div>
  </v-card>
</template>
