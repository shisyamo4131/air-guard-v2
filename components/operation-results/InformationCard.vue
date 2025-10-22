<script setup>
import dayjs from "dayjs";
import { OperationResult } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const model = defineModel({ type: Object, required: true });
const props = defineProps({
  cachedSites: { type: Object, required: true },
});
/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const items = computed(() => {
  const name = props.cachedSites?.[model.value.siteId]?.name || "loading...";
  const date = dayjs(model.value.dateAt).format("YYYY年M月D日（ddd）");
  const dayType = OperationResult.DAY_TYPE[model.value.dayType] || "loading...";
  const shiftType =
    OperationResult.SHIFT_TYPE[model.value.shiftType]?.title || "";
  const startTime = model.value.startTime || "loading...";
  const endTime = model.value.endTime || "loading...";
  return [
    { title: "CODE", props: { subtitle: model.value.code } },
    { title: "現場名", props: { subtitle: name || "loading..." } },
    { title: "日付", props: { subtitle: date } },
    { title: "区分", props: { subtitle: `${dayType} ${shiftType}`.trim() } },
    { title: "時間", props: { subtitle: `${startTime} - ${endTime}`.trim() } },
    { title: "作業内容", props: { subtitle: model.value.workDescription } },
    { title: "備考", props: { subtitle: model.value.remarks } },
  ];
});
</script>

<template>
  <MoleculesCardsInformationCard :items="items" />
</template>
