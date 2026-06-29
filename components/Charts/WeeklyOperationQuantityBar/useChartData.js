/*****************************************************************************
 * @file ./components/Charts/WeeklyOperationQuantityBar/useChartData.js
 * @description `WeeklyOperationQuantityBar` 専用チャートデータ生成コンポーザブル
 *****************************************************************************/
import { computed } from "vue";
import { useDateRange } from "@/composables/useDateRange";
import { useConstants } from "@/composables/useConstants";
import { useOperationResultsInRange } from "@/composables/dataLayers/useOperationResultsInRange";
import { useSiteOperationSchedulesInRange } from "@/composables/dataLayers/useSiteOperationSchedulesInRange";
import { useOperationQuantityBySecurityTypeInRange } from "@/composables/domain/operation/useOperationQuantityBySecurityTypeInRange";

export function useChartData(props) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { SECURITY_TYPE } = useConstants();

  // 日付範囲を取得
  const { startDate, endDate, daysInRangeMap } = useDateRange({
    baseDate: props.startDate,
    dayCount: 7,
  });

  // 指定期間の SiteOperationSchedule を取得
  const schedules = useSiteOperationSchedulesInRange({
    startDate,
    endDate,
  });

  // 指定期間の OperationResult を取得
  const operations = useOperationResultsInRange({
    startDate,
    endDate,
  });

  // 日付 × 警備種別ごとの稼働数
  const quantityByDate = useOperationQuantityBySecurityTypeInRange({
    schedules,
    operations,
    daysInRangeMap,
  });

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const chartData = computed(() => {
    const labels = [...quantityByDate.value.keys()];
    const quantities = [...quantityByDate.value.values()];

    return {
      labels,
      datasets: Object.values(SECURITY_TYPE.value).map((type) => ({
        label: type.title,
        data: quantities.map((quantity) => quantity.get(type.value) ?? 0),
        backgroundColor: type.chart.backgroundColor,
        borderColor: type.chart.borderColor,
        borderWidth: props.borderWidth,
      })),
    };
  });

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return {
    chartData,
  };
}
