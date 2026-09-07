import { syncBillingReferences } from "./billingReferencePlan.js";
export function addOperationResultToBilling({ companyId, doc, ...options } = {}) {
  return syncBillingReferences({ ...options, companyId, after: doc });
}