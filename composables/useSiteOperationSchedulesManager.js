/**
 * @file useSiteOperationSchedulesManager.js
 * @description Composable for managing site operation schedules.
 * This composable provides `subscribe` method for listening to `SiteOperationSchedule` documents.
 * - If the `fetchEmployee` composable is provided, it will automatically fetch employee data related to the retrieved `SiteOperationSchedule` documents.
 * - If the `fetchOutsourcer` composable is provided, it will automatically fetch outsourcer data related to the retrieved `SiteOperationSchedule` documents.
 * @param {Object} options - Configuration options.
 * @param {Object} [options.manager] - Manager instance for schedule operations.
 * @param {Object} [options.fetchEmployeeComposable] - Custom composable for fetching employees.
 * @param {Object} [options.fetchOutsourcerComposable] - Custom composable for fetching outsourcers.
 */
import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { useDateUtil } from "@/composables/useDateUtil";
import { SiteOperationSchedule } from "@/schemas";

/** Messages */
const MANAGER_NOT_PROVIDED =
  "Manager should be provided to useSiteOperationSchedulesManager.";
const INVALID_SITE_ID =
  "Invalid `siteId` provided for useSiteOperationSchedulesManager.";
const INVALID_DATE_RANGE =
  "Invalid `dateRange` provided for useSiteOperationSchedulesManager.";
export function useSiteOperationSchedulesManager({
  manager,
  siteId,
  dateRange,
} = {}) {
  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  const logger = useLogger();
  const sender = "useSiteOperationSchedulesManager";
  const { isValidDate } = useDateUtil();

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  const validatedManager = Vue.computed(() => {
    const val = Vue.toValue(manager);
    if (!val) {
      logger.warn({ sender, message: MANAGER_NOT_PROVIDED });
      return null;
    }
    return val;
  });

  const validatedSiteId = Vue.computed(() => {
    const val = Vue.toValue(siteId);
    if (!val || !(typeof val === "string")) {
      logger.warn({ sender, message: INVALID_SITE_ID });
      return null;
    }
    return val;
  });

  const validatedDateRange = Vue.computed(() => {
    const val = Vue.toValue(dateRange);
    if (!val || typeof val !== "object") {
      logger.warn({ sender, message: INVALID_DATE_RANGE });
      return null;
    }
    const { from, to } = val;
    if (!from || !isValidDate(from) || !to || !isValidDate(to)) {
      logger.warn({ sender, message: INVALID_DATE_RANGE, data: val });
      return null;
    }
    return val;
  });

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());
  const docs = Vue.ref([]); // Subscribed documents.

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  /***************************************************************************
   * PRIVATE METHODS
   ***************************************************************************/
  function _subscribe() {
    try {
      if (!validatedSiteId.value || !validatedDateRange.value) {
        docs.value = [];
        logger.warn({
          sender,
          message: "Invalid siteId or dateRange",
          args: {
            siteId: validatedSiteId.value,
            dateRange: validatedDateRange.value,
          },
        });
        return;
      }
      const { from, to } = validatedDateRange.value;
      docs.value = instance.subscribeDocs({
        constraints: [
          ["where", "siteId", "==", validatedSiteId.value],
          ["where", "dateAt", ">=", from],
          ["where", "dateAt", "<=", to],
        ],
      });
    } catch (error) {
      logger.error({
        sender,
        message: "Failed to subscribe to documents",
        error,
      });
    }
  }
  /***************************************************************************
   * METHODS
   ***************************************************************************/

  /***************************************************************************
   * COMPUTED PROPERTIES FOR PROVIDE
   ***************************************************************************/
  const events = Vue.computed(() => {
    return docs.value.map((doc) => doc.toEvent());
  });

  const statistics = Vue.computed(() => {
    const requiredPersonnel = docs.value.reduce((acc, schedule) => {
      if (!acc[schedule.date]) acc[schedule.date] = 0;
      acc[schedule.date] += schedule.requiredPersonnel || 0;
      return acc;
    }, {});

    return {
      requiredPersonnel,
    };
  });

  return {
    // data
    docs,
    events,
    statistics,

    // Methods for managing schedules provided by the manager.
    toCreate: (schedule) => manager?.value?.toCreate?.(schedule),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
  };
}
