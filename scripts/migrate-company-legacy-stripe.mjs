import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CODEX_STRIPE_MIGRATION_TARGET = Object.freeze({
  name: "codex-local",
  projectId: "demo-air-guard-v2-codex",
  firestoreHost: "127.0.0.1:18080",
  databaseId: "(default)",
});

export const USER_LOCAL_STRIPE_MIGRATION_TARGET = Object.freeze({
  name: "user-local",
  projectId: "air-guard-v2-dev",
  firestoreHost: "127.0.0.1:8080",
  databaseId: "(default)",
});

export const STRIPE_MIGRATION_TARGETS = Object.freeze({
  [CODEX_STRIPE_MIGRATION_TARGET.name]: CODEX_STRIPE_MIGRATION_TARGET,
  [USER_LOCAL_STRIPE_MIGRATION_TARGET.name]: USER_LOCAL_STRIPE_MIGRATION_TARGET,
});

export const STRIPE_MIGRATION_MAX_WRITES = 400;
export const USER_LOCAL_STABILITY_INTERVAL_MS = 1_000;
const USER_LOCAL_EXPECTED_COUNTS = Object.freeze({
  companyTotal: 1,
  companyFieldDocuments: 1,
  stripeDataDocuments: 0,
});

const SCHEMA_PACKAGE = "@shisyamo4131/air-guard-v2-schemas";
const LEGACY_COMPANY_FIELDS = Object.freeze([
  "stripeCustomerId",
  "subscription",
]);
const SUBSCRIPTION_KEYS = Object.freeze([
  "currentPeriodEnd",
  "employeeLimit",
  "id",
  "status",
]);
const EXIT_CODES = Object.freeze({
  CLEAN: 0,
  CHANGES: 2,
  DATA_BLOCKER: 3,
  APPLY_INCOMPLETE: 4,
  UNEXPECTED: 70,
  TARGET_REJECTED: 78,
  USAGE: 64,
});
const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const COMPANY_PATH = /^Companies\/([^/]+)$/u;
const DIRECT_STRIPE_PATH = /^Companies\/([^/]+)\/StripeData\/([^/]+)$/u;
const VALIDATED_BACKUPS = new WeakSet();

function migrationError(code, exitCode = EXIT_CODES.DATA_BLOCKER) {
  const error = new Error("Company legacy Stripe migration stopped safely.");
  error.code = code;
  error.exitCode = exitCode;
  return error;
}

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function isSafeId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function opaqueSubject(value) {
  return sha256(`airguard-stripe03\0${value}`).slice(0, 16);
}

function tagged(type, value) {
  return { __firestoreType: type, value };
}

/**
 * Firestore snapshot values are converted without calling user-defined toJSON.
 * Unsupported SDK or custom class instances fail closed.
 */
export function canonicalizeFirestoreValue(value, seen = new Set()) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw migrationError("unsupported-number");
    if (Object.is(value, -0)) return tagged("number", "-0");
    return value;
  }
  if (typeof value === "undefined") {
    throw migrationError("unsupported-undefined");
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return tagged("bytes", Buffer.from(value).toString("base64"));
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw migrationError("unsupported-date");
    return tagged("date", value.toISOString());
  }
  if (typeof value !== "object") throw migrationError("unsupported-value");
  if (seen.has(value)) throw migrationError("unsupported-cycle");
  seen.add(value);
  try {
    if (
      Number.isInteger(value.seconds) &&
      Number.isInteger(value.nanoseconds) &&
      typeof value.toMillis === "function"
    ) {
      return tagged("timestamp", [value.seconds, value.nanoseconds]);
    }
    if (
      typeof value.latitude === "number" &&
      Number.isFinite(value.latitude) &&
      typeof value.longitude === "number" &&
      Number.isFinite(value.longitude) &&
      value.constructor?.name === "GeoPoint"
    ) {
      return tagged("geopoint", [value.latitude, value.longitude]);
    }
    if (
      typeof value.path === "string" &&
      value.constructor?.name === "DocumentReference"
    ) {
      return tagged("reference", value.path);
    }
    if (Array.isArray(value)) {
      return value.map((item) => canonicalizeFirestoreValue(item, seen));
    }
    if (isPlainObject(value)) {
      const result = {};
      for (const key of Object.keys(value).sort()) {
        result[key] = canonicalizeFirestoreValue(value[key], seen);
      }
      return result;
    }
    throw migrationError("unsupported-firestore-type");
  } finally {
    seen.delete(value);
  }
}

function decodeFirestoreValue(value, factories = {}) {
  if (Array.isArray(value)) {
    return value.map((item) => decodeFirestoreValue(item, factories));
  }
  if (!isPlainObject(value)) return value;
  if (Object.keys(value).sort().join("\0") === "__firestoreType\0value") {
    switch (value.__firestoreType) {
      case "number":
        return -0;
      case "bytes":
        return Buffer.from(value.value, "base64");
      case "date":
        return new Date(value.value);
      case "timestamp":
        if (typeof factories.timestamp !== "function") {
          throw migrationError("backup-timestamp-factory-missing");
        }
        return factories.timestamp(value.value[0], value.value[1]);
      case "geopoint":
        if (typeof factories.geoPoint !== "function") {
          throw migrationError("backup-geopoint-factory-missing");
        }
        return factories.geoPoint(value.value[0], value.value[1]);
      case "reference":
        if (typeof factories.reference !== "function") {
          throw migrationError("backup-reference-factory-missing");
        }
        return factories.reference(value.value);
      default:
        throw migrationError("backup-type-invalid");
    }
  }
  const result = {};
  for (const key of Object.keys(value)) {
    result[key] = decodeFirestoreValue(value[key], factories);
  }
  return result;
}

function canonicalRecord(record) {
  return {
    path: record.path,
    data: canonicalizeFirestoreValue(record.data),
    updateTime:
      record.updateTime === undefined || record.updateTime === null
        ? null
        : canonicalizeFirestoreValue(record.updateTime),
  };
}

function validateSubscription(value) {
  if (value === null) return true;
  if (!isPlainObject(value)) return false;
  if (
    Object.keys(value).sort().join("\0") !==
    [...SUBSCRIPTION_KEYS].sort().join("\0")
  ) {
    return false;
  }
  for (const key of ["id", "status"]) {
    if (key in value && value[key] !== null && typeof value[key] !== "string") {
      return false;
    }
  }
  if (
    "employeeLimit" in value &&
    (!Number.isFinite(value.employeeLimit) || !Number.isInteger(value.employeeLimit))
  ) {
    return false;
  }
  if ("currentPeriodEnd" in value && value.currentPeriodEnd !== null) {
    try {
      const canonical = canonicalizeFirestoreValue(value.currentPeriodEnd);
      if (canonical?.__firestoreType !== "timestamp") return false;
    } catch {
      return false;
    }
  }
  return true;
}

function validateStripeData(data) {
  if (!isPlainObject(data)) return false;
  const baseKeys = ["cancel_url", "createdAt", "price", "success_url"];
  const keys = Object.keys(data).sort();
  const baseOnly = baseKeys.join("\0");
  const success = [...baseKeys, "customerId", "error", "sessionUrl"]
    .sort()
    .join("\0");
  const failure = [...baseKeys, "error", "sessionUrl"].sort().join("\0");
  const shape = keys.join("\0");
  if (![baseOnly, success, failure].includes(shape)) return false;
  for (const key of ["price", "success_url", "cancel_url"]) {
    if (typeof data[key] !== "string") return false;
  }
  try {
    const canonical = canonicalizeFirestoreValue(data.createdAt);
    if (canonical?.__firestoreType !== "timestamp") return false;
  } catch {
    return false;
  }
  if (shape === success) {
    return (
      data.error === null &&
      typeof data.sessionUrl === "string" &&
      typeof data.customerId === "string"
    );
  }
  if (shape === failure) {
    return (
      isPlainObject(data.error) &&
      Object.keys(data.error).join("") === "message" &&
      typeof data.error.message === "string" &&
      data.sessionUrl === null
    );
  }
  return true;
}

function makeFinding(code, source) {
  return Object.freeze({ code, subject: opaqueSubject(source), blocking: true });
}

function nonTargetCompanyData(data) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (!LEGACY_COMPANY_FIELDS.includes(key)) result[key] = value;
  }
  return result;
}

function targetContentDigestFromCanonical(companies, stripeData) {
  return sha256(
    stableJson({
      companies: [...companies]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(({ path, fields }) => ({ path, fields })),
      stripeData: [...stripeData]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(({ path, data }) => ({ path, data })),
    }),
  );
}

function sortFindings(findings) {
  return findings.sort((left, right) =>
    `${left.code}:${left.subject}`.localeCompare(`${right.code}:${right.subject}`),
  );
}

/** Pure, deterministic planner. Raw values remain internal to the plan only. */
export function planCompanyLegacyStripeMigration({
  target = CODEX_STRIPE_MIGRATION_TARGET,
  companies = [],
  stripeData = [],
  stripeDescendants = [],
  stripeOrphans = [],
} = {}) {
  const findings = [];
  const companyById = new Map();
  const companyRecords = [];
  const stripeRecords = [];
  const seenPaths = new Set();

  const expectedTarget = STRIPE_MIGRATION_TARGETS[target?.name];
  if (
    !expectedTarget ||
    target?.projectId !== expectedTarget.projectId ||
    target?.firestoreHost !== expectedTarget.firestoreHost ||
    target?.databaseId !== expectedTarget.databaseId
  ) {
    findings.push(makeFinding("target-invalid", "target"));
  }

  for (const record of companies) {
    const match = typeof record?.path === "string" ? COMPANY_PATH.exec(record.path) : null;
    if (!match || !isSafeId(match[1]) || !isPlainObject(record.data)) {
      findings.push(makeFinding("company-record-invalid", record?.path ?? "invalid"));
      continue;
    }
    if (seenPaths.has(record.path)) {
      findings.push(makeFinding("record-duplicate", record.path));
      continue;
    }
    seenPaths.add(record.path);
    const companyId = match[1];
    companyById.set(companyId, record);
    try {
      canonicalRecord(record);
      canonicalizeFirestoreValue(nonTargetCompanyData(record.data));
    } catch {
      findings.push(makeFinding("company-firestore-type-invalid", record.path));
      continue;
    }
    if (
      "stripeCustomerId" in record.data &&
      record.data.stripeCustomerId !== null &&
      typeof record.data.stripeCustomerId !== "string"
    ) {
      findings.push(makeFinding("stripe-customer-id-shape-invalid", record.path));
    }
    if ("subscription" in record.data && !validateSubscription(record.data.subscription)) {
      findings.push(makeFinding("subscription-shape-invalid", record.path));
    }
    companyRecords.push(record);
  }

  for (const record of stripeData) {
    const match =
      typeof record?.path === "string" ? DIRECT_STRIPE_PATH.exec(record.path) : null;
    if (!match || !isSafeId(match[1]) || !isSafeId(match[2])) {
      findings.push(makeFinding("stripe-data-path-invalid", record?.path ?? "invalid"));
      continue;
    }
    if (seenPaths.has(record.path)) {
      findings.push(makeFinding("record-duplicate", record.path));
      continue;
    }
    seenPaths.add(record.path);
    if (!companyById.has(match[1])) {
      findings.push(makeFinding("stripe-data-orphan", record.path));
    }
    if (!validateStripeData(record.data)) {
      findings.push(makeFinding("stripe-data-shape-invalid", record.path));
    }
    let canonicalValid = true;
    try {
      canonicalRecord(record);
    } catch {
      findings.push(makeFinding("stripe-data-firestore-type-invalid", record.path));
      canonicalValid = false;
    }
    if (!canonicalValid) continue;
    stripeRecords.push(record);
  }

  const normalizedOrphans = stripeOrphans.map(String).sort();
  for (const path of normalizedOrphans) {
    findings.push(makeFinding("stripe-data-orphan", path));
  }
  const normalizedDescendants = stripeDescendants.map(String).sort();
  for (const path of normalizedDescendants) {
    findings.push(makeFinding("stripe-data-descendant-present", path));
  }

  const sortedCompanies = [...companyRecords].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const sortedStripe = [...stripeRecords].sort((a, b) => a.path.localeCompare(b.path));
  const rootDeletes = [];
  for (const record of sortedCompanies) {
    const fields = LEGACY_COMPANY_FIELDS.filter((field) => field in record.data);
    if (fields.length > 0) {
      rootDeletes.push(
        Object.freeze({ path: record.path, fields: Object.freeze(fields) }),
      );
    }
  }
  const stripeDeletes = sortedStripe.map((record) =>
    Object.freeze({ path: record.path }),
  );
  const sortedFindingList = sortFindings(findings);
  const digestInput = {
    target: {
      name: target?.name ?? null,
      projectId: target?.projectId ?? null,
      firestoreHost: target?.firestoreHost ?? null,
      databaseId: target?.databaseId ?? null,
    },
    companies: sortedCompanies.map(canonicalRecord),
    stripeData: sortedStripe.map(canonicalRecord),
    stripeDescendants: normalizedDescendants,
    stripeOrphans: normalizedOrphans,
    findings: sortedFindingList,
  };
  const planDigest = sha256(stableJson(digestInput));
  const nonTargetDigest = sha256(
    stableJson(
      sortedCompanies.map((record) => ({
        path: record.path,
        data: canonicalizeFirestoreValue(nonTargetCompanyData(record.data)),
      })),
    ),
  );
  const contentDigest = sha256(
    stableJson({
      companies: sortedCompanies.map((record) => ({
        path: record.path,
        data: canonicalizeFirestoreValue(record.data),
      })),
      stripeData: sortedStripe.map((record) => ({
        path: record.path,
        data: canonicalizeFirestoreValue(record.data),
      })),
    }),
  );
  const targetContentDigest = targetContentDigestFromCanonical(
    sortedCompanies.map((record) => ({
      path: record.path,
      fields: Object.fromEntries(
        LEGACY_COMPANY_FIELDS.filter((field) => field in record.data).map(
          (field) => [field, canonicalizeFirestoreValue(record.data[field])],
        ),
      ),
    })),
    sortedStripe.map((record) => ({
      path: record.path,
      data: canonicalizeFirestoreValue(record.data),
    })),
  );

  return Object.freeze({
    target: Object.freeze({ ...target }),
    findings: Object.freeze(sortedFindingList),
    rootDeletes: Object.freeze(rootDeletes),
    stripeDeletes: Object.freeze(stripeDeletes),
    companies: Object.freeze(sortedCompanies),
    stripeData: Object.freeze(sortedStripe),
    companyCount: sortedCompanies.length,
    nonTargetDigest,
    contentDigest,
    targetContentDigest,
    planDigest,
    writeCount: rootDeletes.length + stripeDeletes.length,
  });
}

export function summarizeCompanyLegacyStripePlan(
  plan,
  { mode = "dry-run", receiptHash = null } = {},
) {
  const findingCounts = {};
  for (const finding of plan.findings) {
    findingCounts[finding.code] = (findingCounts[finding.code] ?? 0) + 1;
  }
  const status =
    plan.findings.length > 0
      ? "blocked"
      : plan.writeCount > 0
        ? "changes-required"
        : "clean";
  return {
    mode,
    status,
    target: plan.target.name,
    planDigest: plan.planDigest,
    companyCount: plan.companyCount,
    findingCounts,
    writeCounts: {
      companyFieldDocuments: plan.rootDeletes.length,
      stripeDataDocuments: plan.stripeDeletes.length,
      total: plan.writeCount,
    },
    subjects: [
      ...plan.rootDeletes.map(({ path }) => ({
        code: "company-legacy-fields",
        subject: opaqueSubject(path),
      })),
      ...plan.stripeDeletes.map(({ path }) => ({
        code: "stripe-data-document",
        subject: opaqueSubject(path),
      })),
      ...plan.findings.map(({ code, subject }) => ({ code, subject })),
    ].sort((left, right) =>
      `${left.code}:${left.subject}`.localeCompare(
        `${right.code}:${right.subject}`,
      ),
    ),
    ...(receiptHash === null ? {} : { receiptHash }),
  };
}

export function assertCompanyLegacyStripeMigrationTarget(
  targetName,
  env = process.env,
) {
  const target = STRIPE_MIGRATION_TARGETS[targetName];
  if (!target) {
    throw migrationError("target-rejected", EXIT_CODES.TARGET_REJECTED);
  }
  const projectVariables = ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"];
  const explicitProjects = projectVariables
    .filter((name) => env[name] !== undefined)
    .map((name) => env[name]);
  if (
    explicitProjects.length === 0 ||
    explicitProjects.some(
      (project) => project !== target.projectId,
    ) ||
    env.FIRESTORE_EMULATOR_HOST !== target.firestoreHost ||
    (target.name === USER_LOCAL_STRIPE_MIGRATION_TARGET.name
      ? env.FIRESTORE_DATABASE_ID !== target.databaseId
      : env.FIRESTORE_DATABASE_ID !== undefined &&
        env.FIRESTORE_DATABASE_ID !== target.databaseId)
  ) {
    throw migrationError("target-rejected", EXIT_CODES.TARGET_REJECTED);
  }
  if (env.FIREBASE_CONFIG) {
    let config;
    try {
      config = JSON.parse(env.FIREBASE_CONFIG);
    } catch {
      throw migrationError("target-rejected", EXIT_CODES.TARGET_REJECTED);
    }
    if (
      (config.projectId && config.projectId !== target.projectId) ||
      (config.firestoreDatabaseId &&
        config.firestoreDatabaseId !== target.databaseId)
    ) {
      throw migrationError("target-rejected", EXIT_CODES.TARGET_REJECTED);
    }
  }
  return target;
}

export function assertCodexStripeMigrationTarget(env = process.env) {
  return assertCompanyLegacyStripeMigrationTarget(
    CODEX_STRIPE_MIGRATION_TARGET.name,
    env,
  );
}

export function parseCompanyLegacyStripeArgs(args) {
  const parsed = {
    mode: "dry-run",
    target: null,
    planDigest: null,
    backupPath: null,
    backupReceipt: null,
    confirmProject: null,
    confirmQuietWindow: false,
    confirmUserBackup: false,
    confirmUserLocalApply: false,
    expectedCompanyTotal: null,
    expectedCompanyFieldDocuments: null,
    expectedStripeDataDocuments: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--target") parsed.target = args[++index];
    else if (argument === "--plan-digest") parsed.planDigest = args[++index];
    else if (argument === "--backup-path") parsed.backupPath = args[++index];
    else if (argument === "--backup-receipt") parsed.backupReceipt = args[++index];
    else if (argument === "--confirm-project") parsed.confirmProject = args[++index];
    else if (argument === "--confirm-quiet-window") parsed.confirmQuietWindow = true;
    else if (argument === "--confirm-user-backup") parsed.confirmUserBackup = true;
    else if (argument === "--confirm-user-local-apply") parsed.confirmUserLocalApply = true;
    else if (argument === "--expected-company-total") parsed.expectedCompanyTotal = Number(args[++index]);
    else if (argument === "--expected-company-field-documents") parsed.expectedCompanyFieldDocuments = Number(args[++index]);
    else if (argument === "--expected-stripe-data-documents") parsed.expectedStripeDataDocuments = Number(args[++index]);
    else if (argument === "--create-backup" && parsed.mode === "dry-run") {
      parsed.mode = "create-backup";
    } else if (argument === "--apply" && parsed.mode === "dry-run") {
      parsed.mode = "apply";
    } else if (argument === "--restore" && parsed.mode === "dry-run") {
      parsed.mode = "restore";
    } else {
      throw migrationError("usage-invalid", EXIT_CODES.USAGE);
    }
  }
  if (!STRIPE_MIGRATION_TARGETS[parsed.target]) {
    throw migrationError("usage-invalid", EXIT_CODES.USAGE);
  }
  const userLocal = parsed.target === USER_LOCAL_STRIPE_MIGRATION_TARGET.name;
  const hasUserLocalOptions = parsed.confirmProject || parsed.confirmQuietWindow ||
    parsed.confirmUserBackup || parsed.confirmUserLocalApply ||
    parsed.expectedCompanyTotal !== null || parsed.expectedCompanyFieldDocuments !== null ||
    parsed.expectedStripeDataDocuments !== null;
  if (parsed.mode === "dry-run") {
    if (parsed.planDigest || parsed.backupPath || parsed.backupReceipt || hasUserLocalOptions) {
      throw migrationError("usage-invalid", EXIT_CODES.USAGE);
    }
    return parsed;
  }
  if (userLocal) {
    const countsMatch = parsed.expectedCompanyTotal === USER_LOCAL_EXPECTED_COUNTS.companyTotal &&
      parsed.expectedCompanyFieldDocuments === USER_LOCAL_EXPECTED_COUNTS.companyFieldDocuments &&
      parsed.expectedStripeDataDocuments === USER_LOCAL_EXPECTED_COUNTS.stripeDataDocuments;
    if (parsed.mode !== "apply" ||
      parsed.confirmProject !== USER_LOCAL_STRIPE_MIGRATION_TARGET.projectId ||
      !parsed.confirmQuietWindow || !parsed.confirmUserBackup ||
      !parsed.confirmUserLocalApply || !countsMatch || parsed.backupPath ||
      parsed.backupReceipt) {
      throw migrationError("usage-invalid", EXIT_CODES.USAGE);
    }
    if (!/^[a-f0-9]{64}$/u.test(parsed.planDigest ?? "")) {
      throw migrationError("usage-invalid", EXIT_CODES.USAGE);
    }
    return parsed;
  }
  if (hasUserLocalOptions) throw migrationError("usage-invalid", EXIT_CODES.USAGE);
  if (parsed.mode === "create-backup") {
    if (
      !/^[a-f0-9]{64}$/u.test(parsed.planDigest ?? "") ||
      !parsed.backupPath ||
      parsed.backupReceipt
    ) {
      throw migrationError("usage-invalid", EXIT_CODES.USAGE);
    }
    return parsed;
  }
  if (parsed.mode === "apply") {
    if (
      !/^[a-f0-9]{64}$/u.test(parsed.planDigest ?? "") ||
      !parsed.backupPath ||
      !/^[a-f0-9]{64}$/u.test(parsed.backupReceipt ?? "")
    ) {
      throw migrationError("usage-invalid", EXIT_CODES.USAGE);
    }
    return parsed;
  }
  if (
    parsed.planDigest ||
    !parsed.backupPath ||
    !/^[a-f0-9]{64}$/u.test(parsed.backupReceipt ?? "")
  ) {
    throw migrationError("usage-invalid", EXIT_CODES.USAGE);
  }
  return parsed;
}

function schemaIdentity(manifest, lock) {
  const dependency = manifest?.dependencies?.[SCHEMA_PACKAGE];
  const entry = lock?.packages?.[`node_modules/${SCHEMA_PACKAGE}`];
  return {
    dependency,
    version: entry?.version,
    resolved: entry?.resolved,
    integrity: entry?.integrity,
  };
}

export function inspectStripeMigrationRepositoryPreconditions({
  rulesSource,
  rootManifest,
  rootLock,
  functionsManifest,
  functionsLock,
}) {
  const findings = [];
  // This is a local source preflight, not a Rules evaluator. The authoritative
  // behavior gate remains the Firestore Emulator deny suite.
  const rulesWithoutComments = rulesSource
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/[^\r\n]*/gu, "");
  const stripeMatchPattern =
    /match \/Companies\/\{companyId\}\/StripeData\/\{document=\*\*\}/gu;
  const stripeMatches = rulesWithoutComments.match(stripeMatchPattern) ?? [];
  if (
    stripeMatches.length !== 1 ||
    !/match \/Companies\/\{companyId\}\/StripeData\/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/u.test(
      rulesWithoutComments,
    )
  ) {
    findings.push("rules-stripe-deny-missing");
  }
  if (!/collection != "StripeData"/u.test(rulesWithoutComments)) {
    findings.push("rules-fallback-exclusion-missing");
  }
  const root = schemaIdentity(rootManifest, rootLock);
  const functions = schemaIdentity(functionsManifest, functionsLock);
  for (const identity of [root, functions]) {
    if (
      typeof identity.dependency !== "string" ||
      identity.dependency !== identity.version ||
      typeof identity.resolved !== "string" ||
      typeof identity.integrity !== "string"
    ) {
      findings.push("schema-identity-invalid");
    }
  }
  if (
    root.dependency !== functions.dependency ||
    root.version !== functions.version ||
    root.resolved !== functions.resolved ||
    root.integrity !== functions.integrity
  ) {
    findings.push("schema-identity-mismatch");
  }
  return Object.freeze([...new Set(findings)].sort());
}

async function readRepositoryPreconditions() {
  const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
  return inspectStripeMigrationRepositoryPreconditions({
    rulesSource: await readFile(resolve(REPOSITORY_ROOT, "firestore.rules"), "utf8"),
    rootManifest: await readJson(resolve(REPOSITORY_ROOT, "package.json")),
    rootLock: await readJson(resolve(REPOSITORY_ROOT, "package-lock.json")),
    functionsManifest: await readJson(resolve(REPOSITORY_ROOT, "functions/package.json")),
    functionsLock: await readJson(
      resolve(REPOSITORY_ROOT, "functions/package-lock.json"),
    ),
  });
}

function assertBackupPath(path, repositoryRoot = REPOSITORY_ROOT) {
  if (typeof path !== "string" || path.trim() !== path || path.length === 0) {
    throw migrationError("backup-path-invalid");
  }
  const absolute = resolve(repositoryRoot, path);
  const root = resolve(repositoryRoot, ".codex-test");
  const rel = relative(root, absolute);
  if (
    rel === "" ||
    rel.startsWith(`..${sep}`) ||
    rel === ".." ||
    isAbsolute(rel)
  ) {
    throw migrationError("backup-path-invalid");
  }
  return absolute;
}

function backupPayload(plan) {
  return {
    schemaVersion: 1,
    target: {
      name: CODEX_STRIPE_MIGRATION_TARGET.name,
      projectId: CODEX_STRIPE_MIGRATION_TARGET.projectId,
      firestoreHost: CODEX_STRIPE_MIGRATION_TARGET.firestoreHost,
    },
    planDigest: plan.planDigest,
    contentDigest: plan.contentDigest,
    targetContentDigest: plan.targetContentDigest,
    companyCount: plan.companyCount,
    nonTargetDigest: plan.nonTargetDigest,
    companies: plan.companies.map((record) => ({
      path: record.path,
      updateTime:
        record.updateTime == null
          ? null
          : canonicalizeFirestoreValue(record.updateTime),
      fields: Object.fromEntries(
        LEGACY_COMPANY_FIELDS.map((field) => [
          field,
          field in record.data
            ? { present: true, value: canonicalizeFirestoreValue(record.data[field]) }
            : { present: false },
        ]),
      ),
    })),
    stripeData: plan.stripeData.map((record) => ({
      path: record.path,
      updateTime:
        record.updateTime == null
          ? null
          : canonicalizeFirestoreValue(record.updateTime),
      data: canonicalizeFirestoreValue(record.data),
    })),
  };
}

function hasExactKeys(value, keys) {
  return (
    isPlainObject(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
  );
}

function isCanonicalTimestamp(value) {
  return (
    hasExactKeys(value, ["__firestoreType", "value"]) &&
    value.__firestoreType === "timestamp" &&
    Array.isArray(value.value) &&
    value.value.length === 2 &&
    Number.isInteger(value.value[0]) &&
    Number.isInteger(value.value[1]) &&
    value.value[1] >= 0 &&
    value.value[1] <= 999_999_999
  );
}

function validateCanonicalSubscription(value) {
  if (value === null) return true;
  if (!hasExactKeys(value, SUBSCRIPTION_KEYS)) return false;
  if (
    ![value.id, value.status].every(
      (candidate) => candidate === null || typeof candidate === "string",
    )
  ) {
    return false;
  }
  if (
    !Number.isFinite(value.employeeLimit) ||
    !Number.isInteger(value.employeeLimit)
  ) {
    return false;
  }
  return value.currentPeriodEnd === null || isCanonicalTimestamp(value.currentPeriodEnd);
}

function validateCanonicalStripeData(data) {
  if (!isPlainObject(data)) return false;
  const baseKeys = ["cancel_url", "createdAt", "price", "success_url"];
  const baseOnly = baseKeys.join("\0");
  const success = [...baseKeys, "customerId", "error", "sessionUrl"]
    .sort()
    .join("\0");
  const failure = [...baseKeys, "error", "sessionUrl"].sort().join("\0");
  const shape = Object.keys(data).sort().join("\0");
  if (![baseOnly, success, failure].includes(shape)) return false;
  if (
    typeof data.price !== "string" ||
    typeof data.success_url !== "string" ||
    typeof data.cancel_url !== "string" ||
    !isCanonicalTimestamp(data.createdAt)
  ) {
    return false;
  }
  if (shape === success) {
    return (
      data.error === null &&
      typeof data.sessionUrl === "string" &&
      typeof data.customerId === "string"
    );
  }
  if (shape === failure) {
    return (
      hasExactKeys(data.error, ["message"]) &&
      typeof data.error.message === "string" &&
      data.sessionUrl === null
    );
  }
  return true;
}

function validateBackupPayload(payload) {
  const topLevelKeys = [
    "companies",
    "companyCount",
    "contentDigest",
    "nonTargetDigest",
    "planDigest",
    "schemaVersion",
    "stripeData",
    "target",
    "targetContentDigest",
  ];
  if (
    !hasExactKeys(payload, topLevelKeys) ||
    payload.schemaVersion !== 1 ||
    !hasExactKeys(payload.target, ["firestoreHost", "name", "projectId"]) ||
    payload.target.name !== CODEX_STRIPE_MIGRATION_TARGET.name ||
    payload.target.projectId !== CODEX_STRIPE_MIGRATION_TARGET.projectId ||
    payload.target.firestoreHost !== CODEX_STRIPE_MIGRATION_TARGET.firestoreHost ||
    ![payload.planDigest, payload.contentDigest, payload.targetContentDigest, payload.nonTargetDigest].every(
      (digest) => /^[a-f0-9]{64}$/u.test(digest),
    ) ||
    !Array.isArray(payload.companies) ||
    !Array.isArray(payload.stripeData) ||
    !Number.isInteger(payload.companyCount) ||
    payload.companyCount !== payload.companies.length
  ) {
    throw migrationError("backup-format-invalid");
  }

  const companyPaths = new Set();
  const canonicalCompanies = [];
  let companyWrites = 0;
  for (const company of payload.companies) {
    const match =
      hasExactKeys(company, ["fields", "path", "updateTime"]) &&
      typeof company.path === "string"
        ? COMPANY_PATH.exec(company.path)
        : null;
    if (
      !match ||
      !isSafeId(match[1]) ||
      companyPaths.has(company.path) ||
      !isCanonicalTimestamp(company.updateTime) ||
      !hasExactKeys(company.fields, LEGACY_COMPANY_FIELDS)
    ) {
      throw migrationError("backup-format-invalid");
    }
    companyPaths.add(company.path);
    const presentFields = {};
    for (const field of LEGACY_COMPANY_FIELDS) {
      const entry = company.fields[field];
      if (!isPlainObject(entry) || typeof entry.present !== "boolean") {
        throw migrationError("backup-format-invalid");
      }
      if (entry.present === false) {
        if (!hasExactKeys(entry, ["present"])) {
          throw migrationError("backup-format-invalid");
        }
        continue;
      }
      if (!hasExactKeys(entry, ["present", "value"])) {
        throw migrationError("backup-format-invalid");
      }
      const valid =
        field === "stripeCustomerId"
          ? entry.value === null || typeof entry.value === "string"
          : validateCanonicalSubscription(entry.value);
      if (!valid) throw migrationError("backup-format-invalid");
      presentFields[field] = entry.value;
    }
    if (Object.keys(presentFields).length > 0) companyWrites += 1;
    canonicalCompanies.push({ path: company.path, fields: presentFields });
  }

  const stripePaths = new Set();
  const canonicalStripe = [];
  for (const stripe of payload.stripeData) {
    const match =
      hasExactKeys(stripe, ["data", "path", "updateTime"]) &&
      typeof stripe.path === "string"
        ? DIRECT_STRIPE_PATH.exec(stripe.path)
        : null;
    if (
      !match ||
      !isSafeId(match[1]) ||
      !isSafeId(match[2]) ||
      stripePaths.has(stripe.path) ||
      !companyPaths.has(`Companies/${match[1]}`) ||
      !isCanonicalTimestamp(stripe.updateTime) ||
      !validateCanonicalStripeData(stripe.data)
    ) {
      throw migrationError("backup-format-invalid");
    }
    stripePaths.add(stripe.path);
    canonicalStripe.push({ path: stripe.path, data: stripe.data });
  }
  if (companyWrites + payload.stripeData.length > STRIPE_MIGRATION_MAX_WRITES) {
    throw migrationError("backup-format-invalid");
  }
  if (
    targetContentDigestFromCanonical(canonicalCompanies, canonicalStripe) !==
    payload.targetContentDigest
  ) {
    throw migrationError("backup-target-digest-mismatch");
  }
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export async function createCompanyLegacyStripeBackup(
  plan,
  backupPath,
  {
    repositoryRoot = REPOSITORY_ROOT,
    mkdirImpl = mkdir,
    writeFileImpl = writeFile,
  } = {},
) {
  if (
    plan.target?.name !== CODEX_STRIPE_MIGRATION_TARGET.name ||
    plan.target?.projectId !== CODEX_STRIPE_MIGRATION_TARGET.projectId ||
    plan.target?.firestoreHost !== CODEX_STRIPE_MIGRATION_TARGET.firestoreHost ||
    plan.target?.databaseId !== CODEX_STRIPE_MIGRATION_TARGET.databaseId ||
    plan.findings.length > 0 ||
    plan.writeCount > STRIPE_MIGRATION_MAX_WRITES
  ) {
    throw migrationError("backup-plan-blocked");
  }
  const absolute = assertBackupPath(backupPath, repositoryRoot);
  const serialized = `${stableJson(backupPayload(plan))}\n`;
  await mkdirImpl(dirname(absolute), { recursive: true });
  try {
    await writeFileImpl(absolute, serialized, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    throw migrationError("backup-write-failed");
  }
  return Object.freeze({ receiptHash: sha256(serialized) });
}

export async function readCompanyLegacyStripeBackup(
  backupPath,
  receiptHash,
  { repositoryRoot = REPOSITORY_ROOT, readFileImpl = readFile } = {},
) {
  // The receipt detects file changes only. It is not an authenticity proof, so
  // every path, value shape, duplicate, parent, limit, and target digest is
  // independently revalidated below before the payload can reach restore.
  const absolute = assertBackupPath(backupPath, repositoryRoot);
  let serialized;
  try {
    serialized = await readFileImpl(absolute, "utf8");
  } catch {
    throw migrationError("backup-read-failed");
  }
  if (sha256(serialized) !== receiptHash) {
    throw migrationError("backup-receipt-mismatch");
  }
  let payload;
  try {
    payload = JSON.parse(serialized);
  } catch {
    throw migrationError("backup-format-invalid");
  }
  validateBackupPayload(payload);
  deepFreeze(payload);
  VALIDATED_BACKUPS.add(payload);
  return Object.freeze({ payload, receiptHash });
}

function runProcess(command, args, { cwd = REPOSITORY_ROOT, input = "" } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectPromise);
    child.once("close", (code) => resolvePromise({ code, stdout, stderr }));
    child.stdin.end(input, "utf8");
  });
}

export async function readCompanyLegacyStripeRepositoryIdentity({
  runProcessImpl = runProcess,
  readFileImpl = readFile,
} = {}) {
  const [headResult, statusResult, toolSource] = await Promise.all([
    runProcessImpl("git", ["rev-parse", "HEAD"]),
    runProcessImpl("git", ["status", "--porcelain"]),
    readFileImpl(fileURLToPath(import.meta.url), "utf8"),
  ]);
  const head = headResult.stdout.trim();
  if (headResult.code !== 0 || statusResult.code !== 0 || statusResult.stdout !== "" ||
    !/^[a-f0-9]{40}$/u.test(head)) {
    throw migrationError("repository-identity-invalid");
  }
  return Object.freeze({
    head,
    toolDigest: sha256(toolSource),
  });
}

export async function readStableUserLocalPlan(firestore, target, {
  readState = readCompanyLegacyStripeState,
  delay = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
  intervalMs = USER_LOCAL_STABILITY_INTERVAL_MS,
} = {}) {
  const first = planCompanyLegacyStripeMigration({ ...(await readState(firestore)), target });
  await delay(intervalMs);
  const second = planCompanyLegacyStripeMigration({ ...(await readState(firestore)), target });
  if (first.planDigest !== second.planDigest || first.contentDigest !== second.contentDigest ||
    first.targetContentDigest !== second.targetContentDigest || first.nonTargetDigest !== second.nonTargetDigest) {
    throw migrationError("stability-drift");
  }
  return second;
}

function assertUserLocalCounts(plan) {
  if (plan.companyCount !== USER_LOCAL_EXPECTED_COUNTS.companyTotal ||
    plan.rootDeletes.length !== USER_LOCAL_EXPECTED_COUNTS.companyFieldDocuments ||
    plan.stripeDeletes.length !== USER_LOCAL_EXPECTED_COUNTS.stripeDataDocuments) {
    throw migrationError("expected-count-mismatch");
  }
}
function snapshotRecord(snapshot) {
  return {
    path: snapshot.ref.path,
    data: snapshot.data(),
    updateTime: snapshot.updateTime ?? null,
  };
}

async function listStripeDescendants(stripeReferences) {
  const paths = new Set();
  for (const reference of stripeReferences) {
    const collections = await reference.listCollections();
    for (const childCollection of collections) {
      const children = await childCollection.listDocuments();
      if (children.length > 0) paths.add(children[0].path);
    }
  }
  return [...paths].sort();
}

export async function readCompanyLegacyStripeState(firestore) {
  const companiesCollection = firestore.collection("Companies");
  const [companyReferences, allStripeSnapshot] = await Promise.all([
    companiesCollection.listDocuments(),
    firestore.collectionGroup("StripeData").get(),
  ]);
  const companySnapshots = await Promise.all(
    companyReferences.map((reference) => reference.get()),
  );
  const existingCompanyIds = new Set(
    companySnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => snapshot.ref.id),
  );
  const stripeReferenceByPath = new Map();
  const descendants = [];
  for (const document of allStripeSnapshot.docs) {
    if (DIRECT_STRIPE_PATH.test(document.ref.path)) {
      stripeReferenceByPath.set(document.ref.path, document.ref);
    }
    else descendants.push(document.ref.path);
  }
  for (const companyReference of companyReferences) {
    const references = await companyReference.collection("StripeData").listDocuments();
    for (const reference of references) {
      stripeReferenceByPath.set(reference.path, reference);
    }
  }
  const stripeReferences = [...stripeReferenceByPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const stripeSnapshots = await Promise.all(
    stripeReferences.map((reference) => reference.get()),
  );
  const directStripe = stripeSnapshots.filter((snapshot) => snapshot.exists);
  const orphanMarkers = [];
  for (let index = 0; index < stripeReferences.length; index += 1) {
    const reference = stripeReferences[index];
    const match = DIRECT_STRIPE_PATH.exec(reference.path);
    if (
      match &&
      !stripeSnapshots[index].exists &&
      !existingCompanyIds.has(match[1])
    ) {
      orphanMarkers.push(reference.path);
    }
  }
  descendants.push(...(await listStripeDescendants(stripeReferences)));
  return {
    companies: companySnapshots.filter((snapshot) => snapshot.exists).map(snapshotRecord),
    stripeData: directStripe.map(snapshotRecord),
    stripeDescendants: [...new Set(descendants)].sort(),
    stripeOrphans: [...new Set(orphanMarkers)].sort(),
  };
}

function assertPlanCanWrite(plan, expectedDigest) {
  if (plan.findings.length > 0) throw migrationError("plan-blocked");
  if (plan.planDigest !== expectedDigest) throw migrationError("plan-digest-mismatch");
  if (plan.writeCount > STRIPE_MIGRATION_MAX_WRITES) {
    throw migrationError("write-limit-exceeded");
  }
}

function assertBackupMatchesPlan(backup, plan) {
  if (
    !VALIDATED_BACKUPS.has(backup) ||
    backup.planDigest !== plan.planDigest ||
    backup.contentDigest !== plan.contentDigest ||
    backup.targetContentDigest !== plan.targetContentDigest ||
    backup.companyCount !== plan.companyCount ||
    backup.nonTargetDigest !== plan.nonTargetDigest
  ) {
    throw migrationError("backup-plan-mismatch");
  }
}

function transactionSnapshotState(companiesSnapshot, stripeSnapshot) {
  const direct = [];
  const descendants = [];
  for (const document of stripeSnapshot.docs) {
    if (DIRECT_STRIPE_PATH.test(document.ref.path)) direct.push(snapshotRecord(document));
    else descendants.push(document.ref.path);
  }
  return {
    companies: companiesSnapshot.docs.map(snapshotRecord),
    stripeData: direct,
    stripeDescendants: descendants,
  };
}

export async function applyCompanyLegacyStripeMigration({
  firestore,
  expectedPlanDigest,
  backup = null,
  target = null,
  deleteFieldValue,
}) {
  if (typeof deleteFieldValue !== "function") {
    throw migrationError("delete-field-factory-missing");
  }
  const effectiveTarget = backup?.target?.databaseId
    ? backup.target
    : target ?? CODEX_STRIPE_MIGRATION_TARGET;
  if (effectiveTarget.name === CODEX_STRIPE_MIGRATION_TARGET.name && backup === null) {
    throw migrationError("backup-required");
  }
  const fullPreflight = planCompanyLegacyStripeMigration(
    { ...(await readCompanyLegacyStripeState(firestore)), target: effectiveTarget },
  );
  assertPlanCanWrite(fullPreflight, expectedPlanDigest);
  if (backup !== null) assertBackupMatchesPlan(backup, fullPreflight);
  // listDocuments/listCollections are not transaction reads. Missing-parent
  // descendants are checked immediately before the transaction and again by
  // the mandatory post-check. user-local additionally requires a quiet window
  // and two stable full inventories in the CLI before reaching this function.
  let appliedPlan;
  await firestore.runTransaction(async (transaction) => {
    const companiesQuery = firestore.collection("Companies");
    const stripeQuery = firestore.collectionGroup("StripeData");
    const companiesSnapshot = await transaction.get(companiesQuery);
    const stripeSnapshot = await transaction.get(stripeQuery);
    const state = transactionSnapshotState(companiesSnapshot, stripeSnapshot);
    const fresh = planCompanyLegacyStripeMigration({ ...state, target: effectiveTarget });
    assertPlanCanWrite(fresh, expectedPlanDigest);
    if (backup !== null) assertBackupMatchesPlan(backup, fresh);
    appliedPlan = fresh;

    // Every read and validation is complete before the first write is registered.
    for (const operation of fresh.rootDeletes) {
      const patch = Object.fromEntries(
        operation.fields.map((field) => [field, deleteFieldValue()]),
      );
      transaction.update(firestore.doc(operation.path), patch);
    }
    for (const operation of fresh.stripeDeletes) {
      transaction.delete(firestore.doc(operation.path));
    }
  });
  return appliedPlan;
}

export async function verifyCompanyLegacyStripePostState(
  firestore,
  originalPlan,
) {
  const state = await readCompanyLegacyStripeState(firestore);
  const current = planCompanyLegacyStripeMigration({ ...state, target: originalPlan.target });
  if (
    current.findings.length > 0 ||
    current.writeCount !== 0 ||
    current.companyCount !== originalPlan.companyCount ||
    current.nonTargetDigest !== originalPlan.nonTargetDigest
  ) {
    throw migrationError("post-check-failed", EXIT_CODES.APPLY_INCOMPLETE);
  }
  return current;
}

export async function restoreCompanyLegacyStripeMigration({
  firestore,
  backup,
  valueFactories = {},
}) {
  if (!VALIDATED_BACKUPS.has(backup)) {
    throw migrationError("backup-not-validated");
  }
  const writeCount =
    backup.companies.filter((company) =>
      LEGACY_COMPANY_FIELDS.some((field) => company.fields[field]?.present),
    ).length + backup.stripeData.length;
  if (writeCount > STRIPE_MIGRATION_MAX_WRITES) {
    throw migrationError("write-limit-exceeded");
  }
  const fullPreflight = planCompanyLegacyStripeMigration(
    await readCompanyLegacyStripeState(firestore),
  );
  if (
    fullPreflight.findings.length > 0 ||
    fullPreflight.writeCount !== 0 ||
    fullPreflight.companyCount !== backup.companyCount ||
    fullPreflight.nonTargetDigest !== backup.nonTargetDigest
  ) {
    throw migrationError("restore-conflict");
  }
  await firestore.runTransaction(async (transaction) => {
    const companiesSnapshot = await transaction.get(firestore.collection("Companies"));
    const stripeSnapshot = await transaction.get(
      firestore.collectionGroup("StripeData"),
    );
    const state = transactionSnapshotState(companiesSnapshot, stripeSnapshot);
    const current = planCompanyLegacyStripeMigration(state);
    if (
      current.findings.length > 0 ||
      current.writeCount !== 0 ||
      current.companyCount !== backup.companyCount ||
      current.nonTargetDigest !== backup.nonTargetDigest
    ) {
      throw migrationError("restore-conflict");
    }
    for (const company of backup.companies) {
      const fields = Object.fromEntries(
        LEGACY_COMPANY_FIELDS.filter(
          (field) => company.fields[field]?.present === true,
        ).map((field) => [
          field,
          decodeFirestoreValue(company.fields[field].value, valueFactories),
        ]),
      );
      if (Object.keys(fields).length > 0) {
        transaction.update(firestore.doc(company.path), fields);
      }
    }
    for (const stripe of backup.stripeData) {
      transaction.create(
        firestore.doc(stripe.path),
        decodeFirestoreValue(stripe.data, valueFactories),
      );
    }
  });

  const restored = planCompanyLegacyStripeMigration(
    await readCompanyLegacyStripeState(firestore),
  );
  if (
    restored.companyCount !== backup.companyCount ||
    restored.nonTargetDigest !== backup.nonTargetDigest ||
    restored.targetContentDigest !== backup.targetContentDigest
  ) {
    throw migrationError("restore-post-check-failed", EXIT_CODES.APPLY_INCOMPLETE);
  }
  return restored;
}

async function createCompanyLegacyStripeRuntime(target) {
  const requireFromFunctions = createRequire(
    resolve(REPOSITORY_ROOT, "functions/package.json"),
  );
  const { initializeApp, getApps } = requireFromFunctions("firebase-admin/app");
  const { FieldValue, GeoPoint, Timestamp, getFirestore } =
    requireFromFunctions("firebase-admin/firestore");
  const appName = `company-legacy-stripe-migration-${target.name}`;
  const app =
    getApps().find((candidate) => candidate.name === appName) ??
    initializeApp({ projectId: target.projectId }, appName);
  const firestore = getFirestore(app);
  return {
    firestore,
    deleteFieldValue: () => FieldValue.delete(),
    valueFactories: {
      timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds),
      geoPoint: (latitude, longitude) => new GeoPoint(latitude, longitude),
      reference: (path) => firestore.doc(path),
    },
  };
}

export async function executeCompanyLegacyStripeCli({
  args = [],
  env = {},
  readRepositoryPreconditionsImpl = readRepositoryPreconditions,
  createRuntime = createCompanyLegacyStripeRuntime,
  readState = readCompanyLegacyStripeState,
  readRepositoryIdentity = readCompanyLegacyStripeRepositoryIdentity,
  delay,
} = {}) {
  const parsed = parseCompanyLegacyStripeArgs(args);
  const target = assertCompanyLegacyStripeMigrationTarget(parsed.target, env);
  const repositoryFindings = await readRepositoryPreconditionsImpl();
  if (repositoryFindings.length > 0) {
    throw migrationError("repository-precondition");
  }
  const isUserLocalWrite = target.name === USER_LOCAL_STRIPE_MIGRATION_TARGET.name && parsed.mode !== "dry-run";
  // A clean, reviewed 40-character HEAD and exact tool identity are established
  // before Admin initialization or any Firestore read.
  if (isUserLocalWrite) {
    const identity = await readRepositoryIdentity();
    if (!/^[a-f0-9]{40}$/u.test(identity?.head ?? "") ||
      !/^[a-f0-9]{64}$/u.test(identity?.toolDigest ?? "")) {
      throw migrationError("repository-identity-invalid");
    }
  }
  const { firestore, deleteFieldValue, valueFactories } =
    await createRuntime(target);

  if (isUserLocalWrite) {
    const plan = await readStableUserLocalPlan(firestore, target, { readState, delay });
    assertUserLocalCounts(plan);
    assertPlanCanWrite(plan, parsed.planDigest);
    // --confirm-user-backup records only the user's statement that their own
    // consistent Emulator backup is complete. This tool cannot verify it.
    const appliedPlan = await applyCompanyLegacyStripeMigration({
      firestore,
      expectedPlanDigest: parsed.planDigest,
      target,
      deleteFieldValue,
    });
    const post = await verifyCompanyLegacyStripePostState(firestore, appliedPlan);
    return {
      exitCode: EXIT_CODES.CLEAN,
      summary: summarizeCompanyLegacyStripePlan(post, { mode: "apply" }),
    };
  }

  if (parsed.mode === "restore") {
    const { payload } = await readCompanyLegacyStripeBackup(
      parsed.backupPath,
      parsed.backupReceipt,
    );
    const restored = await restoreCompanyLegacyStripeMigration({
      firestore,
      backup: payload,
      valueFactories,
    });
    return {
      exitCode: EXIT_CODES.CLEAN,
      summary: summarizeCompanyLegacyStripePlan(restored, { mode: "restore" }),
    };
  }

  const plan = planCompanyLegacyStripeMigration({
    ...(await readState(firestore)),
    target,
  });
  if (parsed.mode === "dry-run") {
    return {
      exitCode:
        plan.findings.length > 0
          ? EXIT_CODES.DATA_BLOCKER
          : plan.writeCount > 0
            ? EXIT_CODES.CHANGES
            : EXIT_CODES.CLEAN,
      summary: summarizeCompanyLegacyStripePlan(plan),
    };
  }
  assertPlanCanWrite(plan, parsed.planDigest);
  if (parsed.mode === "create-backup") {
    const receipt = await createCompanyLegacyStripeBackup(plan, parsed.backupPath);
    return {
      exitCode: EXIT_CODES.CLEAN,
      summary: summarizeCompanyLegacyStripePlan(plan, {
        mode: "create-backup",
        receiptHash: receipt.receiptHash,
      }),
    };
  }

  const { payload } = await readCompanyLegacyStripeBackup(
    parsed.backupPath,
    parsed.backupReceipt,
  );
  assertBackupMatchesPlan(payload, plan);
  const appliedPlan = await applyCompanyLegacyStripeMigration({
    firestore,
    expectedPlanDigest: parsed.planDigest,
    backup: payload,
    deleteFieldValue,
  });
  const post = await verifyCompanyLegacyStripePostState(firestore, appliedPlan);
  return {
    exitCode: EXIT_CODES.CLEAN,
    summary: summarizeCompanyLegacyStripePlan(post, { mode: "apply" }),
  };
}

async function runCli() {
  try {
    const result = await executeCompanyLegacyStripeCli({
      args: process.argv.slice(2),
      env: process.env,
    });
    process.stdout.write(`${JSON.stringify(result.summary)}\n`);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        status: "failed",
        code:
          typeof error?.code === "string" && /^[a-z0-9-]+$/u.test(error.code)
            ? error.code
            : "unexpected",
      })}\n`,
    );
    process.exitCode = Number.isInteger(error?.exitCode)
      ? error.exitCode
      : EXIT_CODES.UNEXPECTED;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runCli();
  await Promise.all([
    new Promise((resolveFlush) => process.stdout.write("", resolveFlush)),
    new Promise((resolveFlush) => process.stderr.write("", resolveFlush)),
  ]);
  process.exit(process.exitCode ?? EXIT_CODES.CLEAN);
}
