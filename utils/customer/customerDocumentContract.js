// Persisted Customer fields shared with the writer. This does not normalize data.
export const CUSTOMER_DOCUMENT_FIELDS = Object.freeze([
  "docId", "uid", "createdAt", "updatedAt", "code", "name", "branchName",
  "abbreviation", "nameKana", "zipcode", "prefCode", "city", "address",
  "building", "location", "geopoint", "tel", "fax", "contractStatus",
  "cutoffDate", "paymentMonth", "paymentDate", "remarks", "fullAddress",
  "prefecture", "tokenMap",
]);

export const CUSTOMER_DOCUMENT_REASONS = Object.freeze([
  "field-set", "wire-shape", "required-string", "nullable-string", "doc-id",
  "timestamp", "postal-code", "pref-code", "status", "payment-integer",
  "location", "geopoint", "address", "token-map", "unicode-unverified",
  "wire-unverified",
]);

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function isWire(value, type) {
  return exactKeys(value, [type]);
}

function isNull(value) {
  return isWire(value, "nullValue") && value.nullValue === null;
}

function stringValue(value) {
  return isWire(value, "stringValue") && typeof value.stringValue === "string"
    ? value.stringValue : undefined;
}

function integerValue(value) {
  if (!isWire(value, "integerValue") || typeof value.integerValue !== "string" ||
      !/^-?(0|[1-9][0-9]*)$/u.test(value.integerValue)) return undefined;
  const number = Number(value.integerValue);
  return Number.isSafeInteger(number) ? number : undefined;
}

function numberValue(value) {
  if (isWire(value, "doubleValue") && typeof value.doubleValue === "number" &&
      Number.isFinite(value.doubleValue)) return value.doubleValue;
  return integerValue(value);
}

function mapFields(value) {
  if (!isWire(value, "mapValue") || !isRecord(value.mapValue)) return undefined;
  // An omitted protobuf map represents the empty map, not a Customer default.
  if (Object.keys(value.mapValue).length === 0) return {};
  return exactKeys(value.mapValue, ["fields"]) && isRecord(value.mapValue.fields)
    ? value.mapValue.fields : undefined;
}

export function isWireTimestamp(value) {
  if (typeof value !== "string" ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$/u.test(value)) return false;
  const base = value.slice(0, 19);
  const date = new Date(`${base}Z`);
  return value.slice(0, 4) !== "0000" && Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 19) === base;
}

// Mirrors the persisted-shape part of isValidCustomer in firestore.rules.
// Actor, request.time, update ownership, and derived-value semantics are not
// established by a read-only document inspection.
export function inspectCustomerDocumentFields(fields, documentId) {
  const reasons = new Set();
  const reject = (reason) => reasons.add(reason);
  if (!exactKeys(fields, CUSTOMER_DOCUMENT_FIELDS)) reject("field-set");
  if (!isRecord(fields)) return [...reasons];
  for (const field of CUSTOMER_DOCUMENT_FIELDS) {
    if (!isRecord(fields[field]) || Object.keys(fields[field]).length !== 1) {
      reject("wire-shape");
    }
  }

  function checkString(field, max, nullable = false) {
    if (nullable && isNull(fields[field])) return;
    const value = stringValue(fields[field]);
    if (value === undefined || (!nullable && value.length === 0) || value.length > max) {
      reject(nullable ? "nullable-string" : "required-string");
    }
    // Non-BMP/surrogate string-size parity has not been accepted against Rules.
    if (value !== undefined && /[\uD800-\uDFFF]/.test(value)) reject("unicode-unverified");
  }
  for (const [field, max] of Object.entries({
    docId: 128, uid: 128, name: 20, abbreviation: 20, nameKana: 40,
    city: 20, address: 30, fullAddress: 74, prefecture: 4,
  })) checkString(field, max);
  for (const [field, max] of Object.entries({
    code: 10, branchName: 20, building: 30, tel: 13, fax: 13, remarks: 200,
  })) checkString(field, max, true);
  if (stringValue(fields.docId) !== documentId) reject("doc-id");
  for (const field of ["createdAt", "updatedAt"]) {
    if (!isWire(fields[field], "timestampValue") ||
        !isWireTimestamp(fields[field].timestampValue)) reject("timestamp");
  }
  if (!stringValue(fields.zipcode)) reject("postal-code");
  if (!/^(0[1-9]|[1-3][0-9]|4[0-7])$/u.test(stringValue(fields.prefCode) ?? "")) reject("pref-code");
  if (!["ACTIVE", "TERMINATED"].includes(stringValue(fields.contractStatus))) reject("status");
  for (const [field, allowed] of Object.entries({
    cutoffDate: [0, 5, 10, 15, 20, 25], paymentMonth: [0, 1, 2, 3, 4, 5, 6],
    paymentDate: [0, 5, 10, 15, 20, 25],
  })) {
    if (!allowed.includes(integerValue(fields[field]))) reject("payment-integer");
  }

  if (isNull(fields.location)) {
    if (!isNull(fields.geopoint)) reject("geopoint");
  } else {
    const location = mapFields(fields.location);
    const lat = numberValue(location?.lat);
    const lng = numberValue(location?.lng);
    const formatted = stringValue(location?.formattedAddress);
    if (!exactKeys(location, ["formattedAddress", "lat", "lng"]) ||
        !formatted || formatted.length > 200 || lat === undefined || lng === undefined ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) reject("location");
    if (formatted && /[\uD800-\uDFFF]/.test(formatted)) reject("unicode-unverified");
    const point = isWire(fields.geopoint, "geoPointValue") ? fields.geopoint.geoPointValue : undefined;
    if (!exactKeys(point, ["latitude", "longitude"])) {
      // Do not silently fill omitted protobuf zero coordinates.
      reject("wire-unverified");
    } else if (typeof point.latitude !== "number" || typeof point.longitude !== "number" ||
               !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
               point.latitude !== lat || point.longitude !== lng) reject("geopoint");
  }
  const addressParts = ["prefecture", "city", "address"].map((field) => stringValue(fields[field]));
  if (addressParts.some((part) => part === undefined) ||
      stringValue(fields.fullAddress) !== addressParts.join("")) reject("address");
  if (!isNull(fields.tokenMap)) {
    const tokens = mapFields(fields.tokenMap);
    if (!tokens || Object.keys(tokens).length > 512 ||
        Object.values(tokens).some((value) => !isWire(value, "booleanValue") || value.booleanValue !== true)) {
      reject("token-map");
    }
  }
  return [...reasons];
}
