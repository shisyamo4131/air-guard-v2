<script setup>
/*****************************************************************************
 * @file ./components/DailyAttendance/Statistics/List/index.vue
 * @description 従業員別勤怠統計の全体集計をリスト表示します。
 *****************************************************************************/
import { formatAttendanceMinutes } from "@/utils/attendance/formatAttendanceMinutes";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "DailyAttendanceStatisticsList",
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
 * COMPUTED
 *****************************************************************************/
const items = computed(() => {
  if (!props.statistics) return [];

  return [
    {
      title: "勤務日数",
      value: `${props.statistics.attendanceCount}日`,
    },
    {
      title: "稼働数",
      value: `${props.statistics.detailCount}回`,
    },
    {
      title: "実労働時間",
      value: formatAttendanceMinutes(props.statistics.totalWorkMinutes),
    },
  ];
});
</script>

<template>
  <v-list v-bind="$attrs">
    <v-list-item v-for="item in items" :key="item.title" :title="item.title">
      <template #append>
        <span class="text-body-2 font-weight-medium">
          {{ item.value }}
        </span>
      </template>
    </v-list-item>
  </v-list>
</template>
