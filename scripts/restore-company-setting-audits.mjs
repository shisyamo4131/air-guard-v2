import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { parseCompanySettingAuditV1 } from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

import {
  canonicalizeFirestoreValue,
  decodeFirestoreValue,
  encodeJsAsFirestoreValue,
} from "./migrate-company-settings.mjs";

export const COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_PACKAGE = "2.4.2-dev.167";
export const COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_CONTRACT = 1;

export const COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES = Object.freeze({
  CLEAN: 0,
  CHANGES: 2,
  BLOCKED: 3,
  USAGE: 64,
});

const PLAN_DOMAIN = "airguard:ccb-v1:setting-audits-restore-plan:v1";
const MANIFEST_DOMAIN = "airguard:ccb-v1:setting-audits-manifest:v1";
const ARTIFACT_DOMAIN = "airguard:ccb-v1:setting-audits-artifact:v1";
const COMPANY_PATH = /^Companies\/([^/]+)$/u;
const AUDIT_PATH = /^Companies\/([^/]+)\/SettingAudits\/([^/]+)$/u;
const EXACT_INPUT_KEYS = [
  "artifactDigest",
  "companyPath",
  "manifest",
  "manifestDigest",
  "schemaContractVersion",
  "schemaPackageVersion",
  "source",
  "sourceAudits",
  "target",
  "targetObservations",
  "targetSnapshotReadTime",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
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

function safeStableJson(value) {
  try {
    return stableJson(value);
  } catch {
    return `unserializable:${typeof value}`;
  }
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function hasExactKeys(value, keys) {
  return isPlainObject(value) &&
    Object.keys(value).sort(compareUtf8).join("\0") === [...keys].sort(compareUtf8).join("\0");
}

function isSafeSegment(value) {
  return typeof value === "string" && value.length > 0 && value !== "." && value !== ".." &&
    !/[\/\u0000]/u.test(value) && Buffer.byteLength(value, "utf8") <= 1_500;
}

function parseAuditPath(path) {
  if (typeof path !== "string") return null;
  const match = AUDIT_PATH.exec(path);
  if (!match || !isSafeSegment(match[1]) || !isSafeSegment(match[2])) return null;
  return Object.freeze({ companyId: match[1], auditId: match[2] });
}

function exactContext(value) {
  return hasExactKeys(value, ["databaseId", "projectId"]) &&
    isSafeSegment(value.projectId) && isSafeSegment(value.databaseId);
}

function rawCanonical(value) {
  return stableJson(canonicalizeFirestoreValue(value));
}

function timestampTuple(value) {
  const canonical = canonicalizeFirestoreValue({ timestampValue: value });
  return [BigInt(canonical[1]), Number(canonical[2])];
}

function timestampAfter(left, right) {
  return left[0] > right[0] || (left[0] === right[0] && left[1] > right[1]);
}

function opaqueSubject(path) {
  return sha256(`airguard:opaque-setting-audit-subject:v1\0${path}`);
}

function finding(code, classification, path = "invalid") {
  return Object.freeze({
    code,
    classification,
    subject: opaqueSubject(String(path)),
    blocking: true,
  });
}

function sourceReceipt(record) {
  let valueFingerprint;
  try {
    valueFingerprint = sha256(rawCanonical(record?.value));
  } catch {
    valueFingerprint = sha256(`invalid\0${safeStableJson(record?.value ?? null)}`);
  }
  return Object.freeze({
    subject: opaqueSubject(String(record?.path ?? "invalid")),
    valueFingerprint,
  });
}

function targetReceipt(observation) {
  const base = {
    subject: opaqueSubject(String(observation?.path ?? "invalid")),
    exists: observation?.exists === true,
    readTime: String(observation?.readTime ?? "invalid"),
  };
  if (observation?.exists !== true) return Object.freeze(base);
  return Object.freeze({
    ...base,
    updateTime: String(observation?.updateTime ?? "invalid"),
    valueFingerprint: sourceReceipt(observation).valueFingerprint,
  });
}

function validManifest(manifest) {
  return Array.isArray(manifest) && manifest.length > 0 &&
    manifest.every((path) => parseAuditPath(path) !== null) &&
    new Set(manifest).size === manifest.length;
}

export function createCompanySettingAuditsManifestDigest(manifest) {
  if (!validManifest(manifest)) {
    throw new TypeError("manifest must contain unique SettingAudits document paths");
  }
  return sha256(`${MANIFEST_DOMAIN}\0${stableJson([...manifest].sort(compareUtf8))}`);
}

export function createCompanySettingAuditsArtifactDigest({
  source,
  companyPath,
  schemaPackageVersion = COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_PACKAGE,
  schemaContractVersion = COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_CONTRACT,
  sourceAudits,
}) {
  if (!exactContext(source) || !COMPANY_PATH.test(companyPath) || !Array.isArray(sourceAudits)) {
    throw new TypeError("artifact identity is invalid");
  }
  const records = sourceAudits.map((record) => {
    if (!hasExactKeys(record, ["path", "value"]) || parseAuditPath(record.path) === null) {
      throw new TypeError("artifact record is invalid");
    }
    return { path: record.path, value: canonicalizeFirestoreValue(record.value) };
  }).sort((left, right) => compareUtf8(left.path, right.path));
  return sha256(`${ARTIFACT_DOMAIN}\0${stableJson({
    companyPath,
    records,
    schemaContractVersion,
    schemaPackageVersion,
    source,
  })}`);
}

function blockedPlan(findings, counts, digestPayload) {
  const planDigest = sha256(`${PLAN_DOMAIN}\0${stableJson(digestPayload)}`);
  return Object.freeze({
    status: "blocked",
    exitCode: COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES.BLOCKED,
    counts: Object.freeze(counts),
    findings: Object.freeze(findings),
    operations: Object.freeze([]),
    planDigest,
  });
}

export function planCompanySettingAuditsRestore(input) {
  const findings = [];
  const sourceAudits = Array.isArray(input?.sourceAudits) ? input.sourceAudits : [];
  const targetObservations = Array.isArray(input?.targetObservations)
    ? input.targetObservations
    : [];
  const manifest = Array.isArray(input?.manifest) ? input.manifest : [];
  const classifications = new Map();
  const setClassification = (path, value) => {
    if (!classifications.has(path)) classifications.set(path, value);
  };

  if (!hasExactKeys(input, EXACT_INPUT_KEYS)) {
    findings.push(finding("INVALID_ENVELOPE", "invalidSource"));
  }
  if (!Array.isArray(input?.sourceAudits)) {
    findings.push(finding("SOURCE_AUDITS_NOT_ARRAY", "invalidSource"));
  }
  if (!Array.isArray(input?.targetObservations)) {
    findings.push(finding("TARGET_OBSERVATIONS_NOT_ARRAY", "targetConflict"));
  }
  const companyMatch = typeof input?.companyPath === "string" ? COMPANY_PATH.exec(input.companyPath) : null;
  if (!companyMatch || !isSafeSegment(companyMatch[1])) {
    findings.push(finding("INVALID_COMPANY_PATH", "scopeMismatch", input?.companyPath));
  }
  if (!exactContext(input?.source) || !exactContext(input?.target)) {
    findings.push(finding("INVALID_CONTEXT", "scopeMismatch"));
  } else if (
    input.source.projectId !== input.target.projectId ||
    input.source.databaseId !== input.target.databaseId
  ) {
    findings.push(finding("CROSS_CONTEXT_RESTORE_FORBIDDEN", "scopeMismatch"));
  }
  if (
    input?.schemaPackageVersion !== COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_PACKAGE ||
    input?.schemaContractVersion !== COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_CONTRACT
  ) {
    findings.push(finding("SCHEMA_MISMATCH", "invalidSource"));
  }
  let targetSnapshotTime = null;
  try {
    targetSnapshotTime = timestampTuple(input?.targetSnapshotReadTime);
  } catch {
    findings.push(finding("INVALID_TARGET_SNAPSHOT_READ_TIME", "targetConflict"));
  }
  if (!validManifest(manifest)) {
    findings.push(finding("INVALID_MANIFEST", "invalidSource"));
  } else {
    if (manifest.some((path) => parseAuditPath(path)?.companyId !== companyMatch?.[1])) {
      findings.push(finding("MANIFEST_SCOPE_MISMATCH", "scopeMismatch"));
    }
    try {
      if (createCompanySettingAuditsManifestDigest(manifest) !== input.manifestDigest) {
        findings.push(finding("MANIFEST_DIGEST_MISMATCH", "invalidSource"));
      }
    } catch {
      findings.push(finding("MANIFEST_DIGEST_INVALID", "invalidSource"));
    }
  }

  const sourceByPath = new Map();
  for (const record of sourceAudits) {
    const path = String(record?.path ?? "invalid");
    const parsed = parseAuditPath(record?.path);
    if (!hasExactKeys(record, ["path", "value"])) {
      findings.push(finding("INVALID_SOURCE_RECORD", "invalidSource", path));
      setClassification(path, "invalidSource");
      continue;
    }
    if (!parsed || parsed.companyId !== companyMatch?.[1] || !manifest.includes(record.path)) {
      findings.push(finding("SOURCE_SCOPE_MISMATCH", "scopeMismatch", path));
      setClassification(path, "scopeMismatch");
      continue;
    }
    if (sourceByPath.has(path)) {
      findings.push(finding("DUPLICATE_SOURCE", "invalidSource", path));
      setClassification(path, "invalidSource");
      continue;
    }
    sourceByPath.set(path, record);
  }
  for (const path of manifest) {
    if (!sourceByPath.has(path)) {
      findings.push(finding("MISSING_SOURCE", "invalidSource", path));
      setClassification(path, "invalidSource");
    }
  }
  if (sourceByPath.size !== manifest.length) {
    findings.push(finding("SOURCE_MANIFEST_MISMATCH", "invalidSource"));
  }

  try {
    const artifactDigest = createCompanySettingAuditsArtifactDigest({
      source: input.source,
      companyPath: input.companyPath,
      schemaPackageVersion: input.schemaPackageVersion,
      schemaContractVersion: input.schemaContractVersion,
      sourceAudits,
    });
    if (artifactDigest !== input.artifactDigest) {
      findings.push(finding("ARTIFACT_DIGEST_MISMATCH", "invalidSource"));
    }
  } catch {
    findings.push(finding("ARTIFACT_DIGEST_INVALID", "invalidSource"));
  }

  const sourceCanonical = new Map();
  for (const [path, record] of sourceByPath) {
    try {
      const decoded = decodeFirestoreValue(record.value);
      const parsed = parseCompanySettingAuditV1(decoded);
      const reencoded = encodeJsAsFirestoreValue(parsed);
      const canonical = rawCanonical(record.value);
      if (canonical !== rawCanonical(reencoded)) {
        throw new TypeError("audit source is not canonical");
      }
      sourceCanonical.set(path, Object.freeze({
        canonical,
        value: deepFreeze(structuredClone(reencoded)),
      }));
    } catch {
      findings.push(finding("INVALID_OR_NONCANONICAL_SOURCE", "invalidSource", path));
      setClassification(path, "invalidSource");
    }
  }

  const targetByPath = new Map();
  for (const observation of targetObservations) {
    const path = String(observation?.path ?? "invalid");
    const parsed = parseAuditPath(observation?.path);
    const absent = hasExactKeys(observation, ["exists", "path", "readTime"]) &&
      observation.exists === false;
    const present = hasExactKeys(
      observation,
      ["exists", "path", "readTime", "updateTime", "value"],
    ) && observation.exists === true;
    if ((!absent && !present) || !parsed) {
      findings.push(finding("INVALID_TARGET_OBSERVATION", "targetConflict", path));
      setClassification(path, "targetConflict");
      continue;
    }
    if (parsed.companyId !== companyMatch?.[1]) {
      findings.push(finding("TARGET_SCOPE_MISMATCH", "scopeMismatch", path));
      setClassification(path, "scopeMismatch");
      continue;
    }
    if (!manifest.includes(path)) continue;
    if (targetByPath.has(path)) {
      findings.push(finding("DUPLICATE_TARGET_OBSERVATION", "targetConflict", path));
      setClassification(path, "targetConflict");
      continue;
    }
    try {
      const observationReadTime = timestampTuple(observation.readTime);
      if (
        targetSnapshotTime === null ||
        observationReadTime[0] !== targetSnapshotTime[0] ||
        observationReadTime[1] !== targetSnapshotTime[1]
      ) {
        throw new TypeError("observation does not belong to the target snapshot");
      }
      if (present) {
        const updateTime = timestampTuple(observation.updateTime);
        if (timestampAfter(updateTime, targetSnapshotTime)) {
          throw new TypeError("target updateTime is after the snapshot readTime");
        }
        rawCanonical(observation.value);
      }
      targetByPath.set(path, observation);
    } catch {
      findings.push(finding("INVALID_TARGET_OBSERVATION_VALUE", "targetConflict", path));
      setClassification(path, "targetConflict");
    }
  }

  for (const path of manifest) {
    if (!targetByPath.has(path)) {
      findings.push(finding("MISSING_TARGET_OBSERVATION", "targetConflict", path));
      setClassification(path, "targetConflict");
    }
  }

  const operations = [];
  for (const path of [...manifest].sort(compareUtf8)) {
    if (classifications.has(path) || !sourceCanonical.has(path)) continue;
    const targetObservation = targetByPath.get(path);
    if (targetObservation.exists === false) {
      setClassification(path, "eligibleCreate");
      operations.push(Object.freeze({
        kind: "create",
        path,
        value: sourceCanonical.get(path).value,
        currentDocument: Object.freeze({ exists: false }),
      }));
      continue;
    }
    if (sourceCanonical.get(path).canonical === rawCanonical(targetObservation.value)) {
      setClassification(path, "alreadyEquivalent");
    } else {
      findings.push(finding("DIVERGENT_TARGET", "targetConflict", path));
      setClassification(path, "targetConflict");
    }
  }

  const counts = {
    manifest: manifest.length,
    source: sourceAudits.length,
    targetObserved: targetObservations.length,
    eligibleCreate: 0,
    alreadyEquivalent: 0,
    invalidSource: 0,
    scopeMismatch: 0,
    targetConflict: 0,
    create: 0,
    update: 0,
    delete: 0,
    clear: 0,
    merge: 0,
  };
  for (const classification of classifications.values()) {
    if (Object.hasOwn(counts, classification)) counts[classification] += 1;
  }

  const digestPayload = {
    artifactDigest: String(input?.artifactDigest ?? "invalid"),
    companySubject: opaqueSubject(String(input?.companyPath ?? "invalid")),
    context: {
      source: exactContext(input?.source) ? input.source : "invalid",
      target: exactContext(input?.target) ? input.target : "invalid",
    },
    findings: findings
      .map(({ code, classification, subject }) => ({ code, classification, subject }))
      .sort((left, right) => compareUtf8(stableJson(left), stableJson(right))),
    manifestDigest: String(input?.manifestDigest ?? "invalid"),
    operations: operations.map(({ path, value }) => ({
      kind: "create",
      subject: opaqueSubject(path),
      valueFingerprint: sha256(rawCanonical(value)),
      precondition: "exists=false",
    })),
    schemaContractVersion: input?.schemaContractVersion,
    schemaPackageVersion: input?.schemaPackageVersion,
    sourceReceipts: sourceAudits
      .map((record) => sourceReceipt(record))
      .sort((left, right) => compareUtf8(stableJson(left), stableJson(right))),
    targetReceipts: targetObservations
      .filter((observation) => typeof observation?.path !== "string" ||
        manifest.includes(observation.path) ||
        parseAuditPath(observation.path)?.companyId !== companyMatch?.[1])
      .map((observation) => targetReceipt(observation))
      .sort((left, right) => compareUtf8(stableJson(left), stableJson(right))),
    targetSnapshotReadTime: String(input?.targetSnapshotReadTime ?? "invalid"),
  };

  if (findings.length > 0) {
    counts.create = 0;
    return blockedPlan(findings, counts, digestPayload);
  }
  counts.create = operations.length;
  const status = operations.length > 0 ? "changes" : "clean";
  return Object.freeze({
    status,
    exitCode: operations.length > 0
      ? COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES.CHANGES
      : COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES.CLEAN,
    counts: Object.freeze(counts),
    findings: Object.freeze([]),
    operations: Object.freeze(operations),
    planDigest: sha256(`${PLAN_DOMAIN}\0${stableJson(digestPayload)}`),
  });
}

export function summarizeCompanySettingAuditsRestorePlan(plan) {
  return Object.freeze({
    status: plan.status,
    exitCode: plan.exitCode,
    counts: plan.counts,
    findingCodes: Object.freeze(plan.findings.map(({ code }) => code).sort(compareUtf8)),
    planDigest: plan.planDigest,
    operationalRestoreAvailable: false,
    applyImplemented: false,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stderr.write(`${JSON.stringify({
    status: "usage",
    exitCode: COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES.USAGE,
    operationalRestoreAvailable: false,
    applyImplemented: false,
  })}\n`);
  process.exitCode = COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES.USAGE;
}
