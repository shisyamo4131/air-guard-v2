import { getFirestore } from "firebase-admin/firestore";
import { rebuildHistory } from "./rebuildHistory.js";
import { assertBackgroundId, assertOperationRaw, failReference } from "../employees/backgroundReferencePlan.js";
import { operationEmployeeReferences } from "../../shared/operationReferences.js";
export async function rebuildAllHistories(companyId, { firestore = getFirestore() } = {}) {
  assertBackgroundId(companyId);
  const snapshot = await firestore.collection(`Companies/${companyId}/OperationResults`).get();
  const pairs = new Set();
  // Read complete raw and validate all results before rebuilding any history.
  // A missing/forged index must never be silently skipped by a projection.
  for (const document of snapshot.docs) {
    const raw = assertOperationRaw(document.data());
    if (raw.docId !== document.id) failReference();
    for (const id of operationEmployeeReferences(raw)) pairs.add(JSON.stringify([raw.siteId, id]));
  }
  for (const pair of pairs) { const [siteId, employeeId] = JSON.parse(pair); await rebuildHistory(companyId, siteId, employeeId, { firestore }); }
}