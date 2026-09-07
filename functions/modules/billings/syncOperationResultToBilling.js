import { syncBillingReferences } from "./billingReferencePlan.js";
export function syncOperationResultToBilling(options = {}) {
  return syncBillingReferences(options);
}