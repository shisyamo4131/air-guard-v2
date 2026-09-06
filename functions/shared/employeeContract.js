import { Employee } from "@shisyamo4131/air-guard-v2-schemas";

export const EMPLOYEE_ROLES = Object.freeze(["manager", "controller", "accountant", "human-resource", "labor", "legal"]);
export const BASIC_FIELDS = Object.freeze(["code", "lastName", "firstName", "lastNameKana", "firstNameKana", "displayName", "displayNameKana", "gender", "dateOfBirth", "dateOfHire", "title", "zipcode", "prefCode", "city", "address", "building", "mobile", "email", "remarks"]);
export const CREATE_FIELDS = Object.freeze(BASIC_FIELDS.filter((field) => field !== "remarks"));
export const NATIONALITY_FIELDS = Object.freeze(["isForeigner", "foreignName", "nationality", "residenceStatus", "hasPeriodOfStayLimit", "periodOfStay", "hasWorkRestrictions"]);
export const ADDRESS_FIELDS = Object.freeze(["prefCode", "city", "address"]);
export const DATE_FIELDS = Object.freeze(["dateOfBirth", "dateOfHire", "periodOfStay"]);
export const INSURANCE_KINDS = Object.freeze(["healthInsurance", "pensionInsurance", "employmentInsurance"]);
export class EmployeeOperationError extends Error {
  constructor(code, message = "従業員情報を保存できません。入力内容と最新情報を確認してください。") {
    super(message); this.name = "EmployeeOperationError"; this.code = code;
  }
}
export function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
export function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && value === value.trim() && !value.includes("/");
}
export function employeeAllowed({ uid, companyId, isSuperUser, actorUser }, write = true) {
  if (!identifier(uid) || !identifier(companyId) || typeof isSuperUser !== "boolean" || !actorUser || actorUser.docId !== uid || actorUser.companyId !== companyId || actorUser.disabled !== false || actorUser.isTemporary !== false || typeof actorUser.isAdmin !== "boolean") return false;
  if (actorUser.isAdmin) return true;
  return isSuperUser === false && Array.isArray(actorUser.roles) && actorUser.roles.length > 0 && actorUser.roles.every((role) => EMPLOYEE_ROLES.includes(role)) && (!write || actorUser.roles.some((role) => ["manager", "human-resource"].includes(role)));
}
export function operationFields(operation) {
  const fields = { create: CREATE_FIELDS, basic: BASIC_FIELDS, nationality: NATIONALITY_FIELDS }[operation];
  if (!fields) throw new EmployeeOperationError("invalid-argument");
  return fields;
}
export function operationSchema(operation) {
  return operationFields(operation).map((field) => ({ key: field, ...Employee.classProps[field] }));
}
// Every value is tagged; absent fields cannot be confused with null or user maps.
export function encodeExpected(value) {
  if (value === undefined) return ["missing"];
  if (value === null) return ["null"];
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new EmployeeOperationError("invalid-argument");
    const seconds = Math.floor(value.getTime() / 1000);
    return ["timestamp", seconds, (value.getTime() - seconds * 1000) * 1000000];
  }
  if (value && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) && typeof value.toDate === "function") return ["timestamp", value.seconds, value.nanoseconds];
  if (Array.isArray(value)) return ["array", value.map(encodeExpected)];
  if (plain(value)) return ["map", Object.keys(value).sort().map((key) => [key, encodeExpected(value[key])])];
  if (["string", "boolean"].includes(typeof value) || (typeof value === "number" && Number.isFinite(value))) return [typeof value, value];
  throw new EmployeeOperationError("invalid-argument");
}
export function equal(left, right) { return JSON.stringify(encodeExpected(left)) === JSON.stringify(encodeExpected(right)); }
export function expectedFields(raw, fields) { return Object.fromEntries(fields.map((field) => [field, encodeExpected(raw[field])])); }
export function dateInput(value) {
  if (value === null || value === undefined) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : value;
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new EmployeeOperationError("invalid-argument");
  return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function parseDate(value) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new EmployeeOperationError("invalid-argument");
  const date = new Date(`${value}T00:00:00+09:00`);
  if (!Number.isFinite(date.getTime()) || dateInput(date) !== value) throw new EmployeeOperationError("invalid-argument");
  return date;
}
export function rawForClass(value) {
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(rawForClass);
  if (plain(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rawForClass(entry)]));
  return value;
}
export function parseEmployeeInput(operation, input) {
  if (!plain(input) || Object.keys(input).some((key) => !["employeeId", "changes", "expected"].includes(key)) || !identifier(input.employeeId) || !plain(input.changes) || !plain(input.expected)) throw new EmployeeOperationError("invalid-argument");
  const fields = operationFields(operation);
  const changes = {};
  for (const [key, value] of Object.entries(input.changes)) {
    if (!fields.includes(key)) throw new EmployeeOperationError("invalid-argument");
    if (DATE_FIELDS.includes(key)) changes[key] = parseDate(value);
    else if (["isForeigner", "hasPeriodOfStayLimit", "hasWorkRestrictions"].includes(key)) {
      if (typeof value !== "boolean") throw new EmployeeOperationError("invalid-argument");
      changes[key] = value;
    } else {
      if (value !== null && typeof value !== "string") throw new EmployeeOperationError("invalid-argument");
      changes[key] = value;
    }
  }
  return { employeeId: input.employeeId, changes, expected: input.expected };
}
export function assertExpected(raw, changes, expected, operation) {
  let fields = [];
  if (operation === "basic" && Object.hasOwn(changes, "dateOfHire")) fields.push("dateOfHire");
  if (operation === "nationality" && changes.isForeigner === false) fields.push(...NATIONALITY_FIELDS);
  else if (operation === "nationality" && changes.hasPeriodOfStayLimit === false) fields.push("hasPeriodOfStayLimit", "periodOfStay");
  if (Object.keys(expected).length !== fields.length || fields.some((field) => !Object.hasOwn(expected, field))) throw new EmployeeOperationError("invalid-argument");
  if (fields.some((field) => JSON.stringify(expected[field]) !== JSON.stringify(encodeExpected(raw[field])))) throw new EmployeeOperationError("aborted", "同じ情報が更新されました。入力を保持しています。最新値を読み直してください。");
}
export function buildEmployeePatch(raw, changes, operation) {
  const model = new Employee(rawForClass(raw));
  const patch = {};
  for (const [field, value] of Object.entries(changes)) if (!equal(raw[field], value)) patch[field] = value;
  for (const [field, value] of Object.entries(patch)) if (field !== "displayName") model[field] = value;
  if (Object.hasOwn(changes, "displayName")) model.displayName = changes.displayName;
  if (operation === "nationality" && changes.isForeigner === false) {
    const defaults = new Employee();
    for (const field of NATIONALITY_FIELDS) {
      model[field] = defaults[field];
      if (!equal(raw[field], defaults[field])) patch[field] = defaults[field];
      else delete patch[field];
    }
  } else if (operation === "nationality" && changes.hasPeriodOfStayLimit === false) {
    model.periodOfStay = null;
    if (!equal(raw.periodOfStay, null)) patch.periodOfStay = null;
    else delete patch.periodOfStay;
  }
  try { model.validate(); } catch { throw new EmployeeOperationError("invalid-argument"); }
  if (["lastName", "firstName"].some((field) => Object.hasOwn(patch, field))) { patch.fullName = model.fullName; patch.displayName = model.displayName; }
  if (["lastNameKana", "firstNameKana"].some((field) => Object.hasOwn(patch, field))) patch.fullNameKana = model.fullNameKana;
  if (Employee.tokenFields.some((field) => Object.hasOwn(patch, field))) patch.tokenMap = model.tokenMap;
  if (ADDRESS_FIELDS.some((field) => Object.hasOwn(patch, field))) { patch.prefecture = model.prefecture; patch.fullAddress = model.fullAddress; }
  return { patch, model };
}
