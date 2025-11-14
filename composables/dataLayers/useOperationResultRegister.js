/*****************************************************************************
 * useOperationResultRegister
 * @version 1.0.0
 * @description A data layer composable for operation result register.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

/**
 * @returns {Array} docs - Array of SiteOperationSchedule documents without operationResultId and dated before today
 * @returns {Object} fetchSiteComposable - Composable for fetching site data
 * @returns {Object} fetchEmployeeComposable - Composable for fetching employee data
 * @returns {Object} fetchOutsourcerComposable - Composable for fetching outsourcer data
 */
export function useOperationResultRegister() {
  const instance = Vue.reactive(new SiteOperationSchedule());
  const notificationInstance = Vue.reactive(new ArrangementNotification());

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const { fetchSite, cachedSites } = useFetchSite();
  const { fetchEmployee, cachedEmployees } = useFetchEmployee();
  const { fetchOutsourcer, cachedOutsourcers } = useFetchOutsourcer();

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  function _subscribe() {
    const constraints = [
      ["where", "operationResultId", "==", null],
      ["where", "date", "<", dayjs().format("YYYY-MM-DD")],
      ["orderBy", "date"],
    ];
    const callback = (item) => {
      fetchSite(item);
      fetchEmployee(item.employeeIds);
      fetchOutsourcer(item.outsourcerIds);
    };
    instance.subscribeDocs({ constraints }, callback);
  }

  /*****************************************************************************
   * LIFECYCLE HOOKS
   *****************************************************************************/
  Vue.onMounted(() => {
    _subscribe();
  });

  Vue.onUnmounted(() => {
    instance.unsubscribe();
    notificationInstance.unsubscribe();
  });

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    docs: Vue.readonly(instance.docs),

    cachedSites,
    cachedEmployees,
    cachedOutsourcers,
  };
}
