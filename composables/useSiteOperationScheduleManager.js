/**
 * @file useSiteOperationScheduleManager.js
 * @description Composable for managing site operation schedules.
 */
import * as Vue from "vue";
import {
  Employee,
  OperationResultDetail,
  Outsourcer,
  SiteOperationSchedule,
} from "@/schemas";
import {
  EMPLOYMENT_STATUS_ACTIVE,
  CONTRACT_STATUS_ACTIVE,
} from "air-guard-v2-schemas/constants";
import { useFetchEmployee } from "@/composables/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/useFetchOutsourcer";
import { useFetchSite } from "@/composables/useFetchSite";

export function useSiteOperationScheduleManager({ manager, siteId } = {}) {
  if (!manager) {
    console.warn(
      "Manager should be provided to useSiteOperationScheduleManager."
    );
  }

  /** define instance */
  const instance = Vue.reactive(new SiteOperationSchedule());

  /** define composables */
  const { fetchEmployee, cachedEmployees, pushEmployees } = useFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers, pushOutsourcers } =
    useFetchOutsourcer();
  const { fetchSite, cachedSites } = useFetchSite();

  /** define refs */
  const docs = Vue.ref([]); // subscribed documents
  const selectableEmployees = Vue.ref([]);
  const selectableOutsourcers = Vue.ref([]);

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watch(docs, (newDocs) => fetchRelatedData(Vue.toRaw(newDocs)), {
    deep: true,
  });

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(async () => {
    await Promise.all([
      _initializeSelectableEmployees(),
      _initializeSelectableOutsourcers(),
    ]);
  });

  Vue.onUnmounted(() => {
    instance.unsubscribe();
  });

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  /**
   * Initializes the schedule manager with the specified date range.
   * @param {Object} params - Initialization parameters.
   * @param {Date} params.from - Start date of the range.
   * @param {Date} params.to - End date of the range.
   * @param {string} [params.siteId] - Optional site ID to filter schedules.
   * @returns {void}
   */
  const initialize = ({ from, to }) => {
    if (!from || !to) {
      console.error("Invalid date range provided for initialization.");
      return;
    }

    const constraints = [
      ["where", "dateAt", ">=", from],
      ["where", "dateAt", "<=", to],
    ];

    if (siteId) constraints.push(["where", "siteId", "==", siteId]);

    docs.value = instance.subscribeDocs({ constraints });
  };

  const _initializeSelectableEmployees = async () => {
    const instance = new Employee();
    const constraints = [
      ["where", "employmentStatus", "==", EMPLOYMENT_STATUS_ACTIVE],
    ];
    const fetchedData = await instance.fetchDocs({ constraints });

    // Cache the fetched employees.
    pushEmployees(fetchedData);

    selectableEmployees.value = fetchedData.map((emp) => {
      return new OperationResultDetail({
        workerId: emp.docId,
        isEmployee: true,
      });
    });
  };

  const _initializeSelectableOutsourcers = async () => {
    const instance = new Outsourcer();
    const constraints = [
      ["where", "contractStatus", "==", CONTRACT_STATUS_ACTIVE],
    ];
    const fetchedData = await instance.fetchDocs({ constraints });

    // Cache the fetched outsourcers.
    pushOutsourcers(fetchedData);

    selectableOutsourcers.value = fetchedData.map((out) => {
      return new OperationResultDetail({
        workerId: out.docId,
        isEmployee: false,
      });
    });
  };

  /**
   * Fetch related data from the provided documents.
   * - employees, outsourcers, and sites.
   * @param {Array} newDocs
   */
  function fetchRelatedData(newDocs) {
    if (!Array.isArray(newDocs) || newDocs.length === 0) return;

    const allSites = newDocs.map((schedule) => schedule.siteId);
    if (allSites.length > 0) fetchSite(allSites);

    const allEmployees = newDocs.flatMap((schedule) => {
      const rawSchedule = Vue.toRaw(schedule);
      return Array.isArray(rawSchedule.employees) ? rawSchedule.employees : [];
    });
    if (allEmployees.length > 0) fetchEmployee(allEmployees);

    const allOutsourcers = newDocs.flatMap((schedule) => {
      const rawSchedule = Vue.toRaw(schedule);
      return Array.isArray(rawSchedule.outsourcers)
        ? rawSchedule.outsourcers
        : [];
    });
    if (allOutsourcers.length > 0) fetchOutsourcer(allOutsourcers);
  }

  /** ArrayManager configuration object */
  const arrayManager = Vue.computed(() => ({
    modelValue: docs.value,
    schema: SiteOperationSchedule,
    beforeEdit: (editMode, item) => {
      if (siteId) item.siteId = siteId.value;
    },
    handleCreate: async (item) => await item.create(),
    handleUpdate: async (item) => await item.update(),
    handleDelete: async (item) => await item.delete(),
  }));

  const itemManager = Vue.computed(() => {
    return {
      modelValue: instance,
    };
  });

  return {
    selectableEmployees,
    selectableOutsourcers,
    cachedEmployees,
    cachedOutsourcers,
    cachedSites,
    docs,
    schema: SiteOperationSchedule,
    instance,
    initialize,
    arrayManager,
    itemManager,
    toCreate: () => manager?.value?.toCreate?.(),
    toUpdate: (schedule) => manager?.value?.toUpdate?.(schedule),
    toDelete: (schedule) => manager?.value?.toDelete?.(schedule),
  };
}
