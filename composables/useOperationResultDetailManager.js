/**
 * @file @/composables/useOperationResultDetailManager.js
 * @description Composable for managing operation result details.
 */
import * as Vue from "vue";
import { Employee, Outsourcer, OperationResultDetail } from "@/schemas";
import {
  CONTRACT_STATUS_ACTIVE,
  EMPLOYMENT_STATUS_ACTIVE,
} from "air-guard-v2-schemas/constants";
import { useLogger } from "@/composables/useLogger";

export function useOperationResultDetailManager() {
  /** define composables */
  const sender = "useOperationResultDetailManager";
  const logger = useLogger();

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
