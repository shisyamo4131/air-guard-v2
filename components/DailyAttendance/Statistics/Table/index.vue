<script setup>
/*****************************************************************************
 * @file ./components/DailyAttendance/Statistics/Table/index.vue
 * @description 従業員別勤怠統計を勤務区分別にテーブル表示します。
 *****************************************************************************/
import { useConstants } from "@/composables/useConstants";
import { formatAttendanceMinutes } from "@/utils/attendance/formatAttendanceMinutes";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "DailyAttendanceStatisticsTable",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  statistics: {
    type: Object,
    default: null,
  },
});

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { SHIFT_TYPE } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const items = computed(() => {
  const byShiftType = props.statistics?.byShiftType;
  if (!(byShiftType instanceof Map)) return [];

  return Array.from(byShiftType, ([shiftType, statistics]) => ({
    shiftType,
    shiftTypeTitle: SHIFT_TYPE.value[shiftType]?.title ?? shiftType,
    attendanceCount: statistics.attendanceCount,
    detailCount: statistics.detailCount,
    totalWorkMinutes: formatAttendanceMinutes(statistics.totalWorkMinutes),
    totalBreakMinutes: formatAttendanceMinutes(statistics.totalBreakMinutes),
  }));
});
</script>

<template>
  <v-table v-bind="$attrs">
    <thead>
      <tr>
        <th>区分</th>
        <th class="text-end">日数</th>
        <th class="text-end">稼働</th>
        <th class="text-end">実労働</th>
        <th class="text-end">休憩</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.shiftType">
        <td>{{ item.shiftTypeTitle }}</td>
        <td class="text-end">{{ item.attendanceCount }}</td>
        <td class="text-end">{{ item.detailCount }}</td>
        <td class="text-end">{{ item.totalWorkMinutes }}</td>
        <td class="text-end">{{ item.totalBreakMinutes }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
