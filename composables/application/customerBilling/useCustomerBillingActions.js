import { useBillingPdf } from "@/composables/pdf/useBillingPdf";
import { useFetch } from "@/composables/fetch/useFetch";
import { useLogger } from "@/composables/useLogger";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { exportOperationResultsCsv } from "@/utils/csv/exportOperationResultsCsv";

/*****************************************************************************
 * @file composables/application/customerBilling/useCustomerBillingActions.js
 * @description 取引先請求のPDF・CSV出力に必要なアプリケーション処理を提供します。
 *****************************************************************************/
export function useCustomerBillingActions(options = {}) {
  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const loadings = useLoadingsStore();
  const logger = useLogger("useCustomerBillingActions", useErrorsStore());
  const fetchComposables = options.fetchSiteComposable
    ? options
    : useFetch("useCustomerBillingActions");
  const { fetchSiteComposable } = fetchComposables;
  const { fetchSite, cachedSites } = fetchSiteComposable;
  const { generateBillingPdf, generateConsolidatedBillingPdf } =
    useBillingPdf();

  /***************************************************************************
   * METHODS
   ***************************************************************************/
  async function downloadBillingPdf(billing) {
    const key = loadings.add("Creating billing PDF");
    try {
      await generateBillingPdf(billing);
    } catch (error) {
      logger.error({ message: "Failed to create billing PDF", error });
    } finally {
      loadings.remove(key);
    }
  }

  async function downloadConsolidatedBillingPdf(billings) {
    const key = loadings.add("Creating billing PDF");
    try {
      await generateConsolidatedBillingPdf(billings);
    } catch (error) {
      logger.error({ message: "Failed to create billing PDF", error });
    } finally {
      loadings.remove(key);
    }
  }

  async function downloadCsv(billings) {
    const key = loadings.add("Creating billing CSV");
    try {
      const operationResults = billings.flatMap(
        (billing) => billing.operationResults ?? [],
      );
      await fetchSite(operationResults);

      exportOperationResultsCsv({
        operationResults,
        cachedSites: cachedSites.value,
      });
    } catch (error) {
      logger.error({ message: "Failed to create billing CSV", error });
    } finally {
      loadings.remove(key);
    }
  }

  return {
    downloadBillingPdf,
    downloadConsolidatedBillingPdf,
    downloadCsv,
  };
}
