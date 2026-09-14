import { FieldValue } from "firebase-admin/firestore";
import { OperationResult } from "@shisyamo4131/air-guard-v2-schemas";
import { identifier, plain, rawForClass, equal } from "../../shared/employeeContract.js";
import { operationDateTime } from "../../shared/operationDateTime.js";
import { mergeCalculated } from "../../shared/operationWriteContract.js";
import { OperationWriteError } from "../../shared/operationReferences.js";

export const failReference = () => { throw new OperationWriteError("failed-precondition", "参照情報を確認できません。"); };
export function assertBackgroundId(value, max = 128) {
  if (typeof value !== "string" || !value.length || value.length > max || value.trim() !== value || /[\/\u0000-\u001f\u007f]/u.test(value)) failReference();
}
export function assertOperationRaw(raw) {
  if (!plain(raw) || !identifier(raw.docId) || !Array.isArray(raw.employees) || !Array.isArray(raw.outsourcers)) failReference();
  return raw;
}
export function calculationOperation(raw) {
  assertOperationRaw(raw);
  return operationDateTime(new OperationResult(rawForClass(raw)));
}
export function aggregateModel(Schema, raw) {
  const model = new Schema(rawForClass(raw));
  model.operationResults = raw.operationResults.map(calculationOperation);
  return model;
}
export function inspectAggregate(raw, { daily, docId }) {
  if (!plain(raw) || raw.docId !== docId) failReference();
  assertBackgroundId(docId, 1500);
  if (!Array.isArray(raw.operationResults)) failReference();
  const operationResultIds = raw.operationResults.map((operation) => assertOperationRaw(operation).docId);
  if (new Set(operationResultIds).size !== operationResultIds.length) failReference();
  if (daily) {
    const date = raw.dateAt?.toDate ? raw.dateAt.toDate() : raw.dateAt;
    if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || typeof raw.date !== "string" || docId !== `${raw.employeeId}_${raw.date}`) failReference();
    if (!Array.isArray(raw.operationResultIds) || raw.operationResultIds.length !== operationResultIds.length || raw.operationResultIds.some((id) => !operationResultIds.includes(id))) failReference();
  } else if (!identifier(raw.customerId) || !identifier(raw.siteId)) failReference();
  return raw;
}
export function aggregateCandidate(Schema, current, initial, operationResults, daily) {
  const base = current || { ...initial, operationResults: [] };
  const model = aggregateModel(Schema, base), before = model.toObject();
  model.operationResults = operationResults.map(calculationOperation);
  const calculated = model.toObject();
  const value = current ? mergeCalculated(current, before, calculated) : calculated;
  // The serializer is calculation-only: embedded historical raw and query
  // indexes are explicitly composed into the one durable write.
  const after = { ...value, docId: base.docId, operationResults };
  if (daily) after.operationResultIds = operationResults.map((item) => item.docId);
  delete after.employeeIds;
  inspectAggregate(after, { daily, docId: base.docId });
  return { after, model };
}
export async function commitBackgroundPlans({ firestore, transaction, companyId, plans, daily = false }) {
  assertBackgroundId(companyId);
  // Validate even deletion candidates before deciding which references are new.
  for (const plan of plans) {
    if (plan.before) inspectAggregate(plan.before, { daily, docId: plan.ref.id });
    if (plan.after) inspectAggregate(plan.after, { daily, docId: plan.ref.id });
  }
  for (const { ref, before, after } of plans) {
    if (!after) { if (before) transaction.delete(ref); continue; }
    if (equal(before, after)) continue;
    const payload = { ...after, updatedAt: FieldValue.serverTimestamp() };
    if (!before) { payload.createdAt = FieldValue.serverTimestamp(); payload.uid = "system"; }
    transaction.set(ref, payload);
  }
}
