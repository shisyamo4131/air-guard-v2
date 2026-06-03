/*****************************************************************************
 * @file ./composables/useSetRegularTime.js
 * @description A composable provides `set` function for auto-input regular-time of valid agreement.
 *
 * @how-to-use
 * const { set, addMessage } = useSetRegularTime(
 *   {
 *     siteId
 *     date,
 *     shiftType
 *   },
 *   (agreement) => {
 *     // Handle the valid agreement, e.g., update properties or show a message
 *   }
 * )
 *****************************************************************************/
import { toValue } from "vue";
import { useFetch } from "@/composables/fetch/useFetch";
import { useMessagesStore } from "@/stores/useMessagesStore";

export function useSetRegularTime(
  { siteId, date, shiftType },
  callback = () => {},
) {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const { fetchSiteComposable } = useFetch("useSetRegularTime");
  const { cachedSites } = fetchSiteComposable;
  const { add: addMessage } = useMessagesStore();

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  const set = async () => {
    const site = cachedSites.value[toValue(siteId)];
    if (!site) {
      addMessage({ color: "warning", text: "現場を指定してください。" });
      return;
    }
    if (!toValue(date)) {
      addMessage({ color: "warning", text: "日付を指定してください。" });
      return;
    }
    if (!toValue(shiftType)) {
      addMessage({ color: "warning", text: "勤務区分を指定してください。" });
      return;
    }
    const validAgreement = await site.getValidAgreement({
      date: toValue(date),
      shiftType: toValue(shiftType),
    });
    if (!validAgreement) {
      addMessage({ color: "warning", text: "有効な取極めが見つかりません。" });
      return;
    }
    callback(validAgreement);
  };

  return { set, addMessage };
}
