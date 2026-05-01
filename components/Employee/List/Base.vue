<script setup>
/*****************************************************************************
 * @file ./components/Employee/List/Base.vue
 * @description 従業員の基本情報表示コンポーネント
 * @extends AirList
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  code: { type: String, default: "" }, // 従業員コード
  fullName: { type: String, default: "" }, // 氏名
  fullNameKana: { type: String, default: "" }, // 氏名（カナ）
  displayName: { type: String, default: "" }, // 表示名
  gender: { type: String, default: "" }, // 性別
  dateOfBirth: { type: Object, default: null }, // 生年月日
  dateOfHire: { type: Object, default: null }, // 入社日
  title: { type: String, default: "" }, // 肩書
  zipcode: { type: String, default: "" }, // 郵便番号
  fullAddress: { type: String, default: "" }, // 住所（都道府県、市区町村、町域・番地を結合したもの）
  building: { type: String, default: "" }, // 建物名
  mobile: { type: String, default: "" }, // 携帯電話番号
  email: { type: String, default: "" }, // メールアドレス
  remarks: { type: String, default: "" }, // 備考
});
const props = useDefaults(_props, "EmployeeListBase");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { GENDER } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const formattedDateOfBirth = computed(() => {
  return props.dateOfBirth ? dayjs(props.dateOfBirth).format("YYYY/MM/DD") : "";
});
const formattedDateOfHire = computed(() => {
  return props.dateOfHire ? dayjs(props.dateOfHire).format("YYYY/MM/DD") : "";
});

const items = computed(() => {
  return [
    { title: "従業員コード", props: { subtitle: props.code || "-" } },
    { title: "従業員名", props: { subtitle: props.fullName || "-" } },
    {
      title: "従業員名（カナ）",
      props: { subtitle: props.fullNameKana || "-" },
    },
    {
      title: "性別",
      props: { subtitle: GENDER.value[props.gender]?.title || "-" },
    },
    {
      title: "生年月日",
      props: { subtitle: formattedDateOfBirth.value || "-" },
    },
    { title: "入社日", props: { subtitle: formattedDateOfHire.value || "-" } },
    { title: "肩書", props: { subtitle: props.title || "-" } },
    { title: "郵便番号", props: { subtitle: props.zipcode || "-" } },
    { title: "住所", props: { subtitle: props.fullAddress || "-" } },
    { title: "建物名", props: { subtitle: props.building || "-" } },
    { title: "携帯電話番号", props: { subtitle: props.mobile || "-" } },
    { title: "メールアドレス", props: { subtitle: props.email || "-" } },
  ];
});
</script>

<template>
  <air-list :items="items" />
</template>
