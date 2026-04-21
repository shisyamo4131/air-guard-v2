<script setup>
/*****************************************************************************
 * @file ./components/Employee/Table/SecurityGuardInfo.vue
 * @description 警備員資格情報表示テーブル
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  hasSecurityGuardRegistration: { type: Boolean, default: false }, // 警備員資格登録の有無
  dateOfSecurityGuardRegistration: { type: Object, default: null }, // 警備員登録日
  bloodType: { type: String, default: "" }, // 血液型
  emergencyContactName: { type: String, default: "" }, // 緊急連絡先氏名
  emergencyContactRelation: { type: String, default: "" }, // 緊急連絡先との関係
  emergencyContactRelationDetail: { type: String, default: "" }, // 緊急連絡先との関係詳細
  emergencyContactAddress: { type: String, default: "" }, // 緊急連絡先住所
  emergencyContactPhone: { type: String, default: "" }, // 緊急連絡先電話番号
  domicile: { type: String, default: "" }, // 本籍地
});
const props = useDefaults(_props, "EmployeeTableSecurityGuardInfo");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const formattedDateOfSecurityGuardRegistration = computed(() => {
  return props.dateOfSecurityGuardRegistration
    ? dayjs(props.dateOfSecurityGuardRegistration).format("YYYY年MM月DD日")
    : "";
});

const formattedEmergencyContactName = computed(() => {
  const name = props.emergencyContactName || "N/A";
  const relation = props.emergencyContactRelationDetail || "N/A";
  return `${name} (${relation})`;
});
</script>

<template>
  <v-table>
    <tbody>
      <tr>
        <td>警備員登録日</td>
        <td>{{ formattedDateOfSecurityGuardRegistration }}</td>
      </tr>
      <tr>
        <td>血液型</td>
        <td>{{ props.bloodType }}</td>
      </tr>
      <tr>
        <td>緊急連絡先氏名</td>
        <td>{{ formattedEmergencyContactName }}</td>
      </tr>
      <tr>
        <td>緊急連絡先住所</td>
        <td>{{ props.emergencyContactAddress }}</td>
      </tr>
      <tr>
        <td>緊急連絡先電話番号</td>
        <td>{{ props.emergencyContactPhone }}</td>
      </tr>
      <tr>
        <td>本籍地</td>
        <td>{{ props.domicile }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
