import { syncBillingReferences } from "./billingReferencePlan.js";
export function removeOperationResultFromBilling({ companyId, operationResult, ...options } = {}) {
  return syncBillingReferences({ ...options, companyId, before: operationResult });
}