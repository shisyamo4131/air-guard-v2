import { getFirestore } from "firebase-admin/firestore";
import { DailyAttendance, DailyOperationByEmployee } from "@shisyamo4131/air-guard-v2-schemas";
import { aggregateEmployeeReferences } from "../../shared/operationReferences.js";
import { assertBackgroundId, assertOperationRaw, calculationOperation, aggregateModel, inspectAggregate, aggregateCandidate, commitBackgroundPlans, failReference } from "./backgroundReferencePlan.js";

const type = (attendance) => attendance ? DailyAttendance : DailyOperationByEmployee;
const contexts = new WeakMap();
function entriesFor(raw, attendance) {
  return calculationOperation(raw).employees.map((worker) => ({ employeeId: worker.id, date: attendance ? worker.attendanceDate : worker.date, dateAt: attendance ? worker.attendanceDateAt : worker.dateAt }));
}
export async function fetchDailyTargets({ companyId, operationResult, transaction, attendance, targets = new Map(), firestore = getFirestore(), related = false }) {
  assertBackgroundId(companyId); assertOperationRaw(operationResult);
  if (!transaction) failReference();
  const Schema = type(attendance), prefix = `Companies/${companyId}/${Schema.collectionPath}`;
  const remember = (ref, raw, initial) => {
    if (targets.has(ref.id)) return;
    if (raw) inspectAggregate(raw, { daily: true, docId: ref.id });
    const data = raw || { ...initial, docId: ref.id, operationResults: [], operationResultIds: [], employeeIds: [initial.employeeId] };
    const entry = { instance: aggregateModel(Schema, data), exists: raw !== null, raw, ref, operationResults: raw?.operationResults || [] };
    contexts.set(entry, { transaction, companyId, attendance, initial: data });
    targets.set(ref.id, entry);
  };
  if (related) {
    const query = firestore.collection(prefix).where("operationResultIds", "array-contains", operationResult.docId);
    const snapshot = await transaction.get(query);
    for (const doc of snapshot.docs) remember(doc.ref, doc.data());
  }
  for (const target of entriesFor(operationResult, attendance)) {
    const id = `${target.employeeId}_${target.date}`;
    if (targets.has(id)) continue;
    const ref = firestore.doc(`${prefix}/${id}`), snapshot = await transaction.get(ref);
    remember(ref, snapshot.exists ? snapshot.data() : null, target);
  }
  return [...targets.values()];
}
export function changeDailyResults(entries, operationResult, attendance, remove = false) {
  assertOperationRaw(operationResult);
  if (!Array.isArray(entries)) failReference();
  const destinations = new Set(entriesFor(operationResult, attendance).map((item) => `${item.employeeId}_${item.date}`));
  for (const entry of entries) {
    const context = contexts.get(entry);
    if (!context || context.attendance !== attendance) failReference();
    if (!remove && !destinations.has(entry.ref.id)) continue;
    entry.operationResults = entry.operationResults.filter((raw) => raw.docId !== operationResult.docId);
    if (!remove) entry.operationResults.push(operationResult);
    entry.instance.operationResults = entry.operationResults.map(calculationOperation);
  }
}
export async function saveDailyTargets({ companyId, entries, transaction, attendance, firestore = getFirestore() }) {
  if (!Array.isArray(entries) || !transaction) failReference();
  const plans = entries.map((entry) => {
    const context = contexts.get(entry);
    if (!context || context.transaction !== transaction || context.companyId !== companyId || context.attendance !== attendance) failReference();
    const { after, model } = aggregateCandidate(type(attendance), entry.raw, context.initial, entry.operationResults, true);
    const keep = attendance ? model.isAttended : entry.operationResults.length > 0;
    return { ref: entry.ref, before: entry.raw, after: keep ? after : null };
  });
  return commitBackgroundPlans({ firestore, transaction, companyId, plans, daily: true });
}
export async function syncDailyReferences({ companyId, beforeData, afterData, attendance, firestore = getFirestore() }) {
  assertBackgroundId(companyId);
  if (!beforeData && !afterData) failReference();
  if (beforeData) assertOperationRaw(beforeData);
  if (afterData) assertOperationRaw(afterData);
  if (beforeData && afterData && beforeData.docId !== afterData.docId) failReference();
  await firestore.runTransaction(async (transaction) => {
    const targets = new Map();
    const options = { companyId, transaction, attendance, targets, firestore };
    // Preserve each collection's existing lookup behavior; destination reads
    // supply the before-image even for moved/deleted/recreated aggregates.
    if (beforeData) await fetchDailyTargets({ ...options, operationResult: beforeData, related: !attendance });
    if (afterData) await fetchDailyTargets({ ...options, operationResult: afterData, related: !attendance && !beforeData });
    const entries = [...targets.values()];
    changeDailyResults(entries, beforeData || afterData, attendance, true);
    if (afterData) changeDailyResults(entries, afterData, attendance);
    await saveDailyTargets({ ...options, entries });
  });
}
