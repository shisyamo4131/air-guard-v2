<script setup>
/*****************************************************************************
 * @file ./components/Employee/List/Nationality.vue
 * @description 従業員の国籍情報表示コンポーネント
 * @extends AirList
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

const items = computed(() => {
  return [
    {
      title: "警備員登録日",
      props: { subtitle: formattedDateOfSecurityGuardRegistration.value },
    },
    { title: "血液型", props: { subtitle: props.bloodType || "N/A" } },
    {
      title: "緊急連絡先氏名",
      props: { subtitle: formattedEmergencyContactName.value },
    },
    {
      title: "緊急連絡先住所",
      props: { subtitle: props.emergencyContactAddress || "N/A" },
    },
    {
      title: "緊急連絡先電話番号",
      props: { subtitle: props.emergencyContactPhone || "N/A" },
    },
    { title: "本籍地", props: { subtitle: props.domicile || "N/A" } },
  ];
});
</script>

<template>
  <air-list :items="items" />
</template>
