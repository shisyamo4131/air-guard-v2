/*****************************************************************************
 * useEmployeeManager
 * @version 1.0.0
 * @description A composable to manage employee information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { Employee } from "@/schemas";
import { useDocManager } from "@/composables/useDocManager";

/**
 * @param {Object} options - Options for the composable
 * @param {Object} options.doc - Reactive employee instance to manage
 * @param {string} options.redirectPath - Path to redirect after deletion
 * - Defaults to "/employees"
 * - The path is also used after marking an employee as terminated.
 * @returns {Object} - The employee manager composable
 * @returns {Object} doc - Reactive employee instance
 * @returns {Object} attrs - Computed attributes for the employee component
 * @returns {Object} info - Information for the information-card component.
 * @returns {Object} info.base - Base information about the company.
 * @returns {boolean} isDev - Flag indicating if the environment is development
 * @returns {Object} logger - Logger instance for logging messages and errors
 * @returns {Function} toCreate - Method to trigger create operation
 * @returns {Function} toUpdate - Method to trigger update operation
 * @returns {Function} toDelete - Method to trigger delete operation
 * @returns {Function} toTerminated - Method to update employee status to terminated
 */
export function useEmployeeManager({
  doc = Vue.reactive(new Employee()),
  redirectPath = "/employees",
} = {}) {
  /** SETUP DOC MANAGER COMPOSABLE */
  const docManager = useDocManager("useEmployeeManager", {
    doc,
    redirectPath,
  });

  /***************************************************************************
   * METHODS (PUBLIC)
   ***************************************************************************/
  /**
   * Update the employee's status to terminated.
   * - Redirects to the employee list page upon success if a redirect path is provided.
   * @param {Date} terminationDate - The date of termination
   * @param {string} reasonOfTermination - The reason for termination
   * @returns {Promise<void>}
   * @throws {Error} if the termination date is invalid.
   * @throws {Error} if the termination process fails.
   */
  async function toTerminated(terminationDate, reasonOfTermination, callback) {
    if (!terminationDate || !(terminationDate instanceof Date)) {
      docManager.logger.error({
        message: "退職日が不正です。",
      });
      return;
    }
    if (!reasonOfTermination || typeof reasonOfTermination !== "string") {
      docManager.logger.error({
        message: "退職理由が不正です。",
      });
      return;
    }
    try {
      await doc.toTerminated(terminationDate, reasonOfTermination);
      if (callback && typeof callback === "function") {
        callback();
      }
      if (redirectPath) {
        docManager.router.replace(redirectPath);
      }
    } catch (error) {
      docManager.logger.error({
        message: "退職処理で不明なエラーが発生しました。",
        error,
      });
    }
  }

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    ...docManager,

    toTerminated,
  };
}
