import dayjs from "dayjs";
import ja from "dayjs/locale/ja";
import { SiteOperationSchedule } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * @file ./composables/useArrangementNotificationsCommandText.js
 * @description 配置情報通知用テキスト生成コンポーザブル
 * @param {Object[]} schedules
 * @param {Object[]} siteShiftTypeOrder
 *****************************************************************************/
export function useArrangementNotificationsCommandText({
  schedules,
  siteShiftTypeOrder,
}) {
  const {
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  } = useFetch("useArrangementNotificationsCommandText");

  const { cachedSites } = fetchSiteComposable;
  const { cachedEmployees } = fetchEmployeeComposable;
  const { cachedOutsourcers } = fetchOutsourcerComposable;

  const orderMap = Vue.computed(() => {
    return new Map(
      siteShiftTypeOrder.value.map((item, index) => [
        `${item.siteId}_${item.shiftType}`,
        index,
      ]),
    );
  });

  /**
   * 配置情報通知用のテキストを生成します。
   * @param {string} date - YYYY-MM-DD
   * @returns {string}
   */
  function getCommandText(date) {
    const formattedDate = dayjs(date).locale(ja).format("YYYY年MM月DD日(ddd)");

    const dayFilteredSchedules = schedules.filter(
      (schedule) => schedule.date === date,
    );

    if (dayFilteredSchedules.length === 0) {
      return `${formattedDate} 配置\n\n配置はありません。`;
    }

    if (siteShiftTypeOrder.value?.length) {
      dayFilteredSchedules.sort((a, b) => {
        const aOrder =
          orderMap.value.get(`${a.siteId}_${a.shiftType}`) ??
          Number.MAX_SAFE_INTEGER;

        const bOrder =
          orderMap.value.get(`${b.siteId}_${b.shiftType}`) ??
          Number.MAX_SAFE_INTEGER;

        return aOrder - bOrder;
      });
    }

    const lines = [];

    for (const [index, schedule] of dayFilteredSchedules.entries()) {
      const site = cachedSites.value[schedule.siteId];

      const siteName = site?.name ?? "不明な現場";
      const siteAddress = site?.address ?? "";

      const isDay =
        schedule.shiftType === SiteOperationSchedule.SHIFT_TYPE.DAY.value;
      const shiftType = isDay ? "日勤" : "夜勤";
      const mark = isDay ? "○" : "●";

      lines.push(`【${siteName} - ${shiftType}】`);
      lines.push(siteAddress);
      lines.push(`${schedule.startTime}〜${schedule.endTime}`);

      for (const employee of schedule.employees) {
        const data = cachedEmployees.value[employee.id];

        lines.push(
          data
            ? `${mark}${data.displayName}${data.title || ""}`
            : `${mark}unknown`,
        );
      }

      for (const outsourcer of schedule.outsourcers) {
        const data = cachedOutsourcers.value[outsourcer.id];

        lines.push(
          data
            ? `${mark}${data.displayName}(${outsourcer.amount}名)`
            : `${mark}unknown(${outsourcer.amount}名)`,
        );
      }

      if (index !== dayFilteredSchedules.length - 1) {
        lines.push("");
      }
    }

    return `${formattedDate} 配置\n\n${lines.join("\n")}`;
  }

  return {
    getCommandText,
  };
}
