import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { readCustomerCredentialFile } from "./check-customer-dev-compatibility.mjs";
import { companySubject, planOperationResultProjections } from "./lib/operation-result-projection-plan.mjs";

export const OPERATION_RESULT_RECOVERY_TARGET = Object.freeze({
  project: "air-guard-v2-dev", database: "(default)", branch: "main",
});
export const OPERATION_RESULT_RECOVERY_LIMITS = Object.freeze({
  pageSize: 500,
  operationResults: 100000,
  billings: 100000,
  dailyAttendances: 100000,
  dailyOperationsByEmployee: 100000,
  siteEmployeeHistories: 100000,
  customers: 10000,
  timeoutMs: 600000,
});

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COLLECTIONS = Object.freeze([
  ["OperationResults", "operationResults", "maxOperationResults"],
  ["Billings", "billings", "maxBillings"],
  ["DailyAttendances", "dailyAttendances", "maxDailyAttendances"],
  ["DailyOperationsByEmployee", "dailyOperationsByEmployee", "maxDailyOperationsByEmployee"],
  ["SiteEmployeeHistories", "siteEmployeeHistories", "maxSiteEmployeeHistories"],
]);
const ARGUMENTS = Object.freeze({
  "--project": "project", "--database": "database", "--company-id": "companyId",
  "--start-date": "startDate", "--end-date": "endDate", "--page-size": "pageSize",
  "--max-operation-results": "maxOperationResults", "--max-billings": "maxBillings",
  "--max-daily-attendances": "maxDailyAttendances",
  "--max-daily-operations-by-employee": "maxDailyOperationsByEmployee",
  "--max-site-employee-histories": "maxSiteEmployeeHistories",
  "--max-customers": "maxCustomers", "--timeout-ms": "timeoutMs",
  "--expected-commit": "expectedCommit",
});

class UsageFailure extends Error {}
class TargetFailure extends Error {}
class DataFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

function safeIdentifier(value, maximum = 128) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value === value.trim() && !/[\/\u0000-\u001f\u007f]/u.test(value);
}

function strictDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function integer(value, maximum) {
  if (!/^[1-9][0-9]*$/u.test(value || "")) throw new UsageFailure();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new UsageFailure();
  return parsed;
}

export function parseOperationResultProjectionArgs(args) {
  if (!Array.isArray(args)) throw new UsageFailure();
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--read-only") {
      if (values.readOnly) throw new UsageFailure();
      values.readOnly = true;
      continue;
    }
    const field = ARGUMENTS[option];
    const value = args[++index];
    if (!field || Object.hasOwn(values, field) || typeof value !== "string" || value.startsWith("--")) {
      throw new UsageFailure();
    }
    values[field] = value;
  }
  if (values.readOnly !== true || Object.values(ARGUMENTS).some((field) => !Object.hasOwn(values, field))) {
    throw new UsageFailure();
  }
  if (values.project !== OPERATION_RESULT_RECOVERY_TARGET.project ||
      values.database !== OPERATION_RESULT_RECOVERY_TARGET.database ||
      !safeIdentifier(values.companyId) || !/^[0-9a-f]{40}$/u.test(values.expectedCommit)) {
    throw new TargetFailure();
  }
  if (!strictDate(values.startDate) || !strictDate(values.endDate) || values.startDate > values.endDate) {
    throw new UsageFailure();
  }
  return {
    ...values,
    pageSize: integer(values.pageSize, OPERATION_RESULT_RECOVERY_LIMITS.pageSize),
    maxOperationResults: integer(values.maxOperationResults, OPERATION_RESULT_RECOVERY_LIMITS.operationResults),
    maxBillings: integer(values.maxBillings, OPERATION_RESULT_RECOVERY_LIMITS.billings),
    maxDailyAttendances: integer(values.maxDailyAttendances, OPERATION_RESULT_RECOVERY_LIMITS.dailyAttendances),
    maxDailyOperationsByEmployee: integer(values.maxDailyOperationsByEmployee,
      OPERATION_RESULT_RECOVERY_LIMITS.dailyOperationsByEmployee),
    maxSiteEmployeeHistories: integer(values.maxSiteEmployeeHistories,
      OPERATION_RESULT_RECOVERY_LIMITS.siteEmployeeHistories),
    maxCustomers: integer(values.maxCustomers, OPERATION_RESULT_RECOVERY_LIMITS.customers),
    timeoutMs: integer(values.timeoutMs, OPERATION_RESULT_RECOVERY_LIMITS.timeoutMs),
  };
}

export function assertOperationResultProjectionEnvironment(env) {
  if (typeof env?.AIRGUARD_DEV_CREDENTIAL_PATH !== "string" || !env.AIRGUARD_DEV_CREDENTIAL_PATH) {
    throw new TargetFailure();
  }
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || value === "") continue;
    const key = name.toUpperCase();
    if (key.includes("EMULATOR") || key.includes("ENDPOINT") || key.includes("UNIVERSE") ||
        ["FIRESTORE_HOST", "FIREBASE_CONFIG", "GOOGLE_APPLICATION_CREDENTIALS", "NODE_OPTIONS",
          "NODE_USE_ENV_PROXY", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"].includes(key) ||
        (key === "NODE_TLS_REJECT_UNAUTHORIZED" && value !== "1") ||
        (["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "GCP_PROJECT", "FIREBASE_PROJECT_ID"].includes(key) &&
          value !== OPERATION_RESULT_RECOVERY_TARGET.project)) throw new TargetFailure();
  }
}

export function validateOperationResultProjectionCredential(source) {
  let credential;
  try { credential = JSON.parse(source); } catch { throw new TargetFailure(); }
  if (!credential || typeof credential !== "object" || Array.isArray(credential) ||
      credential.type !== "service_account" || credential.project_id !== OPERATION_RESULT_RECOVERY_TARGET.project ||
      typeof credential.client_email !== "string" ||
      !/^[a-z][a-z0-9-]*@air-guard-v2-dev\.iam\.gserviceaccount\.com$/u.test(credential.client_email) ||
      typeof credential.private_key !== "string" ||
      !credential.private_key.startsWith("-----BEGIN PRIVATE KEY-----\n")) throw new TargetFailure();
  return credential;
}

async function defaultRepoState() {
  const run = async (...args) => (await promisify(execFile)("git", args, {
    cwd: ROOT, windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024, encoding: "utf8",
  })).stdout.trim();
  return {
    root: (await run("rev-parse", "--show-toplevel")).replaceAll("\\", "/"),
    branch: await run("branch", "--show-current"),
    head: await run("rev-parse", "HEAD"),
    status: await run("status", "--porcelain"),
  };
}

function validateRepoState(state, expectedCommit) {
  if (!state || state.root.toLowerCase() !== ROOT.replaceAll("\\", "/").toLowerCase() ||
      state.branch !== OPERATION_RESULT_RECOVERY_TARGET.branch || state.head !== expectedCommit || state.status !== "") {
    throw new TargetFailure();
  }
}

async function defaultAdminFactory() {
  const require = createRequire(resolve(ROOT, "functions/package.json"));
  const app = require("firebase-admin/app");
  const firestore = require("firebase-admin/firestore");
  return { ...app, ...firestore };
}

function checkPath(document, expectedPrefix) {
  const path = document?.ref?.path;
  if (typeof path !== "string" || !path.startsWith(`${expectedPrefix}/`) ||
      path.slice(expectedPrefix.length + 1).includes("/") || document.id !== path.slice(expectedPrefix.length + 1) ||
      !safeIdentifier(document.id, 1500)) throw new DataFailure("unexpected-path");
}

export async function scanProjectionCollection({
  firestore, FieldPath, companyId, collection, pageSize, maximum, withinDeadline,
}) {
  const prefix = `Companies/${companyId}/${collection}`;
  const reference = firestore.collection(prefix);
  const result = [];
  const ids = new Set();
  let lastId = null;
  let cursor = null;
  let exhausted = false;
  while (!exhausted) {
    const remaining = maximum + 1 - result.length;
    const requested = Math.min(pageSize, remaining);
    let query = reference.orderBy(FieldPath.documentId(), "asc").limit(requested);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await withinDeadline(query.get());
    if (!snapshot || !Array.isArray(snapshot.docs)) throw new DataFailure("response-incomplete");
    if (snapshot.docs.length > requested) throw new DataFailure("response-incomplete");
    if (snapshot.docs.length === 0) { exhausted = true; break; }
    for (const document of snapshot.docs) {
      checkPath(document, prefix);
      if (ids.has(document.id)) throw new DataFailure("duplicate-document");
      if (lastId !== null && document.id <= lastId) throw new DataFailure("page-order");
      ids.add(document.id);
      lastId = document.id;
      result.push({ id: document.id, data: document.data(), updateTime: document.updateTime ?? null });
      if (result.length > maximum) throw new DataFailure("document-limit");
    }
    cursor = snapshot.docs.at(-1);
    exhausted = snapshot.docs.length < requested;
  }
  return result;
}

async function readRequiredCustomers({ firestore, companyId, ids, maximum, withinDeadline }) {
  if (ids.size > maximum) throw new DataFailure("customer-limit");
  const result = new Map();
  for (const id of [...ids].sort()) {
    if (!safeIdentifier(id)) throw new DataFailure("customer-id-invalid");
    const snapshot = await withinDeadline(firestore.doc(`Companies/${companyId}/Customers/${id}`).get());
    if (snapshot?.exists) result.set(id, snapshot.data());
  }
  return result;
}

function baseBlocked(code) {
  return { status: "blocked", complete: false, findingCodeCounts: { [code]: 1 } };
}

function safeSummary(options, plan) {
  return {
    status: !plan.complete ? "blocked" : plan.differences ? "differences" : "clean",
    complete: plan.complete,
    project: options.project,
    database: options.database,
    companySubject: companySubject(options.companyId),
    dates: { start: options.startDate, end: options.endDate },
    scanCounts: plan.scanCounts,
    candidateCounts: plan.candidateCounts,
    perProjection: plan.perProjection,
    findingCodeCounts: plan.findingCodeCounts,
    planDigest: plan.planDigest,
    limits: {
      pageSize: options.pageSize,
      OperationResults: options.maxOperationResults,
      Billings: options.maxBillings,
      DailyAttendances: options.maxDailyAttendances,
      DailyOperationsByEmployee: options.maxDailyOperationsByEmployee,
      SiteEmployeeHistories: options.maxSiteEmployeeHistories,
      Customers: options.maxCustomers,
      timeoutMs: options.timeoutMs,
    },
  };
}

export async function executeOperationResultProjectionCheck({
  args = [], env = {}, getRepoState = defaultRepoState, readCredentialFile = readCustomerCredentialFile,
  adminFactory = defaultAdminFactory, scanCollection = scanProjectionCollection,
  readCustomers = readRequiredCustomers,
} = {}) {
  let app = null;
  let admin = null;
  let timer = null;
  try {
    const options = parseOperationResultProjectionArgs(args);
    assertOperationResultProjectionEnvironment(env);
    validateRepoState(await getRepoState(), options.expectedCommit);
    let source;
    try { source = await readCredentialFile(env.AIRGUARD_DEV_CREDENTIAL_PATH); } catch { throw new TargetFailure(); }
    const credential = validateOperationResultProjectionCredential(source);
    admin = await adminFactory();
    const name = `operation-result-projection-read-only-${process.pid}-${Date.now()}`;
    try {
      app = admin.initializeApp({ credential: admin.cert(credential), projectId: options.project }, name);
    } catch { throw new TargetFailure(); }
    const firestore = admin.getFirestore(app, options.database);
    const deadline = Date.now() + options.timeoutMs;
    const withinDeadline = async (promise) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new DataFailure("timeout");
      return Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new DataFailure("timeout")), remaining);
      })]).finally(() => { if (timer) clearTimeout(timer); timer = null; });
    };
    const inventory = {};
    for (const [collection, field, maximum] of COLLECTIONS) {
      inventory[field] = await scanCollection({
        firestore, FieldPath: admin.FieldPath, companyId: options.companyId, collection,
        pageSize: options.pageSize, maximum: options[maximum], withinDeadline,
      });
    }
    let plan = planOperationResultProjections({ ...inventory, customers: new Map(),
      startDate: options.startDate, endDate: options.endDate });
    const customers = await readCustomers({ firestore, companyId: options.companyId,
      ids: plan.requiredCustomerIds, maximum: options.maxCustomers, withinDeadline });
    plan = planOperationResultProjections({ ...inventory, customers,
      startDate: options.startDate, endDate: options.endDate });
    const summary = safeSummary(options, plan);
    return { exitCode: plan.complete ? (plan.differences ? 2 : 0) : 3, summary };
  } catch (error) {
    if (error instanceof UsageFailure) return { exitCode: 64, summary: baseBlocked("arguments") };
    if (error instanceof TargetFailure) return { exitCode: 78, summary: baseBlocked("target-rejected") };
    if (error instanceof DataFailure) return { exitCode: 3, summary: baseBlocked(error.code) };
    return { exitCode: 70, summary: baseBlocked("unexpected") };
  } finally {
    if (timer) clearTimeout(timer);
    if (app && admin?.deleteApp) await admin.deleteApp(app).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await executeOperationResultProjectionCheck({ args: process.argv.slice(2), env: process.env });
  process.stdout.write(`${JSON.stringify(result.summary)}\n`);
  process.exitCode = result.exitCode;
}
