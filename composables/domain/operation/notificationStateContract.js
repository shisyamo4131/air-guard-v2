import { ArrangementNotification } from "@shisyamo4131/air-guard-v2-schemas";
import { equal, plain, rawForClass, expectedFields } from "../shared/valueContract.js";
import { operationDateTime } from "./operationDateTime.js";
import { NOTIFICATION_IDENTITY, NOTIFICATION_VALUES } from "./operationCommandContract.js";
import { mergeCalculated } from "./operationProjection.js";
import { OperationProjectionError, notificationEmployeeReferences } from "./operationReferences.js";

export const NOTIFICATION_STATUS_FIELDS = Object.freeze(["status", ...NOTIFICATION_VALUES, "confirmedAt", "arrivedAt", "leavedAt"]);
export const NOTIFICATION_STATE_PATCH = Object.freeze([...NOTIFICATION_STATUS_FIELDS, "actualStartAt", "actualEndAt", "totalWorkMinutes", "regularTimeWorkMinutes", "overtimeWorkMinutes"]);
const EXPECTED_FIELDS = [...NOTIFICATION_IDENTITY, ...NOTIFICATION_STATUS_FIELDS, "startTime", "endTime", "isStartNextDay", "dateAt", "confirmAt"];
const invalid = () => { throw new OperationProjectionError("通知内容を画面へ反映できません。最新情報を読み直してください。"); };

export function expectedNotificationState(raw) {
  return expectedFields(raw, EXPECTED_FIELDS);
}

// This mirrors the visible result of a notification transition. Firestore and
// server-side side effects remain outside this client projection.
export function prepareNotificationState(raw, input, now = new Date()) {
  notificationEmployeeReferences(raw);
  if (!plain(input) || Object.keys(input).some((field) => !["changes", "expected"].includes(field))
      || !plain(input.changes) || !plain(input.expected)
      || Object.keys(input.changes).some((field) => !["targetStatus", ...NOTIFICATION_VALUES].includes(field))
      || !["ARRANGED", "CONFIRMED", "ARRIVED", "LEAVED"].includes(input.changes.targetStatus)
      || !equal(input.expected, expectedNotificationState(raw))) invalid();
  for (const [field, value] of Object.entries(input.changes)) {
    if (["isQualified", "isOjt", "actualIsStartNextDay"].includes(field) && typeof value !== "boolean") invalid();
    if (["actualStartTime", "actualEndTime"].includes(field) && value !== null && typeof value !== "string") invalid();
    if (field === "actualBreakMinutes" && (typeof value !== "number" || !Number.isFinite(value))) invalid();
  }
  const model = operationDateTime(new ArrangementNotification(rawForClass(raw)));
  const before = model.toObject();
  for (const field of NOTIFICATION_VALUES) if (Object.hasOwn(input.changes, field)) model[field] = input.changes[field];
  model.status = input.changes.targetStatus;
  if (model.status !== "LEAVED") {
    model.actualStartTime = model.startTime;
    model.actualEndTime = model.endTime;
    model.actualBreakMinutes = 60;
    model.actualIsStartNextDay = model.isStartNextDay;
    model.leavedAt = null;
    model.arrivedAt = model.status === "ARRIVED" ? now : null;
    model.confirmedAt = model.status === "ARRANGED" ? null : model.status === "ARRIVED" && raw.confirmAt ? rawForClass(raw.confirmAt) : now;
  } else {
    model.confirmedAt = raw.confirmAt ? rawForClass(raw.confirmAt) : now;
    model.arrivedAt = raw.arrivedAt ? rawForClass(raw.arrivedAt) : now;
    model.leavedAt = now;
  }
  try { model.validate(); } catch { invalid(); }
  const next = mergeCalculated(raw, before, model.toObject());
  return Object.fromEntries(NOTIFICATION_STATE_PATCH.filter((field) => !equal(raw[field], next[field])).map((field) => [field, next[field]]));
}
