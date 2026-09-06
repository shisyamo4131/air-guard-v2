import { getFirestore } from "firebase-admin/firestore";
import { Billing, Customer } from "@shisyamo4131/air-guard-v2-schemas";
import { rawForClass } from "../../shared/employeeContract.js";
import { getBillingKey } from "./utils.js";
import { assertLiveSiteReference } from "../sites/liveSiteReference.js";
import { assertBackgroundId, assertOperationRaw, inspectAggregate, aggregateCandidate, commitBackgroundPlans, failReference } from "../employees/backgroundReferencePlan.js";

export async function syncBillingReferences({ companyId, before = null, after = null, firestore = getFirestore() }) {
  assertBackgroundId(companyId);
  if (!before && !after) failReference();
  for (const raw of [before, after].filter(Boolean)) {
    assertOperationRaw(raw);
    if (typeof raw.isBillable !== "boolean") failReference();
  }
  if (before && after && before.docId !== after.docId) failReference();
  const oldId = before?.isBillable ? getBillingKey(before) : null;
  const newId = after?.isBillable ? getBillingKey(after) : null;
  if (!oldId && !newId) return;
  await firestore.runTransaction(async (transaction) => {
    const plans = new Map();
    for (const id of new Set([oldId, newId].filter(Boolean))) {
      const ref = firestore.doc(`Companies/${companyId}/Billings/${id}`), snapshot = await transaction.get(ref);
      const raw = snapshot.exists ? snapshot.data() : null;
      if (raw) {
        inspectAggregate(raw, { daily: false, docId: id });
        if (getBillingKey(raw) !== id) failReference();
      }
      plans.set(id, { ref, before: raw, after: raw });
    }
    let initial = null;
    if (newId && !plans.get(newId).before) {
      const customer = await transaction.get(firestore.doc(`Companies/${companyId}/Customers/${after.customerId}`));
      if (!customer.exists) failReference();
      await assertLiveSiteReference({ firestore, transaction, companyId, siteId: after.siteId });
      const billingDateAt = rawForClass(after.billingDateAt);
      if (!(billingDateAt instanceof Date) || !Number.isFinite(billingDateAt.getTime())) failReference();
      const paymentDueDateAt = new Customer(rawForClass(customer.data())).getPaymentDueDateAt(billingDateAt);
      initial = new Billing({ docId: newId, customerId: after.customerId, siteId: after.siteId, billingDateAt, paymentDueDateAt, status: Billing.STATUS.DRAFT }).toObject();
    }
    for (const [id, plan] of plans) {
      const operationResults = (plan.before?.operationResults || []).filter((raw) => raw.docId !== (before || after).docId);
      if (id === newId) operationResults.push(after);
      if (!operationResults.length) { plan.after = null; continue; }
      plan.after = aggregateCandidate(Billing, plan.before, initial, operationResults, false).after;
    }
    await commitBackgroundPlans({ firestore, transaction, companyId, plans: [...plans.values()] });
  });
}
