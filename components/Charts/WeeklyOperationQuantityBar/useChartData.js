/*****************************************************************************
 * @file ./components/Charts/WeeklyOperationQuantityBar/useChartData.js
 * @description `WeeklyOperationQuantityBar` 専用 Facade コンポーザブル
 *****************************************************************************/
import { useDateRange } from "@/composables/useDateRange";
import { useOperationResultsInRange } from "@/composables/dataLayers/useOperationResultsInRange";
import { useSiteOperationSchedulesInRange } from "@/composables/dataLayers/useSiteOperationSchedulesInRange";
import { useOperationQuantityInRange } from "@/composables/domain/operation/useOperationQuantityInRange";

export function useChartData(props) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  // 1. `props.startDate` を基準に日付範囲を取得
  const { startDate, endDate, daysInRangeMap } = useDateRange({
    baseDate: props.startDate,
    dayCount: 7,
  });

  // 2. SiteOperationSchedule インスタンスの配列を取得
  const schedules = useSiteOperationSchedulesInRange({
    startDate,
    endDate,
  });

  // 3. OperationResult インスタンスの配列を取得
  const operations = useOperationResultsInRange({
    startDate,
    endDate,
  });

  // 4. 日ごとの稼働数を計算
  const quantityByDate = useOperationQuantityInRange({
    schedules,
    operations,
    daysInRangeMap,
  });

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const chartData = computed(() => {
    return {
      labels: [...quantityByDate.value.keys()],
      datasets: [
        {
          label: props.label,
          data: [...quantityByDate.value.values()],
          backgroundColor: props.backgroundColor,
          borderColor: props.borderColor,
          borderWidth: props.borderWidth,
        },
      ],
    };
  });

  /*****************************************************************************
   * RETURNS
   *****************************************************************************/
  return {
    chartData,
  };
}
