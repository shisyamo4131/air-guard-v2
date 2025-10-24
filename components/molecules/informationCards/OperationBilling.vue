<script setup>
/*****************************************************************************
 * Molecules/InformationCards/OperationBilling ver 1.0.0
 * @author shisyamo4131
 * @description A component for displaying operation billing information in a card format.
 * @props {Object} cachedSites - An object containing cached site information.
 *****************************************************************************/
import dayjs from "dayjs";
import { OperationBilling } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  site: { type: Object, default: undefined },
});

/*****************************************************************************
 * DEFINE ITEMS FUNCTION
 *****************************************************************************/
const items = (item) => {
  const name = props.site?.name || "loading...";
  const date = dayjs(item.dateAt).format("YYYY年M月D日（ddd）");
  const dayType = OperationBilling.DAY_TYPE[item.dayType] || "loading...";
  const shiftType = OperationBilling.SHIFT_TYPE[item.shiftType]?.title || "";
  const startTime = item.startTime || "loading...";
  const endTime = item.endTime || "loading...";
  return [
    { title: "現場名", props: { subtitle: name || "loading..." } },
    { title: "日付", props: { subtitle: date } },
    { title: "区分", props: { subtitle: `${dayType} ${shiftType}`.trim() } },
    { title: "時間", props: { subtitle: `${startTime} - ${endTime}`.trim() } },
    { title: "作業内容", props: { subtitle: item.workDescription } },
    { title: "基本単価", props: { subtitle: item.unitPriceBase } },
    { title: "資格者単価", props: { subtitle: item.unitPriceQualified } },

    { title: "備考", props: { subtitle: item.remarks } },
  ];
};
</script>

<template>
  <air-information-card list-class="v-list--info-display" :items="items" />
</template>
