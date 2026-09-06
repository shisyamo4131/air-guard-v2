import { identifier, plain } from "./employeeContract.js";

export class OperationWriteError extends Error {
  constructor(code, message = "保存できません。入力内容と最新情報を確認してください。") {
    super(message); this.name = "OperationWriteError"; this.code = code;
  }
}

const invalid = () => { throw new OperationWriteError("failed-precondition", "参照情報を確認できません。最新情報を読み直してください。"); };

// Inspect persisted data before a schema setter can normalize its identity.
export function inspectWorker(raw, isEmployee, context = {}) {
  if (!plain(raw) || typeof isEmployee !== "boolean" || raw.isEmployee !== isEmployee || !identifier(raw.id)
      || !Number.isSafeInteger(raw.index) || raw.index < 0 || raw.amount !== 1 || !identifier(raw.siteId)) invalid();
  if (isEmployee && raw.index !== 0) invalid();
  if (["isStartNextDay", "isQualified", "isOjt"].some((field) => typeof raw[field] !== "boolean")
      || ["breakMinutes", "regulationWorkMinutes"].some((field) => typeof raw[field] !== "number" || !Number.isFinite(raw[field]))
      || ["startTime", "endTime"].some((field) => raw[field] !== null && typeof raw[field] !== "string")) invalid();
  const date = typeof raw.dateAt?.toDate === "function" ? raw.dateAt.toDate() : raw.dateAt;
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) invalid();
  const workerId = isEmployee ? raw.id : `${raw.id}:${raw.index}`;
  if (raw.workerId !== workerId || raw.employeeId !== (isEmployee ? raw.id : null)
      || raw.outsourcerId !== (isEmployee ? null : raw.id)) invalid();
  if (context.siteId !== undefined && raw.siteId !== context.siteId) invalid();
  if (context.scheduleId !== undefined && (raw.siteOperationScheduleId !== context.scheduleId
      || (Object.hasOwn(raw, "notificationKey") && raw.notificationKey !== `${context.scheduleId}_${workerId}`))) invalid();
  return isEmployee ? raw.id : null;
}

function indexMatches(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((id, index) => identifier(id) && id === expected[index]);
}

export function operationEmployeeReferences(raw, { scheduleId } = {}) {
  if (!plain(raw) || !identifier(raw.siteId) || !Array.isArray(raw.employees) || !Array.isArray(raw.outsourcers)) invalid();
  const context = { siteId: raw.siteId, ...(scheduleId === undefined ? {} : { scheduleId }) };
  const employees = raw.employees.map((worker) => inspectWorker(worker, true, context));
  const outsourcers = raw.outsourcers.map((worker) => { inspectWorker(worker, false, context); return worker.id; });
  const workerIds = [...raw.employees, ...raw.outsourcers].map((worker) => worker.workerId);
  if (new Set(workerIds).size !== workerIds.length) invalid();
  if (!indexMatches(raw.employeeIds, employees) || !indexMatches(raw.outsourcerIds, outsourcers)) invalid();
  // `workers` is a persisted derived mirror in the installed schema. A hidden
  // additional identity there must not escape the canonical array indexes.
  if (!Array.isArray(raw.workers) || raw.workers.length !== employees.length + outsourcers.length) invalid();
  for (let index = 0; index < raw.workers.length; index++) {
    const isEmployee = index < employees.length;
    inspectWorker(raw.workers[index], isEmployee, context);
    const canonical = isEmployee ? raw.employees[index] : raw.outsourcers[index - employees.length];
    if (raw.workers[index].workerId !== canonical.workerId) invalid();
  }
  return new Set(employees);
}

export function notificationEmployeeReferences(raw) {
  if (!plain(raw) || !identifier(raw.siteOperationScheduleId)) invalid();
  const employeeId = inspectWorker(raw, raw.isEmployee, { scheduleId: raw.siteOperationScheduleId });
  if (raw.docId !== `${raw.siteOperationScheduleId}_${raw.workerId}`) invalid();
  return new Set(employeeId === null ? [] : [employeeId]);
}

// The caller supplies the *destination's transaction snapshot*, never an event
// before-image, a display Class, or a source being moved to this destination.
export function addedEmployeeReferences(destinations) {
  const added = new Set();
  for (const { before, after, references = operationEmployeeReferences } of destinations) {
    const previous = before === null ? new Set() : references(before);
    const next = after === null ? new Set() : references(after);
    for (const id of next) if (!previous.has(id)) added.add(id);
  }
  return added;
}

export async function readAddedEmployees(transaction, firestore, companyId, destinations) {
  if (!identifier(companyId)) throw new OperationWriteError("permission-denied");
  const ids = addedEmployeeReferences(destinations);
  for (const id of ids) {
    const snapshot = await transaction.get(firestore.doc(`Companies/${companyId}/Employees/${id}`));
    if (!snapshot.exists) throw new OperationWriteError("failed-precondition", "選択した従業員が存在しません。最新情報を読み直してください。");
  }
  return ids;
}
