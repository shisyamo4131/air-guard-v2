/**
 * @file @/composables/useOperationResultDetailManager.js
 * @description Composable for managing operation result details.
 * This composable internally uses the `useFetchEmployee` and `useFetchOutsourcer` composables to fetch and manage employee and outsourcer data.
 * You can provide your own instances of these composables via the options, or let this composable create its own.
 *
 * Example usage:
 *
 * ```js
 * import { useOperationResultDetailManager } from "@/composables/useOperationResultDetailManager";
 *
 * // Optionally, create your own composable instances
 * import { useFetchEmployee } from "@/composables/useFetchEmployee";
 * import { useFetchOutsourcer } from "@/composables/useFetchOutsourcer";
 *
 * const fetchEmployeeComposable = useFetchEmployee();
 * const fetchOutsourcerComposable = useFetchOutsourcer();
 *
 * // Pass them in, or omit to use internal ones
 * const {
 *   employees,
 *   outsourcers,
 *   initialize,
 * } = useOperationResultDetailManager({
 *   fetchEmployeeComposable,
 *   fetchOutsourcerComposable,
 * });
 *
 * // Or simply:
 * // const { employees, outsourcers, initialize } = useOperationResultDetailManager();
 * ```
 * @param {Object} options
 * @param {Object} [options.fetchEmployeeComposable] - Already created useFetchEmployee composable instance
 * @param {Object} [options.fetchOutsourcerComposable] - Already created useFetchOutsourcer composable instance
 */
import * as Vue from "vue";
import { Employee, Outsourcer, OperationResultDetail } from "@/schemas";
import {
  CONTRACT_STATUS_ACTIVE,
  EMPLOYMENT_STATUS_ACTIVE,
} from "air-guard-v2-schemas/constants";
import { useLogger } from "@/composables/useLogger";
import { useFetchEmployee as internalUseFetchEmployee } from "@/composables/useFetchEmployee";
import { useFetchOutsourcer as internalUseFetchOutsourcer } from "@/composables/useFetchOutsourcer";

export function useOperationResultDetailManager({
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
} = {}) {
  /** define composables */
  const sender = "useOperationResultDetailManager";
  const logger = useLogger();
  // Use provided composable instances if specified, otherwise create internal ones.
  const { pushEmployees } = fetchEmployeeComposable
    ? fetchEmployeeComposable
    : internalUseFetchEmployee();
  const { pushOutsourcers } = fetchOutsourcerComposable
    ? fetchOutsourcerComposable
    : internalUseFetchOutsourcer();

  /** define instances */
  const employeeInstance = Vue.reactive(new Employee());
  const outsourcerInstance = Vue.reactive(new Outsourcer());

  /** define refs */
  const employees = Vue.ref([]);
  const outsourcers = Vue.ref([]);

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onMounted(async () => {
    await initialize();
  });

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  /**
   * Initialize composable.
   */
  async function initialize() {
    logger.clearError();
    try {
      await Promise.all([_initEmployees(), _initOutsourcers()]);
    } catch (error) {
      logger.error({ sender, message: error.message, error });
    }
  }

  /**
   * initialize employees.
   */
  async function _initEmployees() {
    const constraints = [
      ["where", "employmentStatus", "==", EMPLOYMENT_STATUS_ACTIVE],
    ];
    const fetchedDocs = await employeeInstance.fetchDocs({
      constraints,
    });

    pushEmployees(fetchedDocs);

    employees.value = fetchedDocs.map((doc) => {
      return new OperationResultDetail({
        workerId: doc.docId,
        isEmployee: true,
      });
    });
  }

  /**
   * initialize outsourcers.
   */
  async function _initOutsourcers() {
    const constraints = [
      ["where", "contractStatus", "==", CONTRACT_STATUS_ACTIVE],
    ];
    const fetchedDocs = await outsourcerInstance.fetchDocs({
      constraints,
    });

    pushOutsourcers(fetchedDocs);

    outsourcers.value = fetchedDocs.map((doc) => {
      return new OperationResultDetail({
        workerId: doc.docId,
        isEmployee: false,
      });
    });
  }

  return {
    employees,
    outsourcers,
    initialize,
  };
}
