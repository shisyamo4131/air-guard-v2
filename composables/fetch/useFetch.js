/*****************************************************************************
 * @file ./composables/fetch/useFetch.js
 * @description Inject `fetchEmployee`, `fetchOutsourcer` and `fetchSite` composable to component.
 *
 * Behavior:
 * - isOrigin = true: Always create new instances and provide them (ignore parent's provide)
 * - isOrigin = false: Use parent's provided composables if available, otherwise create and provide new instances
 *****************************************************************************/
import * as Vue from "vue";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Provides `fetchEmployee`, `fetchOutsourcer` and `fetchSite` composable to component.
 * If `isOrigin` is true, it will provide the composables to the component.
 * Otherwise, it will try to inject the composables from the parent component and
 * if not provided, it will create a new instance of the composables using the factory functions.
 * @param {*} componentName
 * @param {*} isOrigin
 * @returns
 */
export function useFetch(componentName, isOrigin = false) {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger(componentName, useErrorsStore());
  const auth = useAuthStore();
  const { isDev } = auth;

  /*****************************************************************************
   * FACTORY FUNCTIONS
   *****************************************************************************/
  const employeeFactory = () => {
    if (isDev) {
      logger.warn({
        message:
          "fetchEmployeeComposable is not provided. Using default useFetchEmployee.",
      });
    }
    return useFetchEmployee();
  };

  const outsourcerFactory = () => {
    if (isDev) {
      logger.warn({
        message:
          "fetchOutsourcerComposable is not provided. Using default useFetchOutsourcer.",
      });
    }
    return useFetchOutsourcer();
  };

  const siteFactory = () => {
    if (isDev) {
      logger.warn({
        message:
          "fetchSiteComposable is not provided. Using default useFetchSite.",
      });
    }
    return useFetchSite();
  };

  /*****************************************************************************
   * SETUP FETCH COMPOSABLES
   *****************************************************************************/
  let fetchEmployeeComposable;
  let isEmployeeComposableProvided = false;
  if (isOrigin) {
    fetchEmployeeComposable = useFetchEmployee();
  } else {
    const injected = Vue.inject("fetchEmployeeComposable", null);
    isEmployeeComposableProvided = injected !== null;
    fetchEmployeeComposable = isEmployeeComposableProvided
      ? injected
      : employeeFactory();
  }

  let fetchOutsourcerComposable;
  let isOutsourcerComposableProvided = false;
  if (isOrigin) {
    fetchOutsourcerComposable = useFetchOutsourcer();
  } else {
    const injected = Vue.inject("fetchOutsourcerComposable", null);
    isOutsourcerComposableProvided = injected !== null;
    fetchOutsourcerComposable = isOutsourcerComposableProvided
      ? injected
      : outsourcerFactory();
  }

  let fetchSiteComposable;
  let isSiteComposableProvided = false;
  if (isOrigin) {
    fetchSiteComposable = useFetchSite();
  } else {
    const injected = Vue.inject("fetchSiteComposable", null);
    isSiteComposableProvided = injected !== null;
    fetchSiteComposable = isSiteComposableProvided ? injected : siteFactory();
  }

  /*****************************************************************************
   * PROVIDES
   *****************************************************************************/
  if (isOrigin) {
    // isOrigin = true: Always provide (ignore parent's provide)
    if (isDev) {
      logger.info({
        message:
          "[isOrigin=true] Providing fetchEmployeeComposable, fetchOutsourcerComposable and fetchSiteComposable.",
      });
    }
    Vue.provide("fetchEmployeeComposable", fetchEmployeeComposable);
    Vue.provide("fetchOutsourcerComposable", fetchOutsourcerComposable);
    Vue.provide("fetchSiteComposable", fetchSiteComposable);
  } else {
    // isOrigin = false: Provide only if not provided by parent
    if (!isEmployeeComposableProvided) {
      Vue.provide("fetchEmployeeComposable", fetchEmployeeComposable);
    }
    if (!isOutsourcerComposableProvided) {
      Vue.provide("fetchOutsourcerComposable", fetchOutsourcerComposable);
    }
    if (!isSiteComposableProvided) {
      Vue.provide("fetchSiteComposable", fetchSiteComposable);
    }
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
    fetchSiteComposable,
    isEmployeeComposableProvided,
    isOutsourcerComposableProvided,
    isSiteComposableProvided,
  };
}
