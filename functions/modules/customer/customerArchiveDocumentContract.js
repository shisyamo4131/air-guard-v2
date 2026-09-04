/*****************************************************************************
 * @file ./functions/modules/customer/customerArchiveDocumentContract.js
 * @description Customer archiveで保存するdecoded documentを検証します。
 *****************************************************************************/
import { FieldValue, GeoPoint, Timestamp } from "firebase-admin/firestore";

export const CUSTOMER_ARCHIVE_SCHEMA_VERSION = 1;

export const CUSTOMER_ARCHIVE_CUSTOMER_FIELDS = Object.freeze([
  "docId",
  "uid",
  "createdAt",
  "updatedAt",
  "code",
  "name",
  "branchName",
  "abbreviation",
  "nameKana",
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
  "location",
  "geopoint",
  "tel",
  "fax",
  "contractStatus",
  "cutoffDate",
  "paymentMonth",
  "paymentDate",
  "remarks",
  "fullAddress",
  "prefecture",
  "tokenMap",
]);

const ARCHIVE_FIELDS = Object.freeze(["schemaVersion", "customer", "audit"]);
const AUDIT_FIELDS = Object.freeze([
  "operationId",
  "reason",
  "actorUid",
  "archivedAt",
]);

const NULLABLE_STRING_LIMITS = Object.freeze({
  code: 10,
  branchName: 20,
  building: 30,
  tel: 13,
  fax: 13,
  remarks: 200,
});

const REQUIRED_STRING_LIMITS = Object.freeze({
  docId: 128,
  uid: 128,
  name: 20,
  abbreviation: 20,
  nameKana: 40,
  city: 20,
  address: 30,
  fullAddress: 74,
  prefecture: 4,
});

const PAYMENT_VALUES = Object.freeze({
  cutoffDate: Object.freeze([0, 5, 10, 15, 20, 25]),
  paymentMonth: Object.freeze([0, 1, 2, 3, 4, 5, 6]),
  paymentDate: Object.freeze([0, 5, 10, 15, 20, 25]),
});

export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function enumerableOwnKeys(value) {
  return Reflect.ownKeys(value).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key),
  );
}

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const keys = enumerableOwnKeys(value);
  return (
    keys.length === expected.length &&
    keys.every((key) => typeof key === "string") &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function isRequiredString(value, maxLength) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength
  );
}

function isNullableString(value, maxLength) {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function isSafePathIdentifier(value) {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    value.trim() === value &&
    !value.includes("/") &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isNormalizedString(value, maxLength) {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maxLength &&
    value.trim() === value
  );
}

export function isServerTimestampSentinel(value) {
  try {
    const expected = FieldValue.serverTimestamp();
    return (
      value instanceof FieldValue &&
      typeof value.isEqual === "function" &&
      value.isEqual(expected) === true &&
      expected.isEqual(value) === true
    );
  } catch {
    return false;
  }
}

function isValidLocation(value) {
  if (value === null) return true;
  return (
    hasExactKeys(value, ["formattedAddress", "lat", "lng"]) &&
    isRequiredString(value.formattedAddress, 200) &&
    typeof value.lat === "number" &&
    Number.isFinite(value.lat) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    typeof value.lng === "number" &&
    Number.isFinite(value.lng) &&
    value.lng >= -180 &&
    value.lng <= 180
  );
}

function isValidTokenMap(value) {
  return (
    value === null ||
    (isPlainObject(value) &&
      enumerableOwnKeys(value).every((key) => typeof key === "string") &&
      Object.keys(value).length <= 512 &&
      Object.values(value).every((tokenValue) => tokenValue === true))
  );
}

/**
 * Admin SDKがdecodeしたCustomer documentのexact shapeを検証します。
 * @param {unknown} value
 * @param {string} customerId
 * @returns {boolean}
 */
export function isValidCustomerArchiveSnapshot(value, customerId) {
  if (!hasExactKeys(value, CUSTOMER_ARCHIVE_CUSTOMER_FIELDS)) return false;

  for (const [field, maxLength] of Object.entries(REQUIRED_STRING_LIMITS)) {
    if (!isRequiredString(value[field], maxLength)) return false;
  }
  for (const [field, maxLength] of Object.entries(NULLABLE_STRING_LIMITS)) {
    if (!isNullableString(value[field], maxLength)) return false;
  }

  if (value.docId !== customerId) return false;
  if (!(value.createdAt instanceof Timestamp)) return false;
  if (!(value.updatedAt instanceof Timestamp)) return false;
  if (typeof value.zipcode !== "string" || value.zipcode.length === 0) {
    return false;
  }
  if (
    typeof value.prefCode !== "string" ||
    !/^(0[1-9]|[1-3][0-9]|4[0-7])$/u.test(value.prefCode)
  ) {
    return false;
  }
  if (!["ACTIVE", "TERMINATED"].includes(value.contractStatus)) return false;

  for (const [field, allowed] of Object.entries(PAYMENT_VALUES)) {
    if (!Number.isSafeInteger(value[field]) || !allowed.includes(value[field])) {
      return false;
    }
  }

  if (!isValidLocation(value.location)) return false;
  if (value.location === null) {
    if (value.geopoint !== null) return false;
  } else if (
    !(value.geopoint instanceof GeoPoint) ||
    value.geopoint.latitude !== value.location.lat ||
    value.geopoint.longitude !== value.location.lng
  ) {
    return false;
  }

  if (value.fullAddress !== `${value.prefecture}${value.city}${value.address}`) {
    return false;
  }
  return isValidTokenMap(value.tokenMap);
}

export function copyCustomerArchiveSnapshot(value) {
  return Object.fromEntries(
    CUSTOMER_ARCHIVE_CUSTOMER_FIELDS.map((field) => [field, value[field]]),
  );
}

/**
 * 新規archive write用のversion 1 envelopeを構築します。
 */
export function buildCustomerArchiveEnvelope({
  customer,
  customerId,
  operationId,
  reason,
  actorUid,
  archivedAt,
} = {}) {
  if (
    !isValidCustomerArchiveSnapshot(customer, customerId) ||
    !isNormalizedString(operationId, 128) ||
    !isNormalizedString(reason, 200) ||
    !isSafePathIdentifier(actorUid) ||
    !isServerTimestampSentinel(archivedAt)
  ) {
    throw new TypeError("Customer archive envelope input is invalid");
  }

  return {
    schemaVersion: CUSTOMER_ARCHIVE_SCHEMA_VERSION,
    customer: copyCustomerArchiveSnapshot(customer),
    audit: {
      operationId,
      reason,
      actorUid,
      archivedAt,
    },
  };
}

/**
 * commit済みarchive envelopeをretry照合前に検証します。
 */
export function isValidCustomerArchiveEnvelope(value, customerId) {
  return (
    hasExactKeys(value, ARCHIVE_FIELDS) &&
    value.schemaVersion === CUSTOMER_ARCHIVE_SCHEMA_VERSION &&
    isValidCustomerArchiveSnapshot(value.customer, customerId) &&
    hasExactKeys(value.audit, AUDIT_FIELDS) &&
    isNormalizedString(value.audit.operationId, 128) &&
    isNormalizedString(value.audit.reason, 200) &&
    isSafePathIdentifier(value.audit.actorUid) &&
    value.audit.archivedAt instanceof Timestamp
  );
}
