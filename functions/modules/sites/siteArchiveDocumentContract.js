import { FieldValue, GeoPoint, Timestamp } from "firebase-admin/firestore";

export const SITE_ARCHIVE_SCHEMA_VERSION = 1;

export const SITE_ARCHIVE_SITE_FIELDS = Object.freeze([
  "docId", "uid", "createdAt", "updatedAt", "customerId", "customer",
  "customerName", "code", "name", "hasAbbreviation", "abbreviation",
  "nameKana", "zipcode", "prefCode", "city", "address", "building",
  "securityType", "siteNumber", "constructionPeriodStartAt",
  "constructionPeriodEndAt", "location", "geopoint", "remarks",
  "agreementsV2", "status", "fullAddress", "prefecture", "isTemporary",
  "hasConstructionPeriod", "hasConstructionPeriodStartAt",
  "hasConstructionPeriodEndAt", "displayName", "tokenMap",
]);

const OPTIONAL_SITE_FIELDS = Object.freeze([
  "scheduleRevision", "statusChangedAt", "statusChangedBy",
  "statusChangeSource", "statusChangeReason",
]);
const ARCHIVE_FIELDS = Object.freeze(["schemaVersion", "site", "audit"]);
const AUDIT_FIELDS = Object.freeze([
  "operationId", "reason", "actorUid", "archivedAt",
]);

export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownKeys(value) {
  return Reflect.ownKeys(value).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key),
  );
}

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const keys = ownKeys(value);
  return keys.length === expected.length &&
    keys.every((key) => typeof key === "string") &&
    expected.every((key) => Object.hasOwn(value, key));
}

function isSafeIdentifier(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 &&
    value.trim() === value && !value.includes("/") &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function isRequiredString(value, maxLength) {
  return typeof value === "string" && value.length >= 1 && value.length <= maxLength;
}

function isNullableString(value, maxLength) {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function isValidLocation(value) {
  return value === null || (hasExactKeys(value, ["formattedAddress", "lat", "lng"]) &&
    isRequiredString(value.formattedAddress, 200) &&
    Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90 &&
    Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180);
}

function isValidCustomerProjection(value, customerId) {
  if (!isPlainObject(value) || value.docId !== customerId) return false;
  const required = ["docId", "updatedAt", "code", "name", "abbreviation", "cutoffDate"];
  return required.every((key) => Object.hasOwn(value, key)) &&
    isSafeIdentifier(value.docId) && value.updatedAt instanceof Timestamp &&
    isNullableString(value.code, 10) && isRequiredString(value.name, 20) &&
    isNullableString(value.abbreviation, 20) &&
    Number.isSafeInteger(value.cutoffDate) &&
    [0, 5, 10, 15, 20, 25].includes(value.cutoffDate);
}

function isValidTokenMap(value) {
  return value === null || (isPlainObject(value) && ownKeys(value).length <= 512 &&
    ownKeys(value).every((key) => typeof key === "string" && value[key] === true));
}

function hasValidLifecycleMetadata(value) {
  const present = ["statusChangedAt", "statusChangedBy", "statusChangeSource", "statusChangeReason"]
    .filter((field) => Object.hasOwn(value, field));
  if (present.length === 0) return true;
  return present.length === 4 && value.statusChangedAt instanceof Timestamp &&
    isSafeIdentifier(value.statusChangedBy) &&
    ["MANUAL", "AUTO", "REACTIVATION"].includes(value.statusChangeSource) &&
    isRequiredString(value.statusChangeReason, 200);
}

export function isServerTimestampSentinel(value) {
  try {
    const expected = FieldValue.serverTimestamp();
    return value instanceof FieldValue && value.isEqual(expected) && expected.isEqual(value);
  } catch {
    return false;
  }
}

export function isValidSiteArchiveSnapshot(value, siteId) {
  if (!isPlainObject(value)) return false;
  const keys = ownKeys(value);
  const allowed = [...SITE_ARCHIVE_SITE_FIELDS, ...OPTIONAL_SITE_FIELDS];
  if (!SITE_ARCHIVE_SITE_FIELDS.every((field) => Object.hasOwn(value, field)) ||
      keys.some((key) => typeof key !== "string" || !allowed.includes(key))) return false;
  if (value.docId !== siteId || !isSafeIdentifier(value.docId) ||
      !isSafeIdentifier(value.uid) || !(value.createdAt instanceof Timestamp) ||
      !(value.updatedAt instanceof Timestamp)) return false;
  if (value.customerId === null) {
    if (value.customer !== null || !isRequiredString(value.customerName, 20)) return false;
  } else if (!isSafeIdentifier(value.customerId) ||
      !isValidCustomerProjection(value.customer, value.customerId)) return false;
  if (!isNullableString(value.customerName, 20) || !isNullableString(value.code, 10) ||
      !isRequiredString(value.name, 40) || typeof value.hasAbbreviation !== "boolean" ||
      !isNullableString(value.abbreviation, 40) ||
      (value.hasAbbreviation && !isRequiredString(value.abbreviation, 40)) ||
      !isRequiredString(value.nameKana, 60) ||
      !(value.zipcode === null || typeof value.zipcode === "string") ||
      typeof value.prefCode !== "string" ||
      !/^(0[1-9]|[1-3][0-9]|4[0-7])$/u.test(value.prefCode) ||
      !isRequiredString(value.city, 20) || !isRequiredString(value.address, 30) ||
      !isNullableString(value.building, 30) ||
      !["UNSET", "FACILITY", "CROWD", "TRAFFIC", "TRAINING", "OTHER"].includes(value.securityType) ||
      !isNullableString(value.siteNumber, 40) || !isNullableString(value.remarks, 200) ||
      !Array.isArray(value.agreementsV2) || !["ACTIVE", "TERMINATED"].includes(value.status)) return false;
  for (const field of ["constructionPeriodStartAt", "constructionPeriodEndAt"]) {
    if (value[field] !== null && !(value[field] instanceof Timestamp)) return false;
  }
  if (value.constructionPeriodStartAt && value.constructionPeriodEndAt &&
      value.constructionPeriodStartAt.toMillis() > value.constructionPeriodEndAt.toMillis()) return false;
  if (!isValidLocation(value.location) ||
      (value.location === null ? value.geopoint !== null :
        (!(value.geopoint instanceof GeoPoint) ||
          value.geopoint.latitude !== value.location.lat || value.geopoint.longitude !== value.location.lng))) return false;
  if (!isRequiredString(value.fullAddress, 54) || !isRequiredString(value.prefecture, 4) ||
      value.fullAddress !== `${value.prefecture}${value.city}${value.address}` ||
      typeof value.isTemporary !== "boolean" || value.isTemporary !== (value.customerId === null) ||
      typeof value.hasConstructionPeriod !== "boolean" ||
      value.hasConstructionPeriod !== Boolean(value.constructionPeriodStartAt || value.constructionPeriodEndAt) ||
      typeof value.hasConstructionPeriodStartAt !== "boolean" ||
      value.hasConstructionPeriodStartAt !== Boolean(value.constructionPeriodStartAt) ||
      typeof value.hasConstructionPeriodEndAt !== "boolean" ||
      value.hasConstructionPeriodEndAt !== Boolean(value.constructionPeriodEndAt) ||
      !isRequiredString(value.displayName, 40) ||
      value.displayName !== (value.hasAbbreviation && value.abbreviation ? value.abbreviation : value.name) ||
      !isValidTokenMap(value.tokenMap)) return false;
  if (Object.hasOwn(value, "scheduleRevision") &&
      (!Number.isSafeInteger(value.scheduleRevision) || value.scheduleRevision < 0)) return false;
  return hasValidLifecycleMetadata(value);
}

export function copySiteArchiveSnapshot(value) {
  return Object.fromEntries(ownKeys(value).map((field) => [field, value[field]]));
}

export function buildSiteArchiveEnvelope({ site, siteId, operationId, reason, actorUid, archivedAt } = {}) {
  if (!isValidSiteArchiveSnapshot(site, siteId) || !isSafeIdentifier(operationId) ||
      !isRequiredString(reason, 200) || reason.trim() !== reason ||
      !isSafeIdentifier(actorUid) || !isServerTimestampSentinel(archivedAt)) {
    throw new TypeError("Site archive envelope input is invalid");
  }
  return {
    schemaVersion: SITE_ARCHIVE_SCHEMA_VERSION,
    site: copySiteArchiveSnapshot(site),
    audit: { operationId, reason, actorUid, archivedAt },
  };
}

export function isValidSiteArchiveEnvelope(value, siteId) {
  return hasExactKeys(value, ARCHIVE_FIELDS) &&
    value.schemaVersion === SITE_ARCHIVE_SCHEMA_VERSION &&
    isValidSiteArchiveSnapshot(value.site, siteId) &&
    hasExactKeys(value.audit, AUDIT_FIELDS) &&
    isSafeIdentifier(value.audit.operationId) &&
    isRequiredString(value.audit.reason, 200) && value.audit.reason.trim() === value.audit.reason &&
    isSafeIdentifier(value.audit.actorUid) && value.audit.archivedAt instanceof Timestamp;
}
