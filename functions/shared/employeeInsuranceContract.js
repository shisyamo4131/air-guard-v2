import { Insurance } from "@shisyamo4131/air-guard-v2-schemas";
import { EmployeeOperationError, INSURANCE_KINDS, plain, identifier, encodeExpected, equal, parseDate, rawForClass } from "./employeeContract.js";

export const INSURANCE_ACTION_FIELDS = Object.freeze({
  enroll: ["enrollmentDateAt", "number", "isProcessing"], enrolled: ["number"], cancelEnroll: [],
  exempt: ["lossDateAt", "lossReason"], loss: ["lossDateAt", "lossReason", "isRetire"], rollback: [],
});
const STATUSES = ["NOT_ENROLLED", "ENROLLED", "EXEMPT"];
const RESTORED_FIELDS = ["status", "previousStatus", "enrollmentDateAt", "number"];
const RESET_FIELDS = ["lossDateAt", "lossReason", "isRetire"];
const ASSIGNED_FIELDS = {
  enroll: ["previousStatus", "status", "enrollmentDateAt", "number", "isProcessing", ...RESET_FIELDS],
  enrolled: ["number", "isProcessing", ...RESET_FIELDS],
  cancelEnroll: ["status", "previousStatus", "enrollmentDateAt", "number", "isProcessing", ...RESET_FIELDS],
  exempt: ["previousStatus", "status", "enrollmentDateAt", "isProcessing", "number", ...RESET_FIELDS],
  loss: ["previousStatus", "status", "enrollmentDateAt", "number", ...RESET_FIELDS],
  rollback: [...RESTORED_FIELDS, "isProcessing", ...RESET_FIELDS],
};

export function insuranceVersions(raw) {
  if (!Object.hasOwn(raw, "insuranceOperationVersions")) return Object.fromEntries(INSURANCE_KINDS.map((kind) => [kind, 0]));
  const versions = raw.insuranceOperationVersions;
  if (!plain(versions) || Object.keys(versions).length !== INSURANCE_KINDS.length || INSURANCE_KINDS.some((kind) => !Object.hasOwn(versions, kind) || !Number.isSafeInteger(versions[kind]) || versions[kind] < 0)) throw new EmployeeOperationError("failed-precondition", "保険の保存世代を確認できません。最新情報を確認してください。");
  return { ...versions };
}
function dateOrNull(value) {
  if (value === null) return true;
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return value && typeof value.toDate === "function" && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1000000000 && Number.isFinite(value.toDate().getTime());
}
function validateKnownValues(value, history = false) {
  if (!plain(value) || !STATUSES.includes(value.status)) throw new EmployeeOperationError("failed-precondition");
  if (Object.hasOwn(value, "previousStatus") && value.previousStatus !== null && value.previousStatus !== "" && !STATUSES.includes(value.previousStatus)) throw new EmployeeOperationError("failed-precondition");
  for (const field of ["enrollmentDateAt", "lossDateAt"]) if (Object.hasOwn(value, field) && !dateOrNull(value[field])) throw new EmployeeOperationError("failed-precondition");
  for (const field of ["number", "lossReason"]) if (Object.hasOwn(value, field) && value[field] !== null && typeof value[field] !== "string") throw new EmployeeOperationError("failed-precondition");
  if (!history && (typeof value.isProcessing !== "boolean" || !Array.isArray(value.history) || (Object.hasOwn(value, "isRetire") && typeof value.isRetire !== "boolean"))) throw new EmployeeOperationError("failed-precondition");
}
export function validateInsuranceRaw(value) {
  validateKnownValues(value);
  for (const entry of value.history) validateKnownValues(entry, true);
}
// Defaults are a calculation/draft value only. Keep the Employee raw snapshot
// absent until an authorized transition commits its complete target map.
export function insuranceForOperation(raw, kind) {
  if (!INSURANCE_KINDS.includes(kind)) throw new EmployeeOperationError("invalid-argument");
  if (!Object.hasOwn(raw, kind)) return new Insurance().toObject();
  validateInsuranceRaw(raw[kind]);
  return raw[kind];
}
export function parseEmployeeInsuranceInput(input) {
  if (!plain(input) || Object.keys(input).some((key) => !["employeeId", "kind", "action", "changes", "expected"].includes(key)) || !identifier(input.employeeId) || !INSURANCE_KINDS.includes(input.kind) || !Object.hasOwn(INSURANCE_ACTION_FIELDS, input.action) || !plain(input.changes) || !plain(input.expected) || Object.keys(input.expected).length !== 2 || !Object.hasOwn(input.expected, "map") || !Number.isSafeInteger(input.expected.version) || input.expected.version < 0) throw new EmployeeOperationError("invalid-argument");
  const changes = {};
  for (const [field, value] of Object.entries(input.changes)) {
    if (!INSURANCE_ACTION_FIELDS[input.action].includes(field)) throw new EmployeeOperationError("invalid-argument");
    if (["enrollmentDateAt", "lossDateAt"].includes(field)) changes[field] = parseDate(value);
    else if (["isProcessing", "isRetire"].includes(field)) {
      if (typeof value !== "boolean") throw new EmployeeOperationError("invalid-argument"); changes[field] = value;
    } else {
      // Validate transition input before the model method clears transient fields.
      if (value !== null && (typeof value !== "string" || value.length > Insurance.classProps[field].length)) throw new EmployeeOperationError("invalid-argument"); changes[field] = value;
    }
  }
  return { ...input, changes };
}
export function prepareEmployeeInsurance(raw, input) {
  const versions = insuranceVersions(raw), initializeMap = !Object.hasOwn(raw, input.kind);
  const current = insuranceForOperation(raw, input.kind);
  if (versions[input.kind] !== input.expected.version || JSON.stringify(encodeExpected(raw[input.kind])) !== JSON.stringify(input.expected.map)) throw new EmployeeOperationError("aborted", "同じ保険情報が更新されました。入力を保持しています。最新値を読み直してください。");
  if (versions[input.kind] === Number.MAX_SAFE_INTEGER) throw new EmployeeOperationError("failed-precondition");
  const model = new Insurance(rawForClass(current));
  try { model[input.action](input.changes); model.validate(); } catch { throw new EmployeeOperationError("invalid-argument", "現在の保険状態では実行できないか、入力が不足しています。"); }
  if (!STATUSES.includes(model.status)) throw new EmployeeOperationError("failed-precondition");
  const mapChanges = {};
  for (const field of ASSIGNED_FIELDS[input.action]) mapChanges[field] = model[field];
  const pushesHistory = input.action === "loss" || (input.action === "exempt" && current.status === "ENROLLED" && !current.isProcessing);
  if (pushesHistory) {
    const entry = Object.fromEntries(RESTORED_FIELDS.filter((field) => Object.hasOwn(current, field)).map((field) => [field, current[field]]));
    entry.lossDateAt = input.changes.lossDateAt; entry.lossReason = input.changes.lossReason;
    mapChanges.history = [...current.history, entry];
  }
  if (input.action === "rollback") {
    const latest = current.history.at(-1);
    for (const field of RESTORED_FIELDS) mapChanges[field] = latest[field];
    mapChanges.history = current.history.slice(0, -1);
  }
  if (Object.hasOwn(current, "enrollmentDate") && Object.hasOwn(mapChanges, "enrollmentDateAt") && !equal(current.enrollmentDateAt, mapChanges.enrollmentDateAt)) mapChanges.enrollmentDate = model.enrollmentDate;
  const nextMap = { ...current };
  for (const [field, value] of Object.entries(mapChanges)) {
    if (equal(current[field], value)) delete mapChanges[field];
    else if (value === undefined) delete nextMap[field];
    else nextMap[field] = value;
  }
  return { mapChanges, nextMap, initializeMap, versions: { ...versions, [input.kind]: versions[input.kind] + 1 }, legacyVersions: !Object.hasOwn(raw, "insuranceOperationVersions") };
}
