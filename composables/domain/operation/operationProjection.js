import { SiteOperationSchedule, OperationResult, ArticleDetail } from "@shisyamo4131/air-guard-v2-schemas";
import { equal, plain, rawForClass } from "../shared/valueContract.js";
import { operationDateTime } from "./operationDateTime.js";
import { WORKER_PARENT_FIELDS } from "./operationCommandContract.js";
import { OperationProjectionError, operationEmployeeReferences } from "./operationReferences.js";

const invalid = () => { throw new OperationProjectionError("保存内容を画面へ反映できません。最新情報を読み直してください。"); };

export function mergeCalculated(raw, before, after) {
  if (equal(before, after)) return raw;
  if (plain(before) && plain(after) && plain(raw)) {
    const result = { ...raw };
    for (const key of Object.keys(after)) if (!equal(before[key], after[key])) result[key] = mergeCalculated(raw[key], before[key], after[key]);
    return result;
  }
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(raw) && before.length === after.length && raw.length === after.length) {
    return after.map((item, index) => mergeCalculated(raw[index], before[index], item));
  }
  return after;
}

function calculateOperation(raw, kind, update) {
  const Schema = kind === "schedule" ? SiteOperationSchedule : OperationResult;
  const model = operationDateTime(new Schema(rawForClass(raw)));
  const before = model.toObject();
  update(model);
  try { model.validate(); } catch { invalid(); }
  return { value: mergeCalculated(raw, before, model.toObject()), model };
}

// Client-only projection used to paint the expected result before saveOperation
// resolves. It does not parse, authorize, or persist a command.
export function applyOperationProjection(raw, command) {
  const { action, kind, changes } = command;
  operationEmployeeReferences(raw, kind === "schedule" ? { scheduleId: command.documentId } : {});
  if (kind === "schedule" && raw.operationResultId !== null && raw.operationResultId !== undefined) invalid();
  if (kind !== "schedule" && typeof raw.isLocked !== "boolean") invalid();
  if (kind === "result" && raw.isLocked) invalid();
  if (action === "delete") return null;
  if (action === "lock") return { ...raw, isLocked: changes.desiredLocked };
  if (["notify", "convert", "agreement"].includes(action)) return raw;
  if (!["workers", "articles"].includes(action)) return calculateOperation(raw, kind, (model) => Object.assign(model, changes)).value;
  const array = raw[command.array];
  if (!Array.isArray(array) || command.position > array.length || (command.rowAction !== "add" && command.position === array.length)) invalid();
  const next = [...array];
  if (command.rowAction === "remove") next.splice(command.position, 1);
  else if (command.rowAction === "move") {
    if (command.destination >= array.length) invalid();
    next.splice(command.destination, 0, next.splice(command.position, 1)[0]);
  } else {
    const Schema = action === "articles" ? ArticleDetail : (kind === "schedule" ? SiteOperationSchedule : OperationResult).classProps[command.array].customClass;
    let previous = array[command.position];
    if (command.rowAction === "add") {
      if (action === "workers") {
        const isEmployee = command.array === "employees";
        const index = isEmployee ? 0 : Math.max(0, ...array.filter((row) => row.id === changes.id).map((row) => row.index)) + 1;
        if (isEmployee && array.some((row) => row.id === changes.id)) invalid();
        previous = operationDateTime(new Schema({ ...rawForClass(raw), id: changes.id, isEmployee, index, ...(kind === "schedule" ? { siteOperationScheduleId: command.documentId, hasNotification: false } : {}) })).toObject();
      } else previous = new Schema().toObject();
    }
    const model = operationDateTime(new Schema(rawForClass(previous)));
    const before = model.toObject();
    Object.assign(model, changes);
    if (action === "workers" && command.array === "employees" && array.some((row, index) => index !== command.position && row.id === model.id)) invalid();
    try { model.validate(); } catch { invalid(); }
    const value = mergeCalculated(previous, before, model.toObject());
    if (command.rowAction === "add") next.splice(command.position, 0, value);
    else next[command.position] = value;
  }
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

export { WORKER_PARENT_FIELDS };
