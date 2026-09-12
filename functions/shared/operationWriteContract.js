import { operationDateTime } from "./operationDateTime.js";
import { SiteOperationSchedule, OperationResult, ArticleDetail } from "@shisyamo4131/air-guard-v2-schemas";
import { EMPLOYEE_ROLES, plain, identifier, equal, encodeExpected, expectedFields, parseDate, rawForClass } from "./employeeContract.js";
import { OperationWriteError, operationEmployeeReferences } from "./operationReferences.js";

export const OVERVIEW_FIELDS = Object.freeze(["siteId", "securityType", "dateAt", "dayType", "shiftType", "startTime", "endTime", "isStartNextDay", "breakMinutes", "regulationWorkMinutes", "requiredPersonnel", "qualificationRequired", "workDescription", "remarks"]);
export const WORKER_FIELDS = Object.freeze(["id", "startTime", "endTime", "isStartNextDay", "breakMinutes", "regulationWorkMinutes", "isQualified", "isOjt"]);
export const ADJUSTED_FIELDS = Object.freeze(["useAdjusted", "adjustedQuantityBase", "adjustedOvertimeMinutesBase", "adjustedQuantityQualified", "adjustedOvertimeMinutesQualified", "adjustedUnitPriceBase", "adjustedOvertimeUnitPriceBase", "adjustedUnitPriceQualified", "adjustedOvertimeUnitPriceQualified"]);
export const NOTIFICATION_VALUES = Object.freeze(["actualStartTime", "actualEndTime", "actualIsStartNextDay", "actualBreakMinutes", "isQualified", "isOjt"]);
export const NOTIFICATION_IDENTITY = Object.freeze(["docId", "siteOperationScheduleId", "siteId", "id", "index", "isEmployee", "workerId", "employeeId", "outsourcerId"]);
export const WORKER_PARENT_FIELDS = Object.freeze(["siteId", "dateAt", "shiftType", "startTime", "endTime", "isStartNextDay", "breakMinutes", "regulationWorkMinutes"]);
const BOOL_FIELDS = new Set(["isStartNextDay", "qualificationRequired", "isQualified", "isOjt", "useAdjusted", "desiredLocked"]);
const NUMBER_FIELDS = new Set(["breakMinutes", "regulationWorkMinutes", "requiredPersonnel", "price", "quantity", "displayOrder", ...ADJUSTED_FIELDS.slice(1)]);
const ACTIONS = new Set(["create", "duplicate", "overview", "workers", "articles", "order", "delete", "notify", "convert", "agreement", "adjusted", "lock"]);
const SCHEDULE_CUD_ACTIONS = new Set(["create", "duplicate", "overview", "workers", "order", "delete"]);
export function rejectInput() { throw new OperationWriteError("invalid-argument"); }
export function exactKeys(value, keys) { if (!plain(value) || Object.keys(value).some((key) => !keys.includes(key))) rejectInput(); }
export function operationAllowed(identity, user, command) {
  if (!identifier(identity.uid) || !identifier(identity.companyId) || typeof identity.isSuperUser !== "boolean" || !plain(user)
    || user.docId !== identity.uid || user.companyId !== identity.companyId || user.disabled !== false || user.isTemporary !== false || typeof user.isAdmin !== "boolean") return false;
  if (user.isAdmin || (command?.kind === "schedule" && SCHEDULE_CUD_ACTIONS.has(command.action))) return true;
  return identity.isSuperUser === false && Array.isArray(user.roles) && user.roles.length <= EMPLOYEE_ROLES.length
    && user.roles.every((role) => EMPLOYEE_ROLES.includes(role)) && user.roles.some((role) => (command?.kind === "billing" ? ["manager", "accountant"] : ["manager", "controller"]).includes(role));
}

export function parseOperationCommand(input) {
  exactKeys(input, ["kind", "action", "documentId", "changes", "expected", "sourceId", "rowAction", "array", "position", "destination", "notifications", "siteStatuses"]);
  if (!["schedule", "result", "billing"].includes(input.kind) || !ACTIONS.has(input.action) || !identifier(input.documentId) || !plain(input.changes) || !plain(input.expected)) rejectInput();
  const { kind, action } = input;
  if (action === "duplicate" ? !identifier(input.sourceId) || input.sourceId === input.documentId || !Object.hasOwn(input.changes, "dateAt") : Object.hasOwn(input, "sourceId")) rejectInput();
  if ((kind !== "schedule" && ["notify", "convert", "order"].includes(action)) || (kind !== "billing" && ["agreement", "adjusted", "lock"].includes(action))
    || (kind === "billing" && !["overview", "articles", "agreement", "adjusted", "lock"].includes(action)) || (kind === "schedule" && action === "articles")) rejectInput();
  let fields = [];
  if (["create", "overview"].includes(action)) fields = kind === "billing" ? OVERVIEW_FIELDS.filter((key) => key !== "securityType") : OVERVIEW_FIELDS;
  if (action === "workers") fields = WORKER_FIELDS;
  if (action === "articles") fields = ["articleId", "price", "quantity"];
  if (action === "adjusted") fields = ADJUSTED_FIELDS;
  if (action === "agreement") fields = ["agreementKey", "billingDateAt"];
  if (action === "lock") fields = ["desiredLocked"];
  if (action === "order") fields = ["displayOrder"];
  if (action === "notify") fields = ["shouldNotify"];
  if (action === "duplicate") fields = ["dateAt"];
  exactKeys(input.changes, fields);
  const changes = {};
  for (const [key, value] of Object.entries(input.changes)) {
    if (["dateAt", "billingDateAt"].includes(key)) { changes[key] = parseDate(value); continue; }
    if (["id", "articleId", "siteId"].includes(key)) { if (!identifier(value)) rejectInput(); }
    else if (BOOL_FIELDS.has(key) || key === "shouldNotify") { if (typeof value !== "boolean") rejectInput(); }
    else if (NUMBER_FIELDS.has(key)) { if (!(key === "requiredPersonnel" && value === null) && (typeof value !== "number" || !Number.isFinite(value))) rejectInput(); }
    else if (value !== null && typeof value !== "string") rejectInput();
    changes[key] = value;
  }
  const row = ["workers", "articles"].includes(action);
  if (row) {
    if (!["add", "update", "remove", "move"].includes(input.rowAction)) rejectInput();
    if (action === "workers" ? !["employees", "outsourcers"].includes(input.array) : input.array !== "articles") rejectInput();
    if (!Number.isSafeInteger(input.position) || input.position < 0) rejectInput();
    if (input.rowAction === "move" ? !Number.isSafeInteger(input.destination) || input.destination < 0 : Object.hasOwn(input, "destination")) rejectInput();
    if (["remove", "move"].includes(input.rowAction) && Object.keys(changes).length) rejectInput();
  } else if (["rowAction", "array", "position", "destination"].some((key) => Object.hasOwn(input, key))) rejectInput();
  if (action === "notify" && typeof changes.shouldNotify !== "boolean") rejectInput();
  if (action === "lock" && typeof changes.desiredLocked !== "boolean") rejectInput();
  if (action !== "convert" && Object.hasOwn(input, "notifications")) rejectInput();
  if (action === "convert" && !plain(input.notifications)) rejectInput();
  if (Object.hasOwn(input, "siteStatuses")) {
    if (kind !== "schedule" || !["create", "duplicate", "overview"].includes(action) || !plain(input.siteStatuses)
      || Object.entries(input.siteStatuses).some(([id, status]) => !identifier(id) || !["ACTIVE", "TERMINATED"].includes(status))) rejectInput();
  }
  return { ...input, changes };
}

export function operationExpectedKeys(command) {
  const { action, changes } = command;
  if (action === "create") return [];
  if (["workers", "notify", "convert"].includes(action)) return ["operationResultId", "siteId", "dateAt", "employees", "outsourcers"];
  if (action === "articles") return ["articles"];
  if (action === "adjusted") return [...ADJUSTED_FIELDS];
  if (action === "agreement") return ["siteId", "dateAt", "shiftType", "agreement", "billingDateAt"];
  if (action === "lock") return ["isLocked"];
  if (action === "order") return ["siteId", "dateAt", "shiftType", "displayOrder", "operationResultId"];
  if (action === "delete") return ["siteId", "employees", "outsourcers", "articles", "operationResultId", "siteOperationScheduleId", "updatedAt"];
  const fields = new Set(Object.keys(changes));
  if (Object.keys(changes).some((key) => WORKER_PARENT_FIELDS.includes(key))) {
    for (const key of [...WORKER_PARENT_FIELDS, "employees", "outsourcers"]) fields.add(key);
  }
  if (["siteId", "dateAt", "shiftType"].some((key) => Object.hasOwn(changes, key))) for (const key of ["siteId", "dateAt", "shiftType", "customerId", "agreement", "billingDateAt"]) fields.add(key);
  if (command.kind === "schedule") fields.add("operationResultId");
  return [...fields];
}
export function expectedForOperation(raw, command) { return expectedFields(raw || {}, command.action === "duplicate" ? Object.keys(raw || {}) : operationExpectedKeys(command)); }
export function assertOperationExpected(raw, command) {
  const expected = expectedForOperation(raw, command);
  if (!equal(expected, command.expected)) throw new OperationWriteError("aborted", "情報が更新されました。入力を保持しています。最新情報を読み直してください。");
}

// Compare two calculation-only models, then apply only their differences to raw.
// Unchanged Timestamp objects and unknown map fields retain their original value.
export function mergeCalculated(raw, before, after) {
  if (equal(before, after)) return raw;
  if (plain(before) && plain(after) && plain(raw)) {
    const result = { ...raw };
    for (const key of Object.keys(after)) if (!equal(before[key], after[key])) result[key] = mergeCalculated(raw[key], before[key], after[key]);
    return result;
  }
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(raw) && before.length === after.length && raw.length === after.length)
    return after.map((item, index) => mergeCalculated(raw[index], before[index], item));
  return after;
}
export function calculateOperation(raw, kind, update) {
  const Schema = kind === "schedule" ? SiteOperationSchedule : OperationResult;
  const model = operationDateTime(new Schema(rawForClass(raw)));
  const before = model.toObject();
  update(model);
  try { model.validate(); } catch { rejectInput(); }
  return { value: mergeCalculated(raw, before, model.toObject()), model };
}

export function applyOperationCommand(raw, command) {
  const { action, kind, changes } = command;
  operationEmployeeReferences(raw, kind === "schedule" ? { scheduleId: command.documentId } : {});
  if (kind === "schedule" && raw.operationResultId !== null && raw.operationResultId !== undefined) throw new OperationWriteError("failed-precondition", "実績化済みの予定は編集できません。");
  if (kind !== "schedule" && typeof raw.isLocked !== "boolean") throw new OperationWriteError("failed-precondition");
  if (kind === "result" && raw.isLocked) throw new OperationWriteError("failed-precondition", "編集ロック中の実績は編集できません。");
  if (action === "delete") return null;
  if (action === "lock") return { ...raw, isLocked: changes.desiredLocked };
  if (["notify", "convert", "agreement"].includes(action)) return raw;
  if (!["workers", "articles"].includes(action)) return calculateOperation(raw, kind, (model) => Object.assign(model, changes)).value;
  const array = raw[command.array];
  if (!Array.isArray(array)) throw new OperationWriteError("failed-precondition");
  if (command.position > array.length || (command.rowAction !== "add" && command.position === array.length)) rejectInput();
  const next = [...array];
  if (command.rowAction === "remove") next.splice(command.position, 1);
  else if (command.rowAction === "move") {
    if (command.destination >= array.length) rejectInput();
    next.splice(command.destination, 0, next.splice(command.position, 1)[0]);
  } else {
    const Schema = action === "articles" ? ArticleDetail : (kind === "schedule" ? SiteOperationSchedule : OperationResult).classProps[command.array].customClass;
    let previous = array[command.position];
    if (command.rowAction === "add") {
      if (action === "workers") {
        const isEmployee = command.array === "employees";
        const index = isEmployee ? 0 : Math.max(0, ...array.filter((row) => row.id === changes.id).map((row) => row.index)) + 1;
        if (isEmployee && array.some((row) => row.id === changes.id)) rejectInput();
        previous = operationDateTime(new Schema({ ...rawForClass(raw), id: changes.id, isEmployee, index, ...(kind === "schedule" ? { siteOperationScheduleId: command.documentId, hasNotification: false } : {}) })).toObject();
      } else previous = new Schema().toObject();
    }
    const model = operationDateTime(new Schema(rawForClass(previous)));
    const before = model.toObject();
    Object.assign(model, changes);
    if (action === "workers" && command.array === "employees" && array.some((row, index) => index !== command.position && row.id === model.id)) rejectInput();
    try { model.validate(); } catch { rejectInput(); }
    const value = mergeCalculated(previous, before, model.toObject());
    if (command.rowAction === "add") next.splice(command.position, 0, value);
    else next[command.position] = value;
  }
  // Array positions have already been resolved against raw; derive aggregate
  // values separately, without matching Class keys or discarding row metadata.
  const model = operationDateTime(new (kind === "schedule" ? SiteOperationSchedule : OperationResult)(rawForClass(raw)));
  const before = model.toObject();
  model[command.array] = rawForClass(next);
  const after = model.toObject();
  const value = mergeCalculated(raw, before, after);
  value[command.array] = next;
  value.employeeIds = (command.array === "employees" ? next : raw.employees).map((row) => row.id);
  value.outsourcerIds = (command.array === "outsourcers" ? next : raw.outsourcers).map((row) => row.id);
  value.workers = [...value.employees, ...value.outsourcers];
  return value;
}

export function notificationExpectation(raw) {
  return raw === null ? null : expectedFields(raw, [...NOTIFICATION_IDENTITY, ...NOTIFICATION_VALUES]);
}
