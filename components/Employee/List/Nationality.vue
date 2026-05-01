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

const items = computed(() => {
  return [
    { title: "国籍", props: { subtitle: props.nationality || "日本" } },
    ...(props.isForeigner
      ? [
          { title: "本名", props: { subtitle: props.foreignName } },
          { title: "在留資格", props: { subtitle: props.residenceStatus } },
          {
            title: "在留期間",
            props: {
              subtitle: props.hasPeriodOfStayLimit
                ? formattedPeriodOfStay.value
                : "無制限",
            },
          },
          {
            title: "就労制限",
            props: {
              subtitle: props.hasWorkRestrictions ? "あり" : "なし",
            },
          },
        ]
      : []),
  ];
});
</script>

<template>
  <air-list :items="items" />
</template>
