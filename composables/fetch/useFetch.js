/*****************************************************************************
 * @file ./composables/fetch/useFetch.js
 * @description Inject `fetchEmployee`, `fetchOutsourcer` and `fetchSite` composable to component.
 *****************************************************************************/
import * as Vue from "vue";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useAuthStore } from "@/stores/useAuthStore";

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
  const fetchEmployeeComposable = isOrigin
    ? useFetchEmployee()
    : Vue.inject("fetchEmployeeComposable", employeeFactory, true);
  const fetchOutsourcerComposable = isOrigin
    ? useFetchOutsourcer()
    : Vue.inject("fetchOutsourcerComposable", outsourcerFactory, true);
  const fetchSiteComposable = isOrigin
    ? useFetchSite()
    : Vue.inject("fetchSiteComposable", siteFactory, true);

  /*****************************************************************************
   * PROVIDES
   *****************************************************************************/
  if (isOrigin) {
    if (isDev) {
      logger.info({
        message:
          "Providing fetchEmployeeComposable, fetchOutsourcerComposable and fetchSiteComposable.",
      });
    }
    Vue.provide("fetchEmployeeComposable", fetchEmployeeComposable);
    Vue.provide("fetchOutsourcerComposable", fetchOutsourcerComposable);
    Vue.provide("fetchSiteComposable", fetchSiteComposable);
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
    fetchSiteComposable,
  };
}
