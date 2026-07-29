<script setup>
/*****************************************************************************
 * @file ./components/DailyAttendance/Calendar/index.vue
 * @description `DailyAttendance` 用 Calendar コンポーネント
 * - VCalendar のイベントデフォルト表記をカスタマイズするため、`event` スロットを使用し、
 *   `event.name` として `${startTime} - ${endTime}` を表示します。
 * - イベントを開始時刻順に並べるため、 `event.timed` は `true` に固定されます。
 * - 日跨ぎ表記を避けるため、 `event.end` は設定しません。
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
import { DailyAttendance, DailyOperationByEmployee } from "@/schemas";
import { useConstants } from "@/composables/useConstants";
import { ATTENDANCE_MANAGEMENT_MODE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "DailyAttendanceCalendar", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: {
    type: Array,
    default: () => [],
    validator: (value) =>
      value.every(
        (doc) =>
          doc instanceof DailyAttendance ||
          doc instanceof DailyOperationByEmployee,
      ),
  },
  attendanceManagementMode: {
    type: String,
    default: ATTENDANCE_MANAGEMENT_MODE_VALUES.ACTUAL_DATE.value,
  },
});
const props = useDefaults(_props, "DailyAttendanceCalendar");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { SHIFT_TYPE } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const events = computed(() => {
  return props.docs.flatMap((doc) =>
    doc.details.map((detail) => {
      const startTime = dayjs(detail.startAt).tz().format("HH:mm");
      const endTime = dayjs(detail.endAt).tz().format("HH:mm");
      const name = `${startTime} - ${endTime}`;
      const color = SHIFT_TYPE.value[detail.shiftType]?.color || "grey";
      const start =
        props.attendanceManagementMode ===
        ATTENDANCE_MANAGEMENT_MODE_VALUES.OPERATION_DATE.value
          ? dayjs.tz(`${doc.date} ${startTime}`, "Asia/Tokyo").toDate()
          : detail.startAt;
      return {
        id: detail.docId,
        name,
        start,
        color,
        timed: true,
      };
    }),
  );
});
</script>

<template>
  <air-calendar v-bind="$attrs" :events="events" type="month">
    <template #event="{ event }">
      <div class="pl-1">{{ event.name }}</div>
    </template>
  </air-calendar>
</template>
