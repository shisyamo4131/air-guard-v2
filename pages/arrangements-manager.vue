<script setup>
/*****************************************************************************
 * @file pages/arrangements-manager.vue
 * @description 配置管理ページ
 *****************************************************************************/
import dayjs from "dayjs";
import { useDisplay } from "vuetify";
import { useDateRange } from "@/composables/useDateRange";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "arrangements-manager" });

/*****************************************************************************
 * SETUP USE FETCH COMPOSABLES
 *****************************************************************************/
// `useFetch` をルートコンポーネントとしてセットアップ
useFetch("arrangements-manager", true);

/*****************************************************************************
 * SETUP DATE RANGE COMPOSABLE
 * - 現場稼働予定ドキュメントの取得範囲（期間）を制御
 * - 期間は PC版: 14日間、モバイル版: 4日間 とし、開始日は前日とする。
 * - PC版・モバイル版の判断は useDisplay を利用するが、リアクティブ対応不要。
 *****************************************************************************/
const { mobile } = useDisplay();
const dayCount = mobile.value ? 4 : 14;
const { startDate, endDate } = useDateRange({
  baseDate: dayjs().tz("Asia/Tokyo").toDate(),
  dayCount,
  offsetDays: -1,
});
</script>

<template>
  <ArrangementsManager :start-date="startDate" :end-date="endDate" />
</template>
