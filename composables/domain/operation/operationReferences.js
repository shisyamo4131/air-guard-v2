import { identifier, plain } from "../shared/valueContract.js";

export class OperationProjectionError extends Error {
  constructor(message = "参照情報を確認できません。最新情報を読み直してください。") {
    super(message);
    this.name = "OperationProjectionError";
    this.code = "failed-precondition";
  }
}

const invalid = () => { throw new OperationProjectionError(); };

function inspectWorker(raw, isEmployee, context = {}) {
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
