import { Employee, Certification, Insurance } from "@shisyamo4131/air-guard-v2-schemas";
import { BASIC_FIELDS, NATIONALITY_FIELDS, SECURITY_FIELDS, DATE_FIELDS, CERTIFICATION_FIELDS, INSURANCE_KINDS, EmployeeOperationError, employeeAllowed, plain, rawForClass } from "./employeeContract.js";
import { insuranceVersions, validateInsuranceRaw } from "./employeeInsuranceContract.js";

export const archiveIdentifier = (value) => typeof value === "string" && value.length > 0 && value.length <= 128 && value.trim() === value && !/[\/\u0000-\u001f\u007f]/u.test(value);
export const archiveActorAllowed = (identity, actorUser) => employeeAllowed({ ...identity, actorUser }, false)
  && (actorUser.isAdmin === true || actorUser.roles.includes("manager"));
export const archiveFail = (code = "failed-precondition", message = "従業員情報や参照情報を確認できないため、アーカイブできません。") => { throw new EmployeeOperationError(code, message); };
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
export function parseEmployeeArchiveInput(input) {
  if (!exact(input, ["employeeId", "reason", "operationId"]) || !archiveIdentifier(input.employeeId) || !archiveIdentifier(input.operationId) || typeof input.reason !== "string") archiveFail("invalid-argument");
  const reason = input.reason.trim();
  if (!reason.length || reason.length > 200 || /[\u0000-\u001f\u007f]/u.test(reason)) archiveFail("invalid-argument");
  return { employeeId: input.employeeId, operationId: input.operationId, reason };
}
export function archiveTimestamp(value) {
  return value !== null && typeof value === "object" && !(value instanceof Date) && typeof value.toDate === "function"
    && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1000000000 && Number.isFinite(value.toDate().getTime());
}
const dates = new Set([...DATE_FIELDS, "dateOfTermination", "enrollmentDateAt", "lossDateAt"]);
function knownFields(raw, schema, fields = Object.keys(schema)) {
  if (!plain(raw)) archiveFail();
  for (const field of fields) {
    const definition = schema[field];
    if (!definition) continue;
    if (!Object.hasOwn(raw, field)) { if (definition.required === true) archiveFail(); continue; }
    const value = raw[field];
    if (value === null) { if (definition.required === true || definition.type === Boolean) archiveFail(); continue; }
    if (dates.has(field)) { if (!archiveTimestamp(value)) archiveFail(); }
    else if (definition.type === String && (typeof value !== "string" || (definition.length && value.length > definition.length))) archiveFail();
    else if (definition.type === Boolean && typeof value !== "boolean") archiveFail();
    else if (definition.type === Array && !Array.isArray(value)) archiveFail();
  }
}
export function validateEmployeeArchiveRaw(raw, employeeId) {
  if (!plain(raw) || raw.docId !== employeeId || !archiveIdentifier(raw.uid) || !archiveTimestamp(raw.createdAt) || !archiveTimestamp(raw.updatedAt)) archiveFail();
  knownFields(raw, Employee.classProps, [...BASIC_FIELDS, ...NATIONALITY_FIELDS, ...SECURITY_FIELDS, "employmentStatus", "dateOfTermination", "reasonOfTermination"]);
  if (!["ACTIVE", "RESIGNED"].includes(raw.employmentStatus)) archiveFail();
  if (Object.hasOwn(raw, "securityCertifications")) {
    if (!Array.isArray(raw.securityCertifications)) archiveFail();
    for (const entry of raw.securityCertifications) {
      knownFields(entry, Certification.classProps, CERTIFICATION_FIELDS);
      if (!Certification.classProps.type.component.attrs.items.some((item) => item.value === entry.type)) archiveFail();
      if (Object.hasOwn(entry, "key") && typeof entry.key !== "string") archiveFail();
      try { new Certification(rawForClass(entry)).validate(); } catch { archiveFail(); }
    }
  }
  for (const kind of INSURANCE_KINDS) if (Object.hasOwn(raw, kind)) {
    validateInsuranceRaw(raw[kind]); knownFields(raw[kind], Insurance.classProps);
    for (const entry of raw[kind].history) knownFields(entry, Insurance.classProps, ["status", "previousStatus", "enrollmentDateAt", "lossDateAt", "lossReason", "number"]);
    try { new Insurance(rawForClass(raw[kind])).validate(); } catch { archiveFail(); }
  }
  insuranceVersions(raw);
  for (const field of ["fullName", "fullNameKana", "fullAddress", "prefecture"]) if (Object.hasOwn(raw, field) && raw[field] !== null && typeof raw[field] !== "string") archiveFail();
  if (Object.hasOwn(raw, "tokenMap") && (!plain(raw.tokenMap) || Object.values(raw.tokenMap).some((value) => typeof value !== "boolean"))) archiveFail();
  if (raw.location !== undefined && raw.location !== null && (!plain(raw.location) || typeof raw.location.formattedAddress !== "string" || !Number.isFinite(raw.location.lat) || Math.abs(raw.location.lat) > 90 || !Number.isFinite(raw.location.lng) || Math.abs(raw.location.lng) > 180)) archiveFail();
  if (raw.geopoint !== undefined && raw.geopoint !== null && (raw.geopoint.constructor?.name !== "GeoPoint" || typeof raw.geopoint.isEqual !== "function" || !Number.isFinite(raw.geopoint.latitude) || Math.abs(raw.geopoint.latitude) > 90 || !Number.isFinite(raw.geopoint.longitude) || Math.abs(raw.geopoint.longitude) > 180)) archiveFail();
  try { new Employee(rawForClass(raw)).validate(); } catch { archiveFail(); }
  return raw; // validation candidates never become the copied snapshot
}
export function validateEmployeeArchiveEnvelope(envelope, employeeId) {
  if (!exact(envelope, ["schemaVersion", "employee", "audit"]) || envelope.schemaVersion !== 1 || !exact(envelope.audit, ["operationId", "reason", "actorUid", "archivedAt"]) || !archiveIdentifier(envelope.audit.actorUid) || !archiveTimestamp(envelope.audit.archivedAt)) archiveFail("already-exists", "同じIDのアーカイブを確認できません。");
  const parsed = parseEmployeeArchiveInput({ employeeId, operationId: envelope.audit.operationId, reason: envelope.audit.reason });
  if (parsed.reason !== envelope.audit.reason) archiveFail("already-exists");
  validateEmployeeArchiveRaw(envelope.employee, employeeId);
  return envelope;
}
