import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { mapLegacyCompanyToConfigurationV1 } from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

export const COMPANY_SETTINGS_PLAN_DOMAIN =
  "airguard:ccb-v1:create-only-plan:v1";

export const COMPANY_SETTINGS_EXIT_CODES = Object.freeze({
  CLEAN: 0,
  CHANGES: 2,
  DATA_BLOCKER: 3,
  APPLY_INCOMPLETE: 4,
  USAGE: 64,
  UNEXPECTED: 70,
  TARGET_REJECTED: 78,
});

export const COMPANY_SETTINGS_TARGETS = Object.freeze([
  Object.freeze({ collection: "Settings", document: "profile", valueKey: "profile" }),
  Object.freeze({ collection: "Settings", document: "billing", valueKey: "billing" }),
  Object.freeze({ collection: "Settings", document: "operations", valueKey: "operations" }),
  Object.freeze({ collection: "Settings", document: "arrangement", valueKey: "arrangement" }),
  Object.freeze({ collection: "Settings", document: "entitlement", valueKey: "entitlement" }),
  Object.freeze({ collection: "Settings", document: "maintenance", valueKey: "maintenance" }),
  Object.freeze({ collection: "PrivateSettings", document: "entitlement", valueKey: "privateEntitlement" }),
  Object.freeze({ collection: "PrivateSettings", document: "maintenance", valueKey: "privateMaintenance" }),
]);

export const CODEX_COMPANY_SETTINGS_MIGRATION_TARGET = Object.freeze({
  name: "codex-local",
  projectId: "demo-air-guard-v2-codex",
  databaseId: "(default)",
  databaseType: "FIRESTORE_NATIVE",
  edition: "STANDARD",
  firestoreHost: "127.0.0.1:18080",
  remote: false,
});

const EDITION_RECEIPT_DOMAIN = "airguard:ccb-v1:codex-local-edition:v1";
const RULES_RECEIPT_DOMAIN = "airguard:ccb-v1:codex-local-rules-file:v1";

const LEGACY_KEYS = new Set([
  "companyName", "companyNameKana", "zipcode", "prefCode", "city", "address",
  "building", "tel", "fax", "invoiceNumber", "bankName", "branchName",
  "accountType", "accountNumber", "accountHolder", "minuteInterval",
  "roundSetting", "firstDayOfWeek", "attendanceManagementMode", "siteOrder",
  "scheduleOrder", "maintenanceMode", "maintenanceReason", "maintenanceStartAt",
  "maintenanceStartedBy", "stripeCustomerId", "subscription", "agreementsV2",
  "location", "docId", "uid", "createdAt", "updatedAt", "fullAddress",
  "prefecture", "hasBankInfo", "isCompleteRequiredFields", "geopoint",
]);

const ROOT_PATH = /^Companies\/([^/]+)$/u;
const TARGET_PATH =
  /^Companies\/([^/]+)\/(Settings|PrivateSettings)\/([^/]+)$/u;
const AUDIT_PATH = /^Companies\/([^/]+)\/SettingAudits\/([^/]+)$/u;
const COMPANY_DESCENDANT_PATH = /^Companies\/([^/]+)(?:\/.*)?$/u;

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function compareUtf8(left, right) {
  return Buffer.from(left, "utf8").compare(Buffer.from(right, "utf8"));
}

function opaqueSubject(path) {
  return sha256(`airguard:ccb-v1:subject:v1\0${path}`).slice(0, 20);
}

export function createCompanySettingsManifestDigest(manifest) {
  if (!Array.isArray(manifest) || manifest.some((path) => typeof path !== "string" || !ROOT_PATH.test(path))) {
    throw new TypeError("manifest must contain only Company root paths");
  }
  if (new Set(manifest).size !== manifest.length) {
    throw new TypeError("manifest must not contain duplicate Company roots");
  }
  return sha256(
    `airguard:ccb-v1:target-manifest:v1\0${stableJson([...manifest].sort(compareUtf8))}`,
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort(compareUtf8)
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalDouble(value) {
  if (typeof value === "string") {
    if (["NaN", "Infinity", "-Infinity"].includes(value)) return value;
    throw new TypeError("doubleValue string must be NaN or Infinity");
  }
  if (typeof value !== "number") throw new TypeError("doubleValue must be numeric");
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return value.toString();
}

function canonicalTimestamp(value) {
  if (typeof value !== "string") throw new TypeError("timestampValue must be a string");
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u.exec(value);
  if (!match) throw new TypeError("timestampValue must be UTC RFC 3339");
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  if (
    year < 1 ||
    month < 1 || month > 12 ||
    hour > 23 || minute > 59 || second > 59
  ) {
    throw new TypeError("timestampValue is outside the Firestore Timestamp range");
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) {
    throw new TypeError("timestampValue has an invalid calendar date");
  }
  const base = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
  const milliseconds = Date.parse(`${base}Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 19) !== base
  ) {
    throw new TypeError("timestampValue is invalid");
  }
  const seconds = Math.trunc(milliseconds / 1000);
  const nanos = (match[7] ?? "").padEnd(9, "0");
  return [String(seconds), nanos];
}

/**
 * Firestore REST Valueを公開fieldだけで型付き正規化します。
 * integer/double、Timestamp、GeoPoint、reference、bytesを区別します。
 */
export function canonicalizeFirestoreValue(value, path = "$") {
  if (!isPlainObject(value)) throw new TypeError(`${path} must be a Firestore Value`);
  const knownKeys = [
    "nullValue", "booleanValue", "integerValue", "doubleValue",
    "timestampValue", "stringValue", "bytesValue", "referenceValue",
    "geoPointValue", "arrayValue", "mapValue",
  ];
  const present = knownKeys.filter((key) => Object.hasOwn(value, key));
  if (present.length !== 1 || Object.keys(value).length !== 1) {
    throw new TypeError(`${path} must contain exactly one supported Firestore type`);
  }
  const type = present[0];
  const body = value[type];
  switch (type) {
    case "nullValue":
      if (body !== null) throw new TypeError(`${path}.nullValue must be null`);
      return ["null"];
    case "booleanValue":
      if (typeof body !== "boolean") throw new TypeError(`${path}.booleanValue must be boolean`);
      return ["bool", body];
    case "integerValue": {
      if (typeof body !== "string" || !/^-?(?:0|[1-9]\d*)$/u.test(body)) {
        throw new TypeError(`${path}.integerValue must be a canonical decimal string`);
      }
      const integer = BigInt(body);
      if (integer < -9_223_372_036_854_775_808n || integer > 9_223_372_036_854_775_807n) {
        throw new TypeError(`${path}.integerValue is outside the int64 range`);
      }
      return ["int", integer.toString()];
    }
    case "doubleValue":
      return ["double", canonicalDouble(body)];
    case "timestampValue":
      return ["timestamp", ...canonicalTimestamp(body)];
    case "stringValue":
      if (typeof body !== "string") throw new TypeError(`${path}.stringValue must be string`);
      return ["string", body];
    case "bytesValue":
      if (typeof body !== "string") throw new TypeError(`${path}.bytesValue must be base64`);
      if (Buffer.from(body, "base64").toString("base64") !== body) {
        throw new TypeError(`${path}.bytesValue must use canonical base64`);
      }
      return ["bytes", body];
    case "referenceValue":
      if (typeof body !== "string") throw new TypeError(`${path}.referenceValue must be string`);
      return ["reference", body];
    case "geoPointValue":
      if (
        !isPlainObject(body) ||
        Object.keys(body).sort().join("\0") !== "latitude\0longitude" ||
        typeof body.latitude !== "number" || !Number.isFinite(body.latitude) ||
        typeof body.longitude !== "number" || !Number.isFinite(body.longitude) ||
        body.latitude < -90 || body.latitude > 90 ||
        body.longitude < -180 || body.longitude > 180
      ) {
        throw new TypeError(`${path}.geoPointValue is invalid`);
      }
      return ["geopoint", canonicalDouble(body.latitude), canonicalDouble(body.longitude)];
    case "arrayValue": {
      if (!isPlainObject(body)) throw new TypeError(`${path}.arrayValue must be an object`);
      if (Object.keys(body).some((key) => key !== "values")) {
        throw new TypeError(`${path}.arrayValue has unsupported fields`);
      }
      const values = body.values ?? [];
      if (!Array.isArray(values)) throw new TypeError(`${path}.arrayValue.values must be an array`);
      return ["array", values.map((item, index) => canonicalizeFirestoreValue(item, `${path}[${index}]`))];
    }
    case "mapValue": {
      if (!isPlainObject(body)) throw new TypeError(`${path}.mapValue must be an object`);
      if (Object.keys(body).some((key) => key !== "fields")) {
        throw new TypeError(`${path}.mapValue has unsupported fields`);
      }
      const fields = body.fields ?? {};
      if (!isPlainObject(fields)) throw new TypeError(`${path}.mapValue.fields must be an object`);
      return [
        "map",
        Object.keys(fields)
          .sort(compareUtf8)
          .map((key) => [key, canonicalizeFirestoreValue(fields[key], `${path}.${key}`)]),
      ];
    }
    default:
      throw new TypeError(`${path} has an unsupported Firestore type`);
  }
}

export function decodeFirestoreValue(value, path = "$") {
  const canonical = canonicalizeFirestoreValue(value, path);
  switch (canonical[0]) {
    case "null": return null;
    case "bool": return canonical[1];
    case "int": {
      const integer = BigInt(canonical[1]);
      return integer <= BigInt(Number.MAX_SAFE_INTEGER) && integer >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(integer)
        : integer;
    }
    case "double": return Number(canonical[1]);
    case "timestamp": return { seconds: Number(canonical[1]), nanoseconds: Number(canonical[2]) };
    case "string": return canonical[1];
    case "bytes": return Buffer.from(canonical[1], "base64");
    case "reference": return canonical[1];
    case "geopoint": return { latitude: Number(canonical[1]), longitude: Number(canonical[2]) };
    case "array": return canonical[1].map((_, index) => decodeFirestoreValue(value.arrayValue.values[index], `${path}[${index}]`));
    case "map":
      return Object.fromEntries(
        canonical[1].map(([key]) => [key, decodeFirestoreValue(value.mapValue.fields[key], `${path}.${key}`)]),
      );
    default: throw new TypeError(`${path} cannot be decoded`);
  }
}

function timestampLikeToRfc3339(value) {
  const seconds = BigInt(value.seconds);
  const nanoseconds = Number(value.nanoseconds);
  if (!Number.isInteger(nanoseconds) || nanoseconds < 0 || nanoseconds > 999_999_999) {
    throw new TypeError("timestamp nanoseconds are invalid");
  }
  const milliseconds = Number(seconds * 1000n);
  const base = new Date(milliseconds).toISOString().slice(0, 19);
  return `${base}.${String(nanoseconds).padStart(9, "0")}Z`;
}

/** Synthetic fixtureと将来の公開REST readerが同じ型表現を使うための変換です。 */
export function encodeJsAsFirestoreValue(value, path = "$") {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "bigint") return { integerValue: value.toString() };
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && !Object.is(value, -0)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: canonicalDouble(value) };
  }
  if (value instanceof Uint8Array) {
    return { bytesValue: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item, index) => encodeJsAsFirestoreValue(item, `${path}[${index}]`)) } };
  }
  if (isPlainObject(value)) {
    if (
      Object.keys(value).sort().join("\0") === "nanoseconds\0seconds" &&
      (typeof value.seconds === "number" || typeof value.seconds === "bigint")
    ) {
      return { timestampValue: timestampLikeToRfc3339(value) };
    }
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.keys(value).map((key) => [key, encodeJsAsFirestoreValue(value[key], `${path}.${key}`)]),
        ),
      },
    };
  }
  throw new TypeError(`${path} cannot be represented as a Firestore Value`);
}

function targetDefinition(collection, document) {
  return COMPANY_SETTINGS_TARGETS.find(
    (candidate) => candidate.collection === collection && candidate.document === document,
  );
}

function classifyMappingFailure(path) {
  return ["$.maintenanceMode", "$.attendanceManagementMode", "$.bankAccount"].includes(path)
    ? "ambiguousMapping"
    : "invalidSource";
}

function makeFinding(code, classification, subject, detail = null) {
  return Object.freeze({ code, classification, subject, detail, blocking: true });
}

function addCandidatePath(paths, path) {
  if (typeof path !== "string") return false;
  const root = ROOT_PATH.exec(path);
  if (root) {
    paths.add(path);
    return true;
  }
  const nested = TARGET_PATH.exec(path) ?? AUDIT_PATH.exec(path);
  if (nested) {
    paths.add(`Companies/${nested[1]}`);
    return true;
  }
  return false;
}

function canonicalFingerprint(value) {
  return sha256(stableJson(canonicalizeFirestoreValue(value)));
}

function snapshotFingerprint(value) {
  try {
    return Object.freeze({ fingerprint: canonicalFingerprint(value), valid: true });
  } catch {
    return Object.freeze({
      fingerprint: sha256(`invalid-firestore-value\0${stableJson(value)}`),
      valid: false,
    });
  }
}

function snapshotReceipt(record) {
  const snapshot = snapshotFingerprint(record?.value);
  return Object.freeze({
    pathSubject: opaqueSubject(String(record?.path ?? "invalid")),
    updateTime: typeof record?.updateTime === "string" ? record.updateTime : null,
    fingerprint: snapshot.fingerprint,
    valid: snapshot.valid && typeof record?.updateTime === "string",
  });
}

function sortedSnapshotReceipts(records) {
  return records.map(snapshotReceipt).sort((a, b) =>
    compareUtf8(stableJson(a), stableJson(b)),
  );
}

function validateHexDigest(value, name, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${name} must be a lowercase SHA-256 digest`);
  }
}

/**
 * Normalized snapshotだけを受け取るpure plannerです。Firestoreやnetworkへ接続しません。
 */
export function planCompanySettingsMigration({
  editionVerified = false,
  projectId,
  databaseId,
  databaseType,
  edition,
  editionReceiptDigest,
  actorUid,
  timestamp,
  fixedCommit,
  schemaPackageVersion,
  schemaContractVersion,
  targetManifestDigest,
  rulesReceiptDigest = null,
  manifest = [],
  roots = [],
  targets = [],
  audits = [],
  unexpectedDocuments = [],
} = {}) {
  if (!Array.isArray(manifest) || !Array.isArray(roots) || !Array.isArray(targets) || !Array.isArray(audits) || !Array.isArray(unexpectedDocuments)) {
    throw new TypeError("migration snapshot collections must be arrays");
  }
  for (const [name, value] of Object.entries({ projectId, databaseId, databaseType, edition })) {
    if (typeof value !== "string" || value.length < 1 || value.trim() !== value) {
      throw new TypeError(`${name} must be a non-empty string`);
    }
  }
  if (typeof fixedCommit !== "string" || !/^[0-9a-f]{40}$/u.test(fixedCommit)) {
    throw new TypeError("fixedCommit must be a full Git commit");
  }
  if (schemaPackageVersion !== "2.4.2-dev.167") {
    throw new TypeError("schemaPackageVersion must be exact 2.4.2-dev.167");
  }
  if (schemaContractVersion !== 1) {
    throw new TypeError("schemaContractVersion must be exact 1");
  }
  validateHexDigest(editionReceiptDigest, "editionReceiptDigest");
  validateHexDigest(targetManifestDigest, "targetManifestDigest");
  validateHexDigest(rulesReceiptDigest, "rulesReceiptDigest", { nullable: true });
  if (createCompanySettingsManifestDigest(manifest) !== targetManifestDigest) {
    throw new TypeError("targetManifestDigest does not match manifest");
  }
  if (
    typeof actorUid !== "string" ||
    actorUid.length < 1 ||
    actorUid.length > 128 ||
    actorUid.trim() !== actorUid ||
    actorUid.includes("@")
  ) {
    throw new TypeError("actorUid must be a 1-128 character non-email opaque ID");
  }

  const candidatePaths = new Set();
  const invalidPaths = [];
  for (const path of manifest) if (!addCandidatePath(candidatePaths, path)) invalidPaths.push(path);
  for (const record of roots) if (!addCandidatePath(candidatePaths, record?.path)) invalidPaths.push(record?.path);
  for (const record of targets) if (!addCandidatePath(candidatePaths, record?.path)) invalidPaths.push(record?.path);
  for (const record of audits) if (!addCandidatePath(candidatePaths, record?.path)) invalidPaths.push(record?.path);
  for (const record of unexpectedDocuments) {
    const match = COMPANY_DESCENDANT_PATH.exec(record?.path ?? "");
    if (match) candidatePaths.add(`Companies/${match[1]}`);
    else invalidPaths.push(record?.path);
  }

  const manifestSet = new Set(manifest);
  const rootsByPath = new Map();
  for (const record of roots) {
    const bucket = rootsByPath.get(record?.path) ?? [];
    bucket.push(record);
    rootsByPath.set(record?.path, bucket);
  }
  const targetsByCompany = new Map();
  for (const record of targets) {
    const match = TARGET_PATH.exec(record?.path ?? "");
    if (!match) continue;
    const companyPath = `Companies/${match[1]}`;
    const key = `${match[2]}/${match[3]}`;
    const bucket = targetsByCompany.get(companyPath) ?? new Map();
    const records = bucket.get(key) ?? [];
    records.push(record);
    bucket.set(key, records);
    targetsByCompany.set(companyPath, bucket);
  }
  const auditsByCompany = new Map();
  for (const record of audits) {
    const match = AUDIT_PATH.exec(record?.path ?? "");
    if (!match) continue;
    const companyPath = `Companies/${match[1]}`;
    const bucket = auditsByCompany.get(companyPath) ?? [];
    bucket.push(record);
    auditsByCompany.set(companyPath, bucket);
  }
  const unexpectedByCompany = new Map();
  for (const record of unexpectedDocuments) {
    const match = COMPANY_DESCENDANT_PATH.exec(record?.path ?? "");
    if (!match) continue;
    const companyPath = `Companies/${match[1]}`;
    const bucket = unexpectedByCompany.get(companyPath) ?? [];
    bucket.push(record);
    unexpectedByCompany.set(companyPath, bucket);
  }

  const candidatePlans = [];
  const findings = invalidPaths.map((path) =>
    makeFinding("invalid-path", "rootMissingOrOrphan", opaqueSubject(String(path ?? "invalid"))),
  );
  if (editionVerified !== true && candidatePaths.size === 0) {
    findings.push(makeFinding("edition-unverified", "editionUnverified", opaqueSubject("no-candidate")));
  }

  for (const companyPath of [...candidatePaths].sort(compareUtf8)) {
    const subject = opaqueSubject(companyPath);
    const rootRecords = rootsByPath.get(companyPath) ?? [];
    const root = rootRecords[0];
    const actualTargets = targetsByCompany.get(companyPath) ?? new Map();
    const actualAudits = auditsByCompany.get(companyPath) ?? [];
    const actualUnexpected = unexpectedByCompany.get(companyPath) ?? [];
    const candidateFindings = [];
    let mapping = null;

    if (editionVerified !== true) {
      candidateFindings.push(makeFinding("edition-unverified", "editionUnverified", subject));
    }
    if (!manifestSet.has(companyPath)) {
      candidateFindings.push(makeFinding("manifest-root-mismatch", "rootMissingOrOrphan", subject));
    }
    if (rootRecords.length === 0) {
      candidateFindings.push(makeFinding("root-missing", "rootMissingOrOrphan", subject));
    } else if (rootRecords.length > 1) {
      candidateFindings.push(makeFinding("root-duplicate", "rootMissingOrOrphan", subject));
    }

    const rootReceipt = root ? snapshotReceipt(root) : null;
    if (root && !rootReceipt.valid) {
      candidateFindings.push(makeFinding("root-snapshot-invalid", "invalidSource", subject));
    }
    if (rootReceipt?.valid) {
      let sourceData;
      try {
        sourceData = decodeFirestoreValue(root.value);
      } catch {
        sourceData = null;
      }
      if (!isPlainObject(sourceData)) {
        candidateFindings.push(makeFinding("root-value-invalid", "invalidSource", subject));
      } else {
        if (
        sourceData.schemaVersion !== undefined ||
        sourceData.configurationState !== undefined ||
        sourceData.status !== undefined
        ) {
          candidateFindings.push(makeFinding("active-marker-present", "targetConflict", subject));
        }
        const hasActiveMarker =
          sourceData.schemaVersion !== undefined ||
          sourceData.configurationState !== undefined ||
          sourceData.status !== undefined;
        const unknownKeys = hasActiveMarker
          ? []
          : Object.keys(sourceData).filter((key) => !LEGACY_KEYS.has(key));
        if (unknownKeys.length > 0) {
          candidateFindings.push(makeFinding("legacy-unknown-field", "unknownFieldReview", subject));
        }
        if (
          !candidateFindings.some(({ code }) =>
            ["active-marker-present", "legacy-unknown-field"].includes(code),
          )
        ) {
          mapping = mapLegacyCompanyToConfigurationV1(sourceData, { actorUid, timestamp });
          if (!mapping.ok) {
            const classification = classifyMappingFailure(mapping.conflict.path);
            candidateFindings.push(
              makeFinding(
                classification === "ambiguousMapping"
                  ? "legacy-mapping-ambiguous"
                  : "legacy-mapping-invalid",
                classification,
                subject,
                mapping.conflict.path,
              ),
            );
          }
        }
      }
    }

    for (const [key, records] of actualTargets) {
      const [collection, document] = key.split("/");
      if (!targetDefinition(collection, document)) {
        candidateFindings.push(makeFinding("target-unexpected", "targetConflict", subject));
      }
      if (records.length > 1) {
        candidateFindings.push(makeFinding("target-duplicate", "targetConflict", subject));
      }
      for (const record of records) {
        if (!snapshotReceipt(record).valid) {
          candidateFindings.push(makeFinding("target-snapshot-invalid", "targetConflict", subject));
        }
      }
    }
    if (actualAudits.length > 0) {
      candidateFindings.push(makeFinding("audit-present", "targetConflict", subject));
      if (actualAudits.some((record) => !snapshotReceipt(record).valid)) {
        candidateFindings.push(makeFinding("audit-snapshot-invalid", "targetConflict", subject));
      }
    }
    if (actualUnexpected.length > 0) {
      candidateFindings.push(makeFinding("unexpected-document-present", "targetConflict", subject));
      if (actualUnexpected.some((record) => !snapshotReceipt(record).valid)) {
        candidateFindings.push(makeFinding("unexpected-snapshot-invalid", "targetConflict", subject));
      }
    }

    const knownTargetCount = COMPANY_SETTINGS_TARGETS.filter((definition) =>
      actualTargets.has(`${definition.collection}/${definition.document}`),
    ).length;
    if (knownTargetCount > 0 && knownTargetCount < COMPANY_SETTINGS_TARGETS.length) {
      candidateFindings.push(makeFinding("target-partial", "targetConflict", subject));
    }
    if (mapping?.ok && knownTargetCount === COMPANY_SETTINGS_TARGETS.length) {
      const exact = COMPANY_SETTINGS_TARGETS.every((definition) => {
        const records = actualTargets.get(`${definition.collection}/${definition.document}`) ?? [];
        if (records.length !== 1 || !snapshotReceipt(records[0]).valid) return false;
        const expected = encodeJsAsFirestoreValue(mapping.value[definition.valueKey]);
        return stableJson(canonicalizeFirestoreValue(records[0].value)) ===
          stableJson(canonicalizeFirestoreValue(expected));
      });
      if (!exact) {
        candidateFindings.push(makeFinding("target-parity-mismatch", "targetConflict", subject));
      }
    }

    const deduplicatedFindings = [...new Map(
      candidateFindings.map((finding) => [`${finding.code}:${finding.detail ?? ""}`, finding]),
    ).values()];
    const classification = [
      "editionUnverified", "rootMissingOrOrphan", "targetConflict",
      "unknownFieldReview", "invalidSource", "ambiguousMapping",
    ].find((candidate) => deduplicatedFindings.some((finding) => finding.classification === candidate)) ??
      (mapping?.ok && knownTargetCount === COMPANY_SETTINGS_TARGETS.length
        ? "alreadyEquivalent"
        : mapping?.ok && knownTargetCount === 0
          ? "eligibleCreate"
          : "invalidSource");

    if (classification === "invalidSource" && deduplicatedFindings.length === 0) {
      deduplicatedFindings.push(makeFinding("mapping-unavailable", "invalidSource", subject));
    }

    const expectedWrites = mapping?.ok
      ? COMPANY_SETTINGS_TARGETS.map((definition) => Object.freeze({
          kind: "create",
          path: `${companyPath}/${definition.collection}/${definition.document}`,
          data: mapping.value[definition.valueKey],
          value: encodeJsAsFirestoreValue(mapping.value[definition.valueKey]),
        }))
      : [];
    const candidate = Object.freeze({
      subject,
      companyPath,
      classification,
      sourceUpdateTime: rootReceipt?.updateTime ?? null,
      sourceFingerprint: rootReceipt?.fingerprint ?? null,
      currentRoots: Object.freeze(sortedSnapshotReceipts(rootRecords)),
      currentTargets: Object.freeze(sortedSnapshotReceipts([...actualTargets.values()].flat())),
      currentAudits: Object.freeze(sortedSnapshotReceipts(actualAudits)),
      unexpectedDocuments: Object.freeze(sortedSnapshotReceipts(actualUnexpected)),
      findings: Object.freeze(deduplicatedFindings),
      expectedWrites: Object.freeze(expectedWrites),
    });
    candidatePlans.push(candidate);
    findings.push(...deduplicatedFindings);
  }

  const blocked = findings.some(({ blocking }) => blocking);
  const operations = blocked
    ? []
    : candidatePlans
        .filter(({ classification }) => classification === "eligibleCreate")
        .map((candidate) => Object.freeze({
          subject: candidate.subject,
          companyPath: candidate.companyPath,
          sourceUpdateTime: candidate.sourceUpdateTime,
          sourceFingerprint: candidate.sourceFingerprint,
          writes: candidate.expectedWrites,
        }));

  const digestPayload = {
    domain: COMPANY_SETTINGS_PLAN_DOMAIN,
    projectId,
    databaseId,
    databaseType,
    edition,
    editionReceiptDigest,
    fixedCommit,
    schemaPackageVersion,
    schemaContractVersion,
    targetManifestDigest,
    rulesReceiptDigest,
    editionVerifiedType: typeof editionVerified,
    editionVerifiedValue: editionVerified,
    findings: findings
      .map(({ code, classification, subject, detail }) => ({ code, classification, subject, detail }))
      .sort((a, b) => compareUtf8(
        `${a.classification}:${a.code}:${a.subject}`,
        `${b.classification}:${b.code}:${b.subject}`,
      )),
    candidates: candidatePlans.map((candidate) => ({
      subject: candidate.subject,
      classification: candidate.classification,
      sourceUpdateTime: candidate.sourceUpdateTime,
      sourceFingerprint: candidate.sourceFingerprint,
      currentRoots: candidate.currentRoots,
      currentTargets: candidate.currentTargets,
      currentAudits: candidate.currentAudits,
      unexpectedDocuments: candidate.unexpectedDocuments,
      writes: candidate.expectedWrites.map(({ path, value }) => ({
        pathSubject: opaqueSubject(path),
        value: canonicalizeFirestoreValue(value),
      })),
    })),
  };
  const planDigest = sha256(`${COMPANY_SETTINGS_PLAN_DOMAIN}\0${stableJson(digestPayload)}`);
  const exitCode = blocked
    ? COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER
    : operations.length > 0
      ? COMPANY_SETTINGS_EXIT_CODES.CHANGES
      : COMPANY_SETTINGS_EXIT_CODES.CLEAN;

  return Object.freeze({
    projectId,
    databaseId,
    databaseType,
    edition,
    editionReceiptDigest,
    fixedCommit,
    schemaPackageVersion,
    schemaContractVersion,
    targetManifestDigest,
    rulesReceiptDigest,
    planDigest,
    exitCode,
    findings: Object.freeze(findings),
    candidates: Object.freeze(candidatePlans),
    operations: Object.freeze(operations),
  });
}

export function summarizeCompanySettingsPlan(plan) {
  const counts = Object.fromEntries(
    [
      "editionUnverified", "rootMissingOrOrphan", "targetConflict",
      "unknownFieldReview", "invalidSource", "ambiguousMapping",
      "alreadyEquivalent", "eligibleCreate",
    ].map((classification) => [
      classification,
      plan.candidates.filter((candidate) => candidate.classification === classification).length,
    ]),
  );
  const findingCounts = Object.fromEntries(
    [...new Set(plan.findings.map(({ code }) => code))]
      .sort()
      .map((code) => [code, plan.findings.filter((finding) => finding.code === code).length]),
  );
  return Object.freeze({
    status:
      plan.exitCode === COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER
        ? "blocked"
        : plan.exitCode === COMPANY_SETTINGS_EXIT_CODES.CHANGES
          ? "changes"
          : "clean",
    exitCode: plan.exitCode,
    planDigest: plan.planDigest,
    counts: Object.freeze(counts),
    findingCounts: Object.freeze(findingCounts),
    createDocumentCount: plan.operations.reduce((total, operation) => total + operation.writes.length, 0),
  });
}

function companySettingsError(message, exitCode) {
  const error = new Error(message);
  error.exitCode = exitCode;
  return error;
}

function targetRejected(message) {
  return companySettingsError(message, COMPANY_SETTINGS_EXIT_CODES.TARGET_REJECTED);
}

function assertExactCodexTargetDefinition(target) {
  if (stableJson(target) !== stableJson(CODEX_COMPANY_SETTINGS_MIGRATION_TARGET)) {
    throw targetRejected("Company settings migration is limited to the exact Codex-local target.");
  }
  return target;
}

export function assertCompanySettingsMigrationTarget(
  targetName,
  env = process.env,
) {
  if (targetName !== CODEX_COMPANY_SETTINGS_MIGRATION_TARGET.name) {
    throw targetRejected("Company settings migration target is invalid.");
  }
  const target = CODEX_COMPANY_SETTINGS_MIGRATION_TARGET;
  for (const name of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
    if (env[name] && env[name] !== target.projectId) {
      throw targetRejected("Company settings migration rejected a different project.");
    }
  }
  if (!env.GCLOUD_PROJECT && !env.GOOGLE_CLOUD_PROJECT) {
    throw targetRejected("Company settings migration requires an explicit project.");
  }
  if (env.FIRESTORE_EMULATOR_HOST !== target.firestoreHost) {
    throw targetRejected("Company settings migration requires the exact Codex Firestore Emulator.");
  }
  if (env.AIR_GUARD_EXTERNAL_EFFECTS !== "deny") {
    throw targetRejected("Company settings migration requires external effects to be denied.");
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw targetRejected("Codex-local company settings migration rejects credentials.");
  }
  if (env.FIREBASE_CONFIG) {
    let config;
    try {
      config = JSON.parse(env.FIREBASE_CONFIG);
    } catch {
      throw targetRejected("FIREBASE_CONFIG is invalid.");
    }
    if (config?.projectId && config.projectId !== target.projectId) {
      throw targetRejected("Company settings migration rejected a different Firebase config.");
    }
  }
  return target;
}

export function createCodexCompanySettingsEditionReceiptDigest(
  target = CODEX_COMPANY_SETTINGS_MIGRATION_TARGET,
) {
  assertExactCodexTargetDefinition(target);
  return sha256(`${EDITION_RECEIPT_DOMAIN}\0${stableJson({
    projectId: target.projectId,
    databaseId: target.databaseId,
    databaseType: target.databaseType,
    edition: target.edition,
    firestoreHost: target.firestoreHost,
  })}`);
}

export function createCodexCompanySettingsRulesReceiptDigest(rulesText) {
  if (typeof rulesText !== "string" || rulesText.length === 0) {
    throw new TypeError("rulesText must be non-empty");
  }
  return sha256(`${RULES_RECEIPT_DOMAIN}\0${rulesText}`);
}

export function parseCompanySettingsTimestamp(value) {
  const [seconds, nanoseconds] = canonicalTimestamp(value);
  const numericSeconds = Number(seconds);
  const numericNanoseconds = Number(nanoseconds);
  if (!Number.isSafeInteger(numericSeconds)) {
    throw new TypeError("timestamp seconds must be a safe integer");
  }
  return Object.freeze({ seconds: numericSeconds, nanoseconds: numericNanoseconds });
}

export function createCodexCompanySettingsPlanInput({
  manifest,
  actorUid,
  timestamp,
  fixedCommit,
  rulesText,
  target = CODEX_COMPANY_SETTINGS_MIGRATION_TARGET,
} = {}) {
  assertExactCodexTargetDefinition(target);
  if (
    typeof actorUid !== "string" ||
    actorUid.length < 1 ||
    actorUid.length > 128 ||
    actorUid.trim() !== actorUid ||
    actorUid.includes("@")
  ) {
    throw new TypeError("actorUid must be a 1-128 character non-email opaque ID");
  }
  if (typeof fixedCommit !== "string" || !/^[0-9a-f]{40}$/u.test(fixedCommit)) {
    throw new TypeError("fixedCommit must be a full Git commit");
  }
  timestampLikeToRfc3339(timestamp);
  return Object.freeze({
    editionVerified: true,
    projectId: target.projectId,
    databaseId: target.databaseId,
    databaseType: target.databaseType,
    edition: target.edition,
    editionReceiptDigest: createCodexCompanySettingsEditionReceiptDigest(target),
    actorUid,
    timestamp,
    fixedCommit,
    schemaPackageVersion: "2.4.2-dev.167",
    schemaContractVersion: 1,
    targetManifestDigest: createCompanySettingsManifestDigest(manifest),
    rulesReceiptDigest: createCodexCompanySettingsRulesReceiptDigest(rulesText),
    manifest: Object.freeze([...manifest]),
  });
}

function firestoreDocumentsBase(target) {
  return `http://${target.firestoreHost}/v1/projects/${encodeURIComponent(target.projectId)}` +
    `/databases/${encodeURIComponent(target.databaseId)}/documents`;
}

async function requestFirestoreJson(fetchImpl, url, { method = "GET", body } = {}) {
  const expectedOrigin = `http://${CODEX_COMPANY_SETTINGS_MIGRATION_TARGET.firestoreHost}`;
  const requestUrl = new URL(url);
  if (requestUrl.origin !== expectedOrigin) {
    throw targetRejected("Firestore Emulator REST request escaped the exact loopback origin.");
  }
  const response = await fetchImpl(url, {
    method,
    redirect: "error",
    headers: {
      authorization: "Bearer owner",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let responseOrigin;
  try {
    responseOrigin = new URL(response?.url).origin;
  } catch {
    throw targetRejected("Firestore Emulator REST response origin could not be verified.");
  }
  if (responseOrigin !== expectedOrigin) {
    throw targetRejected("Firestore Emulator REST response escaped the exact loopback origin.");
  }
  if (!response?.ok) {
    const error = new Error(`Firestore Emulator REST request failed with status ${response?.status ?? "unknown"}.`);
    error.httpResponseReceived = true;
    error.httpStatus = response?.status ?? null;
    throw error;
  }
  const text = await response.text();
  return text.length === 0 ? null : JSON.parse(text);
}

function restDocumentToRecord(document, target) {
  if (!isPlainObject(document) || typeof document.name !== "string") {
    throw new TypeError("Firestore REST document is invalid");
  }
  const prefix = `projects/${target.projectId}/databases/${target.databaseId}/documents/`;
  if (!document.name.startsWith(prefix)) {
    throw targetRejected("Firestore REST document escaped the Codex-local database.");
  }
  return Object.freeze({
    path: document.name.slice(prefix.length),
    value: { mapValue: { fields: document.fields ?? {} } },
    updateTime: document.updateTime,
  });
}

async function listRootDocuments(target, fetchImpl) {
  const records = [];
  let pageToken = null;
  do {
    const query = new URLSearchParams({ pageSize: "1000" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await requestFirestoreJson(
      fetchImpl,
      `${firestoreDocumentsBase(target)}/Companies?${query}`,
    );
    for (const document of response?.documents ?? []) {
      records.push(restDocumentToRecord(document, target));
    }
    pageToken = response?.nextPageToken ?? null;
  } while (pageToken);
  return records;
}

function documentsFromRunQuery(response, target) {
  if (!Array.isArray(response)) throw new TypeError("Firestore runQuery response must be an array");
  return response
    .filter((entry) => entry?.document)
    .map((entry) => restDocumentToRecord(entry.document, target));
}

async function runCollectionGroupQuery(target, collectionId, fetchImpl) {
  const response = await requestFirestoreJson(
    fetchImpl,
    `${firestoreDocumentsBase(target)}:runQuery`,
    {
      method: "POST",
      body: {
        structuredQuery: {
          from: [{ collectionId, allDescendants: true }],
        },
      },
    },
  );
  return documentsFromRunQuery(response, target);
}

export async function readCompanySettingsMigrationState({
  target = CODEX_COMPANY_SETTINGS_MIGRATION_TARGET,
  fetchImpl = globalThis.fetch,
} = {}) {
  assertExactCodexTargetDefinition(target);
  const [roots, settings, privateSettings, audits] = await Promise.all([
    listRootDocuments(target, fetchImpl),
    runCollectionGroupQuery(target, "Settings", fetchImpl),
    runCollectionGroupQuery(target, "PrivateSettings", fetchImpl),
    runCollectionGroupQuery(target, "SettingAudits", fetchImpl),
  ]);
  return Object.freeze({
    roots: Object.freeze(roots),
    targets: Object.freeze([...settings, ...privateSettings]),
    audits: Object.freeze(audits),
    unexpectedDocuments: Object.freeze([]),
  });
}

export async function readCompanySettingsMigrationPlan({
  target = CODEX_COMPANY_SETTINGS_MIGRATION_TARGET,
  planInput,
  fetchImpl = globalThis.fetch,
} = {}) {
  const state = await readCompanySettingsMigrationState({ target, fetchImpl });
  return planCompanySettingsMigration({ ...planInput, ...state });
}

async function beginFirestoreTransaction(target, fetchImpl) {
  const response = await requestFirestoreJson(
    fetchImpl,
    `${firestoreDocumentsBase(target)}:beginTransaction`,
    { method: "POST", body: { options: { readWrite: {} } } },
  );
  if (typeof response?.transaction !== "string" || response.transaction.length === 0) {
    throw new TypeError("Firestore Emulator did not return a transaction");
  }
  return response.transaction;
}

async function rollbackFirestoreTransaction(target, transaction, fetchImpl) {
  await requestFirestoreJson(
    fetchImpl,
    `${firestoreDocumentsBase(target)}:rollback`,
    { method: "POST", body: { transaction } },
  );
}

function companyDocumentParentUrl(target, companyPath) {
  const match = ROOT_PATH.exec(companyPath);
  if (!match) throw new TypeError("companyPath must identify a Company root");
  return `${firestoreDocumentsBase(target)}/Companies/${encodeURIComponent(match[1])}`;
}

async function readTransactionQuery(
  target,
  companyPath,
  collectionId,
  transaction,
  fetchImpl,
) {
  const response = await requestFirestoreJson(
    fetchImpl,
    `${companyDocumentParentUrl(target, companyPath)}:runQuery`,
    {
      method: "POST",
      body: {
        transaction,
        structuredQuery: { from: [{ collectionId }] },
      },
    },
  );
  return documentsFromRunQuery(response, target);
}

async function readTenantTransactionState(
  target,
  companyPath,
  transaction,
  fetchImpl,
) {
  const rootName = `projects/${target.projectId}/databases/${target.databaseId}/documents/${companyPath}`;
  const rootResponse = await requestFirestoreJson(
    fetchImpl,
    `${firestoreDocumentsBase(target)}:batchGet`,
    { method: "POST", body: { documents: [rootName], transaction } },
  );
  if (!Array.isArray(rootResponse)) {
    throw new TypeError("Firestore batchGet response must be an array");
  }
  const roots = rootResponse
    .filter((entry) => entry?.found)
    .map((entry) => restDocumentToRecord(entry.found, target));
  const [settings, privateSettings, audits] = await Promise.all([
    readTransactionQuery(target, companyPath, "Settings", transaction, fetchImpl),
    readTransactionQuery(target, companyPath, "PrivateSettings", transaction, fetchImpl),
    readTransactionQuery(target, companyPath, "SettingAudits", transaction, fetchImpl),
  ]);
  return {
    roots,
    targets: [...settings, ...privateSettings],
    audits,
    unexpectedDocuments: [],
  };
}

function operationInvariant(operation) {
  return stableJson({
    companyPath: operation.companyPath,
    sourceUpdateTime: operation.sourceUpdateTime,
    sourceFingerprint: operation.sourceFingerprint,
    writes: operation.writes.map(({ kind, path, value }) => ({
      kind,
      path,
      value: canonicalizeFirestoreValue(value),
    })),
  });
}

function createRestWrite(target, write) {
  if (write.kind !== "create" || !TARGET_PATH.test(write.path)) {
    throw companySettingsError(
      "Company settings migration rejected a non-create target write.",
      COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
    );
  }
  if (write.value?.mapValue?.fields === undefined) {
    throw new TypeError("Company settings migration write must be a map value");
  }
  return {
    update: {
      name: `projects/${target.projectId}/databases/${target.databaseId}/documents/${write.path}`,
      fields: write.value.mapValue.fields,
    },
    currentDocument: { exists: false },
  };
}

async function commitTenantOperation({
  target,
  planInput,
  operation,
  fetchImpl,
}) {
  const transaction = await beginFirestoreTransaction(target, fetchImpl);
  let commitRequestSent = false;
  try {
    const state = await readTenantTransactionState(
      target,
      operation.companyPath,
      transaction,
      fetchImpl,
    );
    const tenantInput = {
      ...planInput,
      manifest: [operation.companyPath],
      targetManifestDigest: createCompanySettingsManifestDigest([operation.companyPath]),
    };
    const transactionPlan = planCompanySettingsMigration({ ...tenantInput, ...state });
    if (
      transactionPlan.exitCode !== COMPANY_SETTINGS_EXIT_CODES.CHANGES ||
      transactionPlan.findings.length !== 0 ||
      transactionPlan.operations.length !== 1 ||
      operationInvariant(transactionPlan.operations[0]) !== operationInvariant(operation)
    ) {
      throw companySettingsError(
        "Company settings migration state changed before create.",
        COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
      );
    }
    commitRequestSent = true;
    const response = await requestFirestoreJson(
      fetchImpl,
      `${firestoreDocumentsBase(target)}:commit`,
      {
        method: "POST",
        body: {
          transaction,
          writes: operation.writes.map((write) => createRestWrite(target, write)),
        },
      },
    );
    if (!Array.isArray(response?.writeResults) || response.writeResults.length !== COMPANY_SETTINGS_TARGETS.length) {
      throw companySettingsError(
        "Company settings migration commit result was incomplete.",
        COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
      );
    }
    commitRequestSent = false;
    return response.writeResults.length;
  } catch (error) {
    const commitRejected = commitRequestSent && error?.httpResponseReceived === true;
    if (!commitRequestSent || commitRejected) {
      try {
        await rollbackFirestoreTransaction(target, transaction, fetchImpl);
      } catch {
        // The original failure remains authoritative; rollback never deletes a committed create.
      }
    }
    const failure = error?.exitCode
      ? error
      : companySettingsError(
          "Company settings migration transaction failed.",
          COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
        );
    failure.commitOutcomeMayBeUnknown = commitRequestSent && !commitRejected;
    throw failure;
  }
}

export function assertCompanySettingsPostCheck({
  beforePlan,
  afterPlan,
  appliedTenantCount,
  createdDocumentCount,
}) {
  const beforeByPath = new Map(
    beforePlan.candidates.map((candidate) => [candidate.companyPath, candidate]),
  );
  const complete =
    afterPlan.exitCode === COMPANY_SETTINGS_EXIT_CODES.CLEAN &&
    afterPlan.findings.length === 0 &&
    afterPlan.operations.length === 0 &&
    afterPlan.candidates.length === beforePlan.candidates.length &&
    afterPlan.candidates.every((candidate) => {
      const before = beforeByPath.get(candidate.companyPath);
      return Boolean(
        before &&
        candidate.classification === "alreadyEquivalent" &&
        candidate.sourceUpdateTime === before.sourceUpdateTime &&
        candidate.sourceFingerprint === before.sourceFingerprint &&
        candidate.currentAudits.length === 0 &&
        candidate.unexpectedDocuments.length === 0,
      );
    }) &&
    Number.isInteger(appliedTenantCount) &&
    createdDocumentCount === appliedTenantCount * COMPANY_SETTINGS_TARGETS.length;
  if (!complete) {
    throw companySettingsError(
      "Company settings migration post-check failed.",
      COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
    );
  }
  return Object.freeze({
    status: "clean",
    appliedTenantCount,
    createdDocumentCount,
    updatedDocumentCount: 0,
    deletedDocumentCount: 0,
    rootWriteCount: 0,
    auditWriteCount: 0,
  });
}

export async function applyCompanySettingsMigrationPlan({
  target = CODEX_COMPANY_SETTINGS_MIGRATION_TARGET,
  planInput,
  plan,
  approvedPlanDigest,
  fetchImpl = globalThis.fetch,
} = {}) {
  assertExactCodexTargetDefinition(target);
  if (plan.findings.length > 0 || plan.exitCode === COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER) {
    throw companySettingsError(
      "Company settings migration has blocking findings.",
      COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER,
    );
  }
  if (plan.planDigest !== approvedPlanDigest) {
    throw companySettingsError(
      "Company settings migration plan changed.",
      COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
    );
  }
  let appliedTenantCount = 0;
  let createdDocumentCount = 0;
  try {
    for (const operation of plan.operations) {
      createdDocumentCount += await commitTenantOperation({
        target,
        planInput,
        operation,
        fetchImpl,
      });
      appliedTenantCount += 1;
    }
  } catch (error) {
    error.appliedTenantCount = appliedTenantCount;
    error.createdDocumentCount = createdDocumentCount;
    error.commitOutcomeMayBeUnknown = error.commitOutcomeMayBeUnknown === true;
    try {
      const recoveryPlan = await readCompanySettingsMigrationPlan({
        target,
        planInput,
        fetchImpl,
      });
      error.recoveryPlanSummary = summarizeCompanySettingsPlan(recoveryPlan);
      const beforeByPath = new Map(
        plan.candidates.map((candidate) => [candidate.companyPath, candidate.classification]),
      );
      error.observedCreatedTenantCount = recoveryPlan.candidates.filter((candidate) =>
        beforeByPath.get(candidate.companyPath) === "eligibleCreate" &&
        candidate.classification === "alreadyEquivalent",
      ).length;
      error.observedCreatedDocumentCount =
        error.observedCreatedTenantCount * COMPANY_SETTINGS_TARGETS.length;
    } catch {
      error.recoveryPlanSummary = null;
      error.observedCreatedTenantCount = null;
      error.observedCreatedDocumentCount = null;
    }
    error.stateVerificationRequired = error.recoveryPlanSummary === null;
    throw error;
  }
  const afterPlan = await readCompanySettingsMigrationPlan({
    target,
    planInput,
    fetchImpl,
  });
  const postCheck = assertCompanySettingsPostCheck({
    beforePlan: plan,
    afterPlan,
    appliedTenantCount,
    createdDocumentCount,
  });
  return Object.freeze({ afterPlan, postCheck });
}

export function parseCompanySettingsMigrationArgs(args) {
  const parsed = {
    target: null,
    manifestFile: null,
    actorUid: null,
    timestamp: null,
    fixedCommit: null,
    apply: false,
    planDigest: null,
  };
  const valueArguments = new Map([
    ["--target", "target"],
    ["--manifest-file", "manifestFile"],
    ["--actor-uid", "actorUid"],
    ["--timestamp", "timestamp"],
    ["--fixed-commit", "fixedCommit"],
    ["--plan-digest", "planDigest"],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      if (parsed.apply) throw companySettingsError("Duplicate --apply.", COMPANY_SETTINGS_EXIT_CODES.USAGE);
      parsed.apply = true;
      continue;
    }
    const key = valueArguments.get(argument);
    if (!key || parsed[key] !== null || index + 1 >= args.length || args[index + 1].startsWith("--")) {
      throw companySettingsError("Invalid company settings migration arguments.", COMPANY_SETTINGS_EXIT_CODES.USAGE);
    }
    parsed[key] = args[++index];
  }
  if (
    parsed.target !== CODEX_COMPANY_SETTINGS_MIGRATION_TARGET.name ||
    !parsed.manifestFile ||
    !parsed.actorUid ||
    !parsed.timestamp ||
    !/^[0-9a-f]{40}$/u.test(parsed.fixedCommit ?? "")
  ) {
    throw companySettingsError(
      "Codex-local target, manifest, actor, timestamp, and full fixed commit are required.",
      COMPANY_SETTINGS_EXIT_CODES.USAGE,
    );
  }
  try {
    parseCompanySettingsTimestamp(parsed.timestamp);
  } catch {
    throw companySettingsError("--timestamp must be UTC RFC 3339.", COMPANY_SETTINGS_EXIT_CODES.USAGE);
  }
  if (parsed.apply && !/^[0-9a-f]{64}$/u.test(parsed.planDigest ?? "")) {
    throw companySettingsError(
      "--apply requires a dry-run --plan-digest.",
      COMPANY_SETTINGS_EXIT_CODES.USAGE,
    );
  }
  if (!parsed.apply && parsed.planDigest !== null) {
    throw companySettingsError(
      "--plan-digest is only valid with --apply.",
      COMPANY_SETTINGS_EXIT_CODES.USAGE,
    );
  }
  return Object.freeze(parsed);
}

export async function runCompanySettingsMigrationCli(
  args,
  {
    env = process.env,
    fetchImpl = globalThis.fetch,
    readText = (path) => readFileSync(path, "utf8"),
  } = {},
) {
  const parsed = parseCompanySettingsMigrationArgs(args);
  const target = assertCompanySettingsMigrationTarget(parsed.target, env);
  let manifest;
  try {
    manifest = JSON.parse(readText(parsed.manifestFile));
  } catch {
    throw companySettingsError("Manifest file is invalid.", COMPANY_SETTINGS_EXIT_CODES.USAGE);
  }
  const rulesText = readText(new URL("../firestore.rules", import.meta.url));
  const planInput = createCodexCompanySettingsPlanInput({
    manifest,
    actorUid: parsed.actorUid,
    timestamp: parseCompanySettingsTimestamp(parsed.timestamp),
    fixedCommit: parsed.fixedCommit,
    rulesText,
    target,
  });
  const plan = await readCompanySettingsMigrationPlan({ target, planInput, fetchImpl });
  const summary = Object.freeze({
    ...summarizeCompanySettingsPlan(plan),
    mode: parsed.apply ? "apply" : "dry-run",
    target: target.name,
    receiptKind: "codex-local-emulator-rules-file",
  });
  if (!parsed.apply) return Object.freeze({ exitCode: plan.exitCode, summary });
  if (plan.exitCode === COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER) {
    return Object.freeze({
      exitCode: COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER,
      summary: Object.freeze({
        ...summary,
        status: "blocked",
        exitCode: COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER,
      }),
    });
  }
  if (plan.planDigest !== parsed.planDigest) {
    return Object.freeze({
      exitCode: COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
      summary: Object.freeze({
        ...summary,
        status: "plan-changed",
        exitCode: COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
      }),
    });
  }
  const result = await applyCompanySettingsMigrationPlan({
    target,
    planInput,
    plan,
    approvedPlanDigest: parsed.planDigest,
    fetchImpl,
  });
  return Object.freeze({
    exitCode: COMPANY_SETTINGS_EXIT_CODES.CLEAN,
    summary: Object.freeze({
      ...summary,
      status: "applied",
      exitCode: COMPANY_SETTINGS_EXIT_CODES.CLEAN,
      postCheck: result.postCheck,
    }),
  });
}

export function summarizeCompanySettingsMigrationError(error) {
  const exitCode = error?.exitCode ?? COMPANY_SETTINGS_EXIT_CODES.UNEXPECTED;
  return Object.freeze({
    status: "error",
    exitCode,
    ...(Number.isInteger(error?.appliedTenantCount)
      ? {
          acknowledgedAppliedTenantCount: error.appliedTenantCount,
          acknowledgedCreatedDocumentCount: error.createdDocumentCount,
          commitOutcomeMayBeUnknown: error.commitOutcomeMayBeUnknown === true,
          observedCreatedTenantCount: error.observedCreatedTenantCount ?? null,
          observedCreatedDocumentCount: error.observedCreatedDocumentCount ?? null,
          recoveryPlan: error.recoveryPlanSummary ?? null,
          stateVerificationRequired: error.stateVerificationRequired === true,
          resumeRequired: true,
        }
      : {}),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCompanySettingsMigrationCli(process.argv.slice(2))
    .then(({ exitCode, summary }) => {
      process.stdout.write(`${JSON.stringify(summary)}\n`);
      process.exitCode = exitCode;
    })
    .catch((error) => {
      const summary = summarizeCompanySettingsMigrationError(error);
      process.stderr.write(`${JSON.stringify(summary)}\n`);
      process.exitCode = summary.exitCode;
    });
}
