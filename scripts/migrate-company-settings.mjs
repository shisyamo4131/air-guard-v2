import { createHash } from "node:crypto";
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

const BLOCKING_CLASSIFICATIONS = new Set([
  "editionUnverified",
  "rootMissingOrOrphan",
  "targetConflict",
  "unknownFieldReview",
  "invalidSource",
  "ambiguousMapping",
]);

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
    `airguard:ccb-v1:target-manifest:v1\0${stableJson([...manifest].sort())}`,
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))
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
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/u.exec(value);
  if (!match) throw new TypeError("timestampValue must be UTC RFC 3339");
  const milliseconds = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(milliseconds)) throw new TypeError("timestampValue is invalid");
  const seconds = Math.trunc(milliseconds / 1000);
  const nanos = (match[2] ?? "").padEnd(9, "0");
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
      const integer = typeof body === "bigint" ? body : BigInt(body);
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
      return ["bytes", Buffer.from(body, "base64").toString("base64")];
    case "referenceValue":
      if (typeof body !== "string") throw new TypeError(`${path}.referenceValue must be string`);
      return ["reference", body];
    case "geoPointValue":
      if (!isPlainObject(body) || !Object.hasOwn(body, "latitude") || !Object.hasOwn(body, "longitude")) {
        throw new TypeError(`${path}.geoPointValue is invalid`);
      }
      return ["geopoint", canonicalDouble(body.latitude), canonicalDouble(body.longitude)];
    case "arrayValue": {
      if (!isPlainObject(body)) throw new TypeError(`${path}.arrayValue must be an object`);
      const values = body.values ?? [];
      if (!Array.isArray(values)) throw new TypeError(`${path}.arrayValue.values must be an array`);
      return ["array", values.map((item, index) => canonicalizeFirestoreValue(item, `${path}[${index}]`))];
    }
    case "mapValue": {
      if (!isPlainObject(body)) throw new TypeError(`${path}.mapValue must be an object`);
      const fields = body.fields ?? {};
      if (!isPlainObject(fields)) throw new TypeError(`${path}.mapValue.fields must be an object`);
      return [
        "map",
        Object.keys(fields)
          .sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))
          .map((key) => [key, canonicalizeFirestoreValue(fields[key], `${path}.${key}`)]),
      ];
    }
    default:
      throw new TypeError(`${path} has an unsupported Firestore type`);
  }
}

function decodeFirestoreValue(value, path = "$") {
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

function makeFinding(classification, subject, detail = null) {
  return Object.freeze({ classification, subject, detail, blocking: true });
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
  actorUid,
  timestamp,
  fixedCommit,
  schemaPackageVersion,
  targetManifestDigest,
  rulesReceiptDigest = null,
  manifest = [],
  roots = [],
  targets = [],
  audits = [],
  unexpectedPaths = [],
} = {}) {
  if (!Array.isArray(manifest) || !Array.isArray(roots) || !Array.isArray(targets) || !Array.isArray(audits) || !Array.isArray(unexpectedPaths)) {
    throw new TypeError("migration snapshot collections must be arrays");
  }
  if (typeof fixedCommit !== "string" || !/^[0-9a-f]{40}$/u.test(fixedCommit)) {
    throw new TypeError("fixedCommit must be a full Git commit");
  }
  if (schemaPackageVersion !== "2.4.2-dev.167") {
    throw new TypeError("schemaPackageVersion must be exact 2.4.2-dev.167");
  }
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
  for (const path of unexpectedPaths) if (!addCandidatePath(candidatePaths, path)) invalidPaths.push(path);

  const manifestSet = new Set(manifest);
  const rootsByPath = new Map();
  const duplicateRoots = new Set();
  for (const record of roots) {
    if (rootsByPath.has(record?.path)) duplicateRoots.add(record?.path);
    rootsByPath.set(record?.path, record);
  }
  const targetsByCompany = new Map();
  const invalidTargetCompanies = new Set();
  for (const record of targets) {
    const match = TARGET_PATH.exec(record?.path ?? "");
    if (!match) continue;
    const companyPath = `Companies/${match[1]}`;
    const key = `${match[2]}/${match[3]}`;
    const bucket = targetsByCompany.get(companyPath) ?? new Map();
    if (bucket.has(key) || !targetDefinition(match[2], match[3])) invalidTargetCompanies.add(companyPath);
    bucket.set(key, record);
    targetsByCompany.set(companyPath, bucket);
  }
  const auditCompanies = new Set(
    audits.map((record) => AUDIT_PATH.exec(record?.path ?? "")).filter(Boolean).map((match) => `Companies/${match[1]}`),
  );
  const unexpectedCompanies = new Set();
  for (const path of unexpectedPaths) {
    const match = TARGET_PATH.exec(path ?? "") ?? AUDIT_PATH.exec(path ?? "");
    if (match) unexpectedCompanies.add(`Companies/${match[1]}`);
    else if (ROOT_PATH.test(path ?? "")) unexpectedCompanies.add(path);
  }

  const candidatePlans = [];
  const findings = invalidPaths.map((path) =>
    makeFinding("rootMissingOrOrphan", opaqueSubject(String(path ?? "invalid")), "invalidPath"),
  );
  if (!editionVerified && candidatePaths.size === 0) {
    findings.push(makeFinding("editionUnverified", opaqueSubject("no-candidate")));
  }

  for (const companyPath of [...candidatePaths].sort()) {
    const subject = opaqueSubject(companyPath);
    const root = rootsByPath.get(companyPath);
    const actualTargets = targetsByCompany.get(companyPath) ?? new Map();
    let classification;
    let mapping = null;

    if (!editionVerified) {
      classification = "editionUnverified";
    } else if (!manifestSet.has(companyPath) || !root || duplicateRoots.has(companyPath)) {
      classification = "rootMissingOrOrphan";
    } else if (!isPlainObject(root.value) || typeof root.updateTime !== "string") {
      classification = "invalidSource";
    } else {
      let sourceData;
      try {
        sourceData = decodeFirestoreValue(root.value);
      } catch {
        sourceData = null;
      }
      if (!isPlainObject(sourceData)) {
        classification = "invalidSource";
      } else if (
        sourceData.schemaVersion !== undefined ||
        sourceData.configurationState !== undefined ||
        sourceData.status !== undefined ||
        invalidTargetCompanies.has(companyPath) ||
        auditCompanies.has(companyPath) ||
        unexpectedCompanies.has(companyPath)
      ) {
        classification = "targetConflict";
      } else {
        const unknownKeys = Object.keys(sourceData).filter((key) => !LEGACY_KEYS.has(key));
        if (unknownKeys.length > 0) {
          classification = "unknownFieldReview";
        } else {
          mapping = mapLegacyCompanyToConfigurationV1(sourceData, { actorUid, timestamp });
          if (!mapping.ok) {
            classification = classifyMappingFailure(mapping.conflict.path);
          } else if (actualTargets.size === 0) {
            classification = "eligibleCreate";
          } else if (actualTargets.size !== COMPANY_SETTINGS_TARGETS.length) {
            classification = "targetConflict";
          } else {
            const exact = COMPANY_SETTINGS_TARGETS.every((definition) => {
              const record = actualTargets.get(`${definition.collection}/${definition.document}`);
              if (!record || !isPlainObject(record.value)) return false;
              const expected = encodeJsAsFirestoreValue(mapping.value[definition.valueKey]);
              return stableJson(canonicalizeFirestoreValue(record.value)) ===
                stableJson(canonicalizeFirestoreValue(expected));
            });
            classification = exact ? "alreadyEquivalent" : "targetConflict";
          }
        }
      }
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
      sourceUpdateTime: root?.updateTime ?? null,
      sourceFingerprint: root?.value ? canonicalFingerprint(root.value) : null,
      expectedWrites: Object.freeze(expectedWrites),
    });
    candidatePlans.push(candidate);
    if (BLOCKING_CLASSIFICATIONS.has(classification)) {
      findings.push(makeFinding(classification, subject));
    }
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
    fixedCommit,
    schemaPackageVersion,
    targetManifestDigest,
    rulesReceiptDigest,
    editionVerified,
    findings: findings
      .map(({ classification, subject, detail }) => ({ classification, subject, detail }))
      .sort((a, b) => `${a.classification}:${a.subject}`.localeCompare(`${b.classification}:${b.subject}`)),
    candidates: candidatePlans.map((candidate) => ({
      subject: candidate.subject,
      classification: candidate.classification,
      sourceUpdateTime: candidate.sourceUpdateTime,
      sourceFingerprint: candidate.sourceFingerprint,
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
    fixedCommit,
    schemaPackageVersion,
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
    createDocumentCount: plan.operations.reduce((total, operation) => total + operation.writes.length, 0),
    subjects: Object.freeze(plan.candidates.map(({ subject, classification }) => ({ subject, classification }))),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.error(
    JSON.stringify({
      status: "not-runnable",
      exitCode: COMPANY_SETTINGS_EXIT_CODES.USAGE,
      message: "This checkpoint provides a pure planner only; no Firestore reader or writer is available.",
    }),
  );
  process.exitCode = COMPANY_SETTINGS_EXIT_CODES.USAGE;
}
