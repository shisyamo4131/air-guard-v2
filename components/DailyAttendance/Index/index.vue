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
      <div class="px-4">
        <EmployeeSelect v-bind="ui.employeeSelect" />
      </div>
      <v-spacer />
      <MoleculesMonthSelector v-bind="ui.monthSelector" />
    </v-toolbar>
    <DailyAttendanceCalendar v-bind="ui.calendar" />
  </v-card>
</template>
