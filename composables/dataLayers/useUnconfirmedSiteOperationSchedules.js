/*****************************************************************************
 * @file ./composables/dataLayer/useUnconfirmedSiteOperationSchedules.js
 * @description A data layer composable to provide `Un-confirmed` SiteOperationSchedule documents.
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
