<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/Activator/Base.vue
 * @description 稼働請求の基本情報表示コンポーネント
 * - `OperationBillingManager` の activator スロット用コンポーネント
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationBilling } from "@/schemas";
// COMPOSABLES
import { useConstants } from "@/composables/useConstants";
import { useFetch } from "@/composables/fetch/useFetch";
// COMPONENTS
import CustomInput from "@/components/OperationBilling/CustomInput/index.vue";
import BtnToggleLock from "@/components/OperationBilling/Activator/Base/BtnToggleLock.vue";

defineOptions({ name: "OperationBillingActivatorBase", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationBilling,
  },
});
const props = useDefaults(_props, "OperationBillingActivatorBase");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { DAY_TYPE, SHIFT_TYPE } = useConstants();
const { fetchSiteComposable } = useFetch("OperationBillingActivatorBase");
const { cachedSites } = fetchSiteComposable;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const site = computed(() => {
  return cachedSites.value?.[props.item.siteId] || null;
});
const siteName = computed(() => {
  return site.value?.name || "読み込み中...";
});
const customer = computed(() => {
  return site.value?.customer || null;
});
const customerName = computed(() => {
  return customer.value?.abbreviation || "読み込み中...";
});
const dateString = computed(() => {
  return dayjs(props.item.dateAt)
    .tz("Asia/Tokyo")
    .format("YYYY年MM月DD日 (ddd)");
});
const dayTypeTitle = computed(() => {
  return DAY_TYPE.value?.[props.item.dayType]?.title || "N/A";
});
const shiftTypeTitle = computed(() => {
  return SHIFT_TYPE.value?.[props.item.shiftType]?.title || "N/A";
});
const time = computed(() => {
  return `${props.item.startTime} 〜 ${props.item.endTime}`;
});
const breakHours = computed(() => {
  const result = (props.item.breakMinutes || 0) / 60;
  return `${result} 時間`;
});
const regulationWorkHours = computed(() => {
  const result = (props.item.regulationWorkMinutes || 0) / 60;
  return `${result} 時間`;
});
const requiredPersonnel = computed(() => {
  return `${props.item.requiredPersonnel} 人`;
});
const items = computed(() => {
  return [
    { title: "取引先", props: { subtitle: `${customerName.value}` } },
    { title: "現場", props: { subtitle: `${siteName.value}` } },
    { title: "現場コード", props: { subtitle: `${site.value?.code || "-"}` } },
    { title: "日付", props: { subtitle: dateString.value } },
    {
      title: "曜日・勤務区分",
      props: { subtitle: `${dayTypeTitle.value} / ${shiftTypeTitle.value}` },
    },
    {
      title: "定時時間(休憩)",
      props: { subtitle: `${time.value}` },
    },
    {
      title: "規定実働時間 / 休憩時間",
      props: {
        subtitle: `${regulationWorkHours.value} / ${breakHours.value}`,
      },
    },
    { title: "必要人数", props: { subtitle: requiredPersonnel.value } },
    {
      title: "要資格者",
      props: { subtitle: props.item.qualificationRequired ? "あり" : "なし" },
    },
    {
      title: "作業内容",
      props: { subtitle: props.item.workDescription || "-" },
    },
  ];
});

/*****************************************************************************
 * EXPOSE
 *****************************************************************************/
defineExpose({ customInput: CustomInput });
</script>

<template>
  <MoleculesActivatorCard v-bind="$attrs" :item="props.item">
    <!-- DEFAULT -->
    <template #default>
      <air-list :items="items" no-padding />
    </template>

    <!-- FOOTER -->
    <template #footer="{ item }">
      <BtnToggleLock :item="item" />
      <air-textarea
        label="備考"
        :model-value="item.remarks"
        variant="outlined"
        readonly
      />
    </template>
  </MoleculesActivatorCard>
</template>
