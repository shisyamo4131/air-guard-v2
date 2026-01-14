/**
 * Data Store
 */
import dayjs from "dayjs";
import * as Vue from "vue";
import { OperationResult, Site, SiteOperationSchedule } from "@/schemas";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

export const useStatisticsStore = defineStore("statistics", () => {
  /** SETUP COMPOSABLES */
  const {
    fetchSite,
    cachedSites,
    cachedSitesArray,
    clearCache: clearSites,
  } = useFetchSite();
  const {
    fetchEmployee,
    cachedEmployees,
    clearCache: clearEmployees,
  } = useFetchEmployee();
  const {
    fetchOutsourcer,
    cachedOutsourcers,
    clearCache: clearOutsourcers,
  } = useFetchOutsourcer();

  /** SETUP REACTIVE OBJECTS */
  const operationResultInstance = Vue.reactive(new OperationResult());
  const scheduleInstance = Vue.reactive(new SiteOperationSchedule());
  const siteInstance = Vue.reactive(new Site());

  /** COMPUTED PROPERTIES */
  const invalidOperationBillings = Vue.computed(() => {
    return operationResultInstance.docs;
  });

  const operationCount = Vue.computed(() => {
    return scheduleInstance.docs.reduce(
      (acc, schedule) => acc + schedule.requiredPersonnel,
      0
    );
  });

  const siteCount = Vue.computed(() => {
    return siteInstance.docs.length;
  });

  /** METHODS */
  function start() {
    operationResultInstance.subscribeDocs(
      {
        constraints: [
          ["where", "isInvalid", "!=", false],
          ["limit", 10],
        ],
      },
      (doc, changeType) => {
        if (changeType === "removed") return;
        fetchSite(doc.siteId);
        fetchEmployee(doc.employeeIds);
        fetchOutsourcer(doc.outsourcerIds);
      }
    );
    scheduleInstance.subscribeDocs({
      constraints: [["where", "date", "==", dayjs().format("YYYY-MM-DD")]],
    });
    siteInstance.subscribeDocs({
      constraints: [["where", "status", "==", Site.STATUS_ACTIVE]],
    });
  }

  function stop() {
    operationResultInstance.unsubscribe();
    scheduleInstance.unsubscribe();
    siteInstance.unsubscribe();
    clearSites;
    clearEmployees;
    clearOutsourcers;
  }

  return {
    operationCount,
    siteCount,

    /**
     * 仮登録状態の現場数
     */
    temporarySiteCount: computed(
      () => siteInstance.docs.filter(({ isTemporary }) => isTemporary).length
    ),
    invalidOperationBillings,

    cachedSites,
    cachedEmployees,
    cachedOutsourcers,

    start,
    stop,
  };
});
