<script setup>
/*****************************************************************************
 * @file ./components/Charts/WeeklyOperationQuantityBar/index.vue
 * @description 1週間の稼働数推移を表す棒グラフコンポーネント
 *****************************************************************************/
import dayjs from "dayjs";
import { Bar } from "vue-chartjs";
import { useDefaults } from "vuetify";
import { useChartData } from "./useChartData";
import { useChartOptions } from "./useChartOptions";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "ChartsWeeklyOperationQuantityBar",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  backgroundColor: { type: String, default: "rgba(255, 99, 132, 0.2)" },
  borderColor: { type: String, default: "rgba(255, 99, 132, 1)" },
  borderWidth: { type: Number, default: 1 },
  hideLabel: { type: Boolean, default: false },
  label: { type: String, default: "稼働数" },
  startDate: { type: Object, default: () => dayjs().tz("Asia/Tokyo").toDate() },
});
const props = useDefaults(_props, "ChartsWeeklyOperationQuantityBar");

/*****************************************************************************
 * SETUP COMPOSABLE
 *****************************************************************************/
const { chartData } = useChartData(props);
const { chartOptions } = useChartOptions(props);
</script>

<template>
  <Bar v-bind="$attrs" :data="chartData" :options="chartOptions" />
</template>
