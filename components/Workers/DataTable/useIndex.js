/*****************************************************************************
 * @file ./components/Workers/DataTable/useIndex.js
 * @description A composable of `WorkersDataTable`.
 *****************************************************************************/
import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";
import { formatNumber } from "@/utils/formats/util.js";

/**
 * A composable for the `WorkersDataTable` component that provides attributes and headers for the data table.
 * @returns {Object}
 * @returns {Object} attrs - An object containing attributes for the data table component.
 * @returns {Array} headers - An array of header definitions for the data table.
 */
export function useIndex() {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { fetchEmployeeComposable, fetchOutsourcerComposable } =
    useFetch("WorkersDataTable");
  const { cachedEmployees } = fetchEmployeeComposable;
  const { cachedOutsourcers } = fetchOutsourcerComposable;

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  const getDisplayName = (item) => {
    const cachedData = item.isEmployee
      ? cachedEmployees.value
      : cachedOutsourcers.value;
    return cachedData[item.id]?.displayName ?? "N/A";
  };

  const convertMinutesToHours = (minutes) => {
    const hours = (minutes ?? 0) / 60;
    return `${formatNumber(hours)} 時間`;
  };

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const headers = Vue.computed(() => {
    return [
      {
        title: "名前",
        key: "displayName",
        value: (item) => getDisplayName(item),
      },
      { title: "開始", key: "startTime", align: "center" },
      { title: "終了", key: "endTime", align: "center" },
      {
        title: "休憩",
        key: "breakMinutes",
        value: (item) => convertMinutesToHours(item.breakMinutes),
        align: "center",
      },
      {
        title: "残業",
        key: "overtimeWorkMinutes",
        value: (item) => convertMinutesToHours(item.overtimeWorkMinutes),
        align: "center",
      },
      { title: "OJT", key: "isOjt", align: "center" },
    ];
  });

  const attrs = Vue.computed(() => {
    return {
      disableSort: true,
      headers: headers.value,
      hideDefaultFooter: true,
      itemsPerPage: -1,
    };
  });

  return { attrs, headers };
}
