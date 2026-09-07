import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { parseDate, equal } from "../../shared/employeeContract.js";
import { readAddedEmployees, operationEmployeeReferences } from "../../shared/operationReferences.js";
import { assertBackgroundId, assertOperationRaw, failReference } from "../employees/backgroundReferencePlan.js";
import { historyEmployeeReferences } from "./historyContract.js";

export async function rebuildHistory(companyId, siteId, employeeId, { firestore = getFirestore() } = {}) {
  [companyId, siteId, employeeId].forEach((value) => assertBackgroundId(value));
  const prefix = `Companies/${companyId}`;
  const historyRef = firestore.doc(`${prefix}/SiteEmployeeHistories/${siteId}_${employeeId}`);
  const query = firestore.collection(`${prefix}/OperationResults`).where("siteId", "==", siteId).where("employeeIds", "array-contains", employeeId);
  await firestore.runTransaction(async (transaction) => {
    const [historySnapshot, firstSnapshot, lastSnapshot, siteSnapshot] = await Promise.all([
      transaction.get(historyRef), transaction.get(query.orderBy("date").limit(1)),
      transaction.get(query.orderBy("date", "desc").limit(1)), transaction.get(firestore.doc(`${prefix}/Sites/${siteId}`)),
    ]);
    const before = historySnapshot.exists ? historySnapshot.data() : null;
    if (before) { historyEmployeeReferences(before); if (before.docId !== historyRef.id) failReference(); }
    if (firstSnapshot.empty !== lastSnapshot.empty) failReference();
    if (firstSnapshot.empty) { if (before) transaction.delete(historyRef); return; }
    if (!siteSnapshot.exists) failReference();
    const [first, last] = [firstSnapshot.docs[0], lastSnapshot.docs[0]];
    for (const doc of [first, last]) {
      const raw = assertOperationRaw(doc.data());
      if (raw.docId !== doc.id || raw.siteId !== siteId || !operationEmployeeReferences(raw).has(employeeId)) failReference();
      parseDate(raw.date);
    }
    const after = { ...(before || {}), docId: historyRef.id, siteId, employeeId };
    for (const [part, document] of [["first", first], ["last", last]]) {
      const date = document.data().date;
      if (!before || before[`${part}Date`] !== date) after[`${part}DateAt`] = Timestamp.fromDate(parseDate(date));
      after[`${part}Date`] = date; after[`${part}OperationResultId`] = document.id;
    }
    historyEmployeeReferences(after);
    await readAddedEmployees(transaction, firestore, companyId, [{ before, after, references: historyEmployeeReferences }]);
    if (equal(before, after)) return;
    const payload = { ...after, updatedAt: FieldValue.serverTimestamp() };
    if (!before) { payload.createdAt = FieldValue.serverTimestamp(); payload.uid = "system"; }
    transaction.set(historyRef, payload);
  });
}