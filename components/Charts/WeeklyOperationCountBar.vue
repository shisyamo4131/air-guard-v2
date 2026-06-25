<script setup>
/*****************************************************************************
 * @file ./components/Charts/WeeklyOperationCountBar.vue
 * @description A bar chart component that displays the count of weekly operations.
 *****************************************************************************/
import dayjs from "dayjs";
import { Bar } from "vue-chartjs";
import { useDateRange } from "@/composables/useDateRange";
import { SiteOperationSchedule, OperationResult } from "@/schemas";
import { useConstants } from "@/composables/useConstants";
import { useOperationCountInRange } from "@/composables/useOperationCountInRange";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ChartsWeeklyOperationCountBar", inheritAttrs: false });

/*****************************************************************************
 * SETUP CONSTANTS COMPOSABLE
 *****************************************************************************/
const { WEEK_COLORS } = useConstants();

/*****************************************************************************
 * SETUP DATE RANGE COMPOSABLE
 *****************************************************************************/
const baseDate = dayjs().tz("Asia/Tokyo").toDate();
const { startDate, endDate, daysInRangeMap } = useDateRange({
  baseDate,
  dayCount: 7,
});

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const operationResult = reactive(new OperationResult());
const siteOperationSchedule = reactive(new SiteOperationSchedule());
const operations = ref([]);
const schedules = ref([]);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function subscribe() {
  operations.value = operationResult.subscribeDocs({
    constraints: [
      ["where", "dateAt", ">=", startDate.value],
      ["where", "dateAt", "<=", endDate.value],
    ],
  });
  schedules.value = siteOperationSchedule.subscribeDocs({
    constraints: [
      ["where", "dateAt", ">=", startDate.value],
      ["where", "dateAt", "<=", endDate.value],
    ],
  });
}

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const dateMappedQuantity = useOperationCountInRange({
  schedules,
  operations,
  daysInRangeMap,
});

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(subscribe);

onUnmounted(() => {
  operationResult.unsubscribe();
  siteOperationSchedule.unsubscribe();
});

const chartData = computed(() => {
  return {
    labels: [...dateMappedQuantity.value.keys()],
    datasets: [
      {
        label: "稼働数推移",
        data: [...dateMappedQuantity.value.values()],
        backgroundColor: WEEK_COLORS.value.background,
        borderColor: WEEK_COLORS.value.border,
        borderWidth: 1,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
};
</script>

<template>
  <Bar v-bind="$attrs" :data="chartData" :options="chartOptions" />
</template>
