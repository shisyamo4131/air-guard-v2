<script setup>
/*****************************************************************************
 * @file ./components/Employee/Table/Nationality.vue
 * @description 従業員の国籍情報表示テーブル
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  isForeigner: { type: Boolean, default: false }, // 外国人かどうか
  nationality: { type: String, default: "" }, // 国籍
  foreignName: { type: String, default: "" }, // 外国人氏名
  residenceStatus: { type: String, default: "" }, // 在留資格
  hasPeriodOfStayLimit: { type: Boolean, default: false }, // 在留期間制限の有無
  periodOfStay: { type: Object, default: null }, // 在留期間満了日
  hasWorkRestrictions: { type: Boolean, default: false }, // 就労制限の有無
});
const props = useDefaults(_props, "EmployeeTableNationality");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const formattedPeriodOfStay = computed(() => {
  return props.periodOfStay
    ? dayjs(props.periodOfStay).format("YYYY/MM/DD")
    : "";
});
</script>

<template>
  <v-table>
    <tbody>
      <tr>
        <td>国籍</td>
        <td>{{ props.nationality || "日本" }}</td>
      </tr>
      <tr v-if="props.isForeigner">
        <td>本名</td>
        <td>{{ props.foreignName }}</td>
      </tr>
      <tr v-if="props.isForeigner">
        <td>在留資格</td>
        <td>{{ props.residenceStatus }}</td>
      </tr>
      <tr v-if="props.isForeigner">
        <td>在留期間</td>
        <td>
          <div v-if="props.hasPeriodOfStayLimit">
            {{ formattedPeriodOfStay }}
          </div>
          <div v-else>無制限</div>
        </td>
      </tr>
      <tr v-if="props.isForeigner">
        <td>就労制限</td>
        <td>
          {{ props.hasWorkRestrictions ? "あり" : "なし" }}
        </td>
      </tr>
    </tbody>
  </v-table>
</template>
