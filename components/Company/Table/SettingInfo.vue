<script setup>
/*****************************************************************************
 * @file ./components/Company/Table/SettingInfo.vue
 * @description 会社の設定情報表示テーブル
 *****************************************************************************/
import { useDefaults } from "vuetify";
import {
  ATTENDANCE_MANAGEMENT_MODE_VALUES,
  DAY_OF_WEEK_VALUES,
} from "@shisyamo4131/air-guard-v2-schemas/constants";
import { RoundSetting } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  minuteInterval: { type: Number, default: 0 },
  roundSetting: { type: String, default: "" },
  firstDayOfWeek: { type: Number, default: 0 },
  attendanceManagementMode: {
    type: String,
    default: ATTENDANCE_MANAGEMENT_MODE_VALUES.ACTUAL_DATE.value,
  },
});
const props = useDefaults(_props, "CompanyTableSettingInfo");

const attendanceManagementModeTitle = computed(() => {
  return (
    Object.values(ATTENDANCE_MANAGEMENT_MODE_VALUES).find(
      ({ value }) => value === props.attendanceManagementMode,
    )?.title || "-"
  );
});
</script>

<template>
  <v-table>
    <tbody>
      <tr>
        <td>時刻選択間隔（分）</td>
        <td>{{ props.minuteInterval }}</td>
      </tr>
      <tr>
        <td>端数処理</td>
        <td>{{ RoundSetting.label(props.roundSetting) }}</td>
      </tr>
      <tr>
        <td>週の始まり</td>
        <td>{{ DAY_OF_WEEK_VALUES[props.firstDayOfWeek].title }}</td>
      </tr>
      <tr>
        <td>勤怠管理方式</td>
        <td>{{ attendanceManagementModeTitle }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
