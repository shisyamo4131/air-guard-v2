/*****************************************************************************
 * @file ./components/Charts/WeeklyOperationQuantityBar/useChartOptions.js
 * @description `WeeklyOperationQuantityBar` の options に引き渡す定数定義
 *****************************************************************************/
export function useChartOptions(props) {
  return {
    chartOptions: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !props.hideLabel,
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
        },
      },
    },
  };
}
