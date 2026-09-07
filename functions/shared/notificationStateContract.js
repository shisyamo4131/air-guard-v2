import { operationDateTime } from "./operationDateTime.js";
import { ArrangementNotification } from "@shisyamo4131/air-guard-v2-schemas";
import { plain, equal, rawForClass, expectedFields } from "./employeeContract.js";
import { OperationWriteError, notificationEmployeeReferences } from "./operationReferences.js";
import { NOTIFICATION_IDENTITY, NOTIFICATION_VALUES, mergeCalculated } from "./operationWriteContract.js";

export const NOTIFICATION_STATUS_FIELDS = Object.freeze(["status", ...NOTIFICATION_VALUES, "confirmedAt", "arrivedAt", "leavedAt"]);
export const NOTIFICATION_STATE_PATCH = Object.freeze([...NOTIFICATION_STATUS_FIELDS, "actualStartAt", "actualEndAt", "totalWorkMinutes", "regularTimeWorkMinutes", "overtimeWorkMinutes"]);
const EXPECTED_FIELDS = [...NOTIFICATION_IDENTITY, ...NOTIFICATION_STATUS_FIELDS, "startTime", "endTime", "isStartNextDay", "dateAt", "confirmAt"];
export function expectedNotificationState(raw) { return expectedFields(raw, EXPECTED_FIELDS); }
export function prepareNotificationState(raw, input, now = new Date()) {
  notificationEmployeeReferences(raw);
  if (!plain(input) || Object.keys(input).some((field) => !["changes", "expected"].includes(field)) || !plain(input.changes) || !plain(input.expected)
    || Object.keys(input.changes).some((field) => !["targetStatus", ...NOTIFICATION_VALUES].includes(field)) || !["ARRANGED", "CONFIRMED", "ARRIVED", "LEAVED"].includes(input.changes.targetStatus)) throw new OperationWriteError("invalid-argument");
  if (!equal(input.expected, expectedNotificationState(raw))) throw new OperationWriteError("aborted", "通知が更新されました。最新値を読み直してください。");
  for (const [field, value] of Object.entries(input.changes)) {
    if (["isQualified", "isOjt", "actualIsStartNextDay"].includes(field) && typeof value !== "boolean") throw new OperationWriteError("invalid-argument");
    if (["actualStartTime", "actualEndTime"].includes(field) && value !== null && typeof value !== "string") throw new OperationWriteError("invalid-argument");
    if (field === "actualBreakMinutes" && (typeof value !== "number" || !Number.isFinite(value))) throw new OperationWriteError("invalid-argument");
  }
  const model = operationDateTime(new ArrangementNotification(rawForClass(raw))), before = model.toObject();
  for (const field of NOTIFICATION_VALUES) if (Object.hasOwn(input.changes, field)) model[field] = input.changes[field];
  model.status = input.changes.targetStatus;
  if (model.status !== "LEAVED") {
    model.actualStartTime = model.startTime; model.actualEndTime = model.endTime;
    model.actualBreakMinutes = 60; model.actualIsStartNextDay = model.isStartNextDay;
    model.leavedAt = null;
    model.arrivedAt = model.status === "ARRIVED" ? now : null;
    // Preserve the installed four transition methods, including their legacy
    // `confirmAt` lookup in toArrived/toLeaved (not a new transition policy).
    model.confirmedAt = model.status === "ARRANGED" ? null : model.status === "ARRIVED" && raw.confirmAt ? rawForClass(raw.confirmAt) : now;
  } else {
    model.confirmedAt = raw.confirmAt ? rawForClass(raw.confirmAt) : now;
    model.arrivedAt = raw.arrivedAt ? rawForClass(raw.arrivedAt) : now;
    model.leavedAt = now;
  }
  try { model.validate(); } catch { throw new OperationWriteError("invalid-argument"); }
  const next = mergeCalculated(raw, before, model.toObject());
  return Object.fromEntries(NOTIFICATION_STATE_PATCH.filter((field) => !equal(raw[field], next[field])).map((field) => [field, next[field]]));
}
