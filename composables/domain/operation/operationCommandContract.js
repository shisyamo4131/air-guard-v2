import { expectedFields } from "../shared/valueContract.js";

export const OVERVIEW_FIELDS = Object.freeze(["siteId", "securityType", "dateAt", "dayType", "shiftType", "startTime", "endTime", "isStartNextDay", "breakMinutes", "regulationWorkMinutes", "requiredPersonnel", "qualificationRequired", "workDescription", "remarks"]);
export const WORKER_FIELDS = Object.freeze(["id", "startTime", "endTime", "isStartNextDay", "breakMinutes", "regulationWorkMinutes", "isQualified", "isOjt"]);
export const ADJUSTED_FIELDS = Object.freeze(["useAdjusted", "adjustedQuantityBase", "adjustedOvertimeMinutesBase", "adjustedQuantityQualified", "adjustedOvertimeMinutesQualified", "adjustedUnitPriceBase", "adjustedOvertimeUnitPriceBase", "adjustedUnitPriceQualified", "adjustedOvertimeUnitPriceQualified"]);
export const NOTIFICATION_VALUES = Object.freeze(["actualStartTime", "actualEndTime", "actualIsStartNextDay", "actualBreakMinutes", "isQualified", "isOjt"]);
export const NOTIFICATION_IDENTITY = Object.freeze(["docId", "siteOperationScheduleId", "siteId", "id", "index", "isEmployee", "workerId", "employeeId", "outsourcerId"]);
export const WORKER_PARENT_FIELDS = Object.freeze(["siteId", "dateAt", "shiftType", "startTime", "endTime", "isStartNextDay", "breakMinutes", "regulationWorkMinutes"]);

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
  if (["siteId", "dateAt", "shiftType"].some((key) => Object.hasOwn(changes, key))) {
    for (const key of ["siteId", "dateAt", "shiftType", "customerId", "agreement", "billingDateAt"]) fields.add(key);
  }
  if (command.kind === "schedule") fields.add("operationResultId");
  return [...fields];
}

// This projection only builds the Callable's optimistic concurrency payload.
// The Callable parses and authorizes the command independently.
export function expectedForOperation(raw, command) {
  return expectedFields(raw || {}, command.action === "duplicate" ? Object.keys(raw || {}) : operationExpectedKeys(command));
}

export function notificationExpectation(raw) {
  return raw === null ? null : expectedFields(raw, [...NOTIFICATION_IDENTITY, ...NOTIFICATION_VALUES]);
}
