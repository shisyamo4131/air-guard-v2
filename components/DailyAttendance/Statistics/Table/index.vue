<script setup>
/*****************************************************************************
 * @file ./components/DailyAttendance/Statistics/Table/index.vue
 * @description 従業員別勤怠統計を勤務区分別にテーブル表示します。
 *****************************************************************************/
import { useConstants } from "@/composables/useConstants";
import { formatAttendanceMinutes } from "@/utils/attendance/formatAttendanceMinutes";
import { ATTENDANCE_MANAGEMENT_MODE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

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
  attendanceManagementMode: {
    type: String,
    default: ATTENDANCE_MANAGEMENT_MODE_VALUES.ACTUAL_DATE.value,
  },
});

const attendanceCountTitle = computed(() => {
  return props.attendanceManagementMode ===
    ATTENDANCE_MANAGEMENT_MODE_VALUES.OPERATION_DATE.value
    ? "稼働日"
    : "勤務日";
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

  const definedShiftTypes = Object.values(SHIFT_TYPE.value).map(
    ({ value }) => value,
  );
  const additionalShiftTypes = Array.from(byShiftType.keys()).filter(
    (shiftType) => !definedShiftTypes.includes(shiftType),
  );

  return [...definedShiftTypes, ...additionalShiftTypes].map((shiftType) => {
    const statistics = byShiftType.get(shiftType);

    return {
      shiftType,
      shiftTypeTitle: SHIFT_TYPE.value[shiftType]?.title ?? shiftType,
      attendanceCount: statistics?.attendanceCount ?? 0,
      detailCount: statistics?.detailCount ?? 0,
      totalWorkMinutes: formatAttendanceMinutes(
        statistics?.totalWorkMinutes ?? 0,
      ),
    };
  });
});
</script>

<template>
  <v-table v-bind="$attrs">
    <thead>
      <tr>
        <th>区分</th>
        <th class="text-end">{{ attendanceCountTitle }}</th>
        <th class="text-end">稼働</th>
        <th class="text-end">実労働</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.shiftType">
        <td>{{ item.shiftTypeTitle }}</td>
        <td class="text-end">{{ item.attendanceCount }}</td>
        <td class="text-end">{{ item.detailCount }}</td>
        <td class="text-end">{{ item.totalWorkMinutes }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
