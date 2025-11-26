/**
 * Data Store
 */
import { useInvalidOperationBilling } from "@/composables/dataLayers/useInvalidOperationBilling";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

export const useDataStore = defineStore("data", () => {
  /** SETUP COMPOSABLES */
  const fetchSiteComposable = useFetchSite();
  const fetchEmployeeComposable = useFetchEmployee();
  const fetchOutsourcerComposable = useFetchOutsourcer();
  const invalidOperationBilling = useInvalidOperationBilling({
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
    limit: 10,
  });

  return {
    invalidOperationBillings: invalidOperationBilling.docs,
    cachedSites: fetchSiteComposable.cachedSites,
    cachedEmployees: fetchEmployeeComposable.cachedEmployees,
    cachedOutsourcers: fetchOutsourcerComposable.cachedOutsourcers,
  };
});
