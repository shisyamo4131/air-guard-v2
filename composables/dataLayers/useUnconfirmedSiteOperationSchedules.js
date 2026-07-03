/*****************************************************************************
 * @file ./composables/dataLayer/useUnconfirmedSiteOperationSchedules.js
 * @description 現在日付より前で、かつ稼働実績が作成されていない現場稼働予定インスタンスの配列を提供します。
 *****************************************************************************/
import dayjs from "dayjs";
import { useDocuments } from "@/composables/dataLayers/useDocuments";

export function useUnconfirmedSiteOperationSchedules() {
  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const currentDate = dayjs().tz("Asia/Tokyo").format("YYYY-MM-DD");

  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const { docs } = useDocuments("SiteOperationSchedule", {
    options: computed(() => [
      ["where", "operationResultId", "==", null],
      ["where", "date", "<", currentDate],
    ]),
    fetchAllOnEmpty: true,
  });

  return { docs };
}
