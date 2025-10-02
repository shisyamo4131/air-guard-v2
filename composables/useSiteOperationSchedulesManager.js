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
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import { useDateRange } from "@/composables/useDateRange";
import { Site, SiteOperationSchedule } from "@/schemas";
import dayjs from "dayjs";

/** Messages */
const MANAGER_NOT_PROVIDED =
  "Manager should be provided to useSiteOperationSchedulesManager.";
const INVALID_SITE_ID =
  "Invalid `siteId` provided for useSiteOperationSchedulesManager.";
export function useSiteOperationSchedulesManager({
  manager,
  siteId,
  from = dayjs(new Date()).startOf("month").toDate(),
  to = dayjs(new Date()).endOf("month").toDate(),
} = {}) {
  /***************************************************************************
   * DEFINE COMPOSABLES
   ***************************************************************************/
  const logger = useLogger(
    "useSiteOperationSchedulesManager",
    useErrorsStore()
  );
  const { dateRange, debouncedDateRange } = useDateRange({
    baseDate: from,
    endDate: to,
  });

  /***************************************************************************
   * VALIDATION
   ***************************************************************************/
  const validatedManager = Vue.computed(() => {
    const val = Vue.toValue(manager);
    if (!val) {
      logger.warn({ message: MANAGER_NOT_PROVIDED });
      return null;
    }
    return val;
  });

  const validatedSiteId = Vue.computed(() => {
    const val = Vue.toValue(siteId);
    if (!val || !(typeof val === "string")) {
      logger.warn({ message: INVALID_SITE_ID });
      return null;
    }
    return val;
  });

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());
  const docs = Vue.ref([]); // Subscribed documents.
  const site = Vue.reactive(new Site());

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  Vue.watch(
    validatedSiteId,
    (newVal) => {
      newVal ? site.fetch({ docId: newVal }) : site.initialize();
    },
    { immediate: true }
  );

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
      if (!validatedSiteId.value) {
        docs.value = [];
        logger.warn({
          message: "Invalid siteId",
          data: {
            siteId: validatedSiteId.value,
          },
        });
        return;
      }
      const { from, to } = debouncedDateRange.value;
      docs.value = instance.subscribeDocs({
        constraints: [
          ["where", "siteId", "==", validatedSiteId.value],
          ["where", "dateAt", ">=", from],
          ["where", "dateAt", "<=", to],
        ],
      });
    } catch (error) {
      logger.error({
        message: "Failed to subscribe to documents",
        error,
      });
    }
  }
  /***************************************************************************
   * METHODS FOR PROVIDE
   ***************************************************************************/
  const toCreate = (schedule) => {
    try {
      return validatedManager.value?.toCreate?.(schedule);
    } catch (error) {
      logger.error({
        message: "Failed to create schedule",
        error,
      });
    }
  };

  const toUpdate = (schedule) => {
    try {
      return validatedManager.value?.toUpdate?.(schedule);
    } catch (error) {
      logger.error({
        message: "Failed to update schedule",
        error,
      });
    }
  };

  const toDelete = (schedule) => {
    try {
      return validatedManager.value?.toDelete?.(schedule);
    } catch (error) {
      logger.error({
        message: "Failed to delete schedule",
        error,
      });
    }
  };

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
    dateRange,
    site,
    statistics,

    // Methods for managing schedules provided by the manager.
    toCreate,
    toUpdate,
    toDelete,
  };
}
