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
import { useSiteOperationRead } from "@/composables/dataLayers/site/useSiteOperationRead";
import { useMessagesStore } from "@/stores/useMessagesStore";

export function useSetRegularTime(
  { siteId, date, shiftType, draftValues = () => [] },
  callback = () => {},
) {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const reads = useSiteOperationRead(() => [
    toValue(siteId), toValue(date), toValue(shiftType), ...toValue(draftValues),
  ]);
  const { add: addMessage } = useMessagesStore();

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  const set = async () => {
    const selectedSiteId = toValue(siteId);
    const selectedDate = toValue(date);
    const selectedShiftType = toValue(shiftType);
    if (!selectedSiteId) {
      addMessage({ color: "warning", text: "現場を指定してください。" });
      return;
    }
    if (!selectedDate) {
      addMessage({ color: "warning", text: "日付を指定してください。" });
      return;
    }
    if (!selectedShiftType) {
      addMessage({ color: "warning", text: "勤務区分を指定してください。" });
      return;
    }
    const request = reads.begin(selectedSiteId);
    if (!request) return;
    try {
      const site = await reads.read(request);
      if (!request.isCurrent()) return;
      if (!site) {
        addMessage({ color: "warning", text: "現場情報を確認できません。現場を選び直してください。" });
        return;
      }
      const validAgreement = await site.getValidAgreement({
        date: selectedDate,
        shiftType: selectedShiftType,
      });
      if (!request.isCurrent()) return;
      if (!validAgreement) {
        addMessage({ color: "warning", text: "有効な取極めが見つかりません。" });
        return;
      }
      callback(validAgreement);
    } catch {
      if (request.isCurrent()) {
        addMessage({ color: "warning", text: "取極めを取得できませんでした。もう一度お試しください。" });
      }
    }
  };

  return { set, addMessage };
}
