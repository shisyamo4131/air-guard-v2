<script setup>
import dayjs from "dayjs";
import { OperationResult } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  cachedSites: { type: Object, required: true },
});

/*****************************************************************************
 * DEFINE ITEMS FUNCTION
 *****************************************************************************/
const items = (item) => {
  const name = props.cachedSites?.[item.siteId]?.name || "loading...";
  const date = dayjs(item.dateAt).format("YYYY年M月D日（ddd）");
  const dayType = OperationResult.DAY_TYPE[item.dayType] || "loading...";
  const shiftType = OperationResult.SHIFT_TYPE[item.shiftType]?.title || "";
  const startTime = item.startTime || "loading...";
  const endTime = item.endTime || "loading...";
  return [
    { title: "CODE", props: { subtitle: item.code } },
    { title: "現場名", props: { subtitle: name || "loading..." } },
    { title: "日付", props: { subtitle: date } },
    { title: "区分", props: { subtitle: `${dayType} ${shiftType}`.trim() } },
    { title: "時間", props: { subtitle: `${startTime} - ${endTime}`.trim() } },
    { title: "作業内容", props: { subtitle: item.workDescription } },
    { title: "備考", props: { subtitle: item.remarks } },
  ];
};
</script>

<template>
  <air-information-card list-class="v-list--info-display" :items="items" />
</template>
