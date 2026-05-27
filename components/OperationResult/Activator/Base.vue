<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Activator/Base.vue
 * @description 稼働実績の基本情報表示コンポーネント
 * - `OperationResultManager` の activator スロット用コンポーネント
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationResult } from "@/schemas";
// COMPOSABLES
import { useConstants } from "@/composables/useConstants";
import { useFetch } from "@/composables/fetch/useFetch";
// COMPONENTS
import CustomInput from "@/components/OperationResult/CustomInput/index.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationResult,
  },
});
const props = useDefaults(_props, "OperationResultActivatorBase");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { DAY_TYPE, SHIFT_TYPE } = useConstants();
const { fetchSiteComposable } = useFetch("OperationResultActivatorBase");
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
      title: "作業内容",
      props: { subtitle: props.item.workDescription || "-" },
    },
  ];
});

/*****************************************************************************
 * EXPOSE
 *****************************************************************************/
defineExpose({
  customInput: CustomInput,
});
</script>

<template>
  <MoleculesActivatorCard>
    <v-card-text class="py-0">
      <air-list :items="items" fluid />
      <air-textarea
        label="備考"
        :model-value="props.item.remarks"
        variant="outlined"
        readonly
      />
    </v-card-text>
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </MoleculesActivatorCard>
</template>
