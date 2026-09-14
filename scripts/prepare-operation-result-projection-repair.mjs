import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  canonicalProjectionDigest, planOperationResultProjections,
} from "./lib/operation-result-projection-plan.mjs";
import { acquirePrivateLifecycleLock, readPrivateArtifact, validatePrivateArtifactPath, writeNewPrivateArtifact } from "./lib/private-firestore-receipt.mjs";
import { readCustomerCredentialFile } from "./check-customer-dev-compatibility.mjs";
import {
  assertOperationResultProjectionEnvironment, scanProjectionCollection,
  validateOperationResultProjectionCredential,
} from "./check-operation-result-projections.mjs";

export const REPAIR_TARGET = Object.freeze({ project: "air-guard-v2-dev", database: "(default)", branch: "main" });
export const REPAIR_COUNTS = Object.freeze({
  create: 250, update: 94, write: 344, blocked: 0, extra: 1,
  perProjection: Object.freeze({
    Billings: Object.freeze({ create: 0, update: 12, extra: 1 }),
    DailyAttendances: Object.freeze({ create: 120, update: 16, extra: 0 }),
    DailyOperationsByEmployee: Object.freeze({ create: 120, update: 16, extra: 0 }),
    SiteEmployeeHistories: Object.freeze({ create: 10, update: 50, extra: 0 }),
  }),
});
export const REPAIR_COLLECTIONS = Object.freeze({
  Billings: "billings", DailyAttendances: "dailyAttendances",
  DailyOperationsByEmployee: "dailyOperationsByEmployee", SiteEmployeeHistories: "siteEmployeeHistories",
});
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

class RepairError extends Error { constructor(code, exitCode = 3) { super(code); this.code = code; this.exitCode = exitCode; } }
const fail = (code, exitCode) => { throw new RepairError(code, exitCode); };
const safeId = (value) => typeof value === "string" && value.length > 0 && value.length <= 1500 &&
  value === value.trim() && !/[\/\u0000-\u001f\u007f]/u.test(value);
const sha = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const date = (value) => /^\d{4}-\d{2}-\d{2}$/u.test(value || "") &&
  new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value);
const int = (value, max) => {
  if (!/^[1-9][0-9]*$/u.test(value || "")) fail("arguments", 64);
  const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed > max) fail("arguments", 64); return parsed;
};

const VALUE_ARGS = Object.freeze({
  "--project": "project", "--database": "database", "--companies-file": "companiesFile",
  "--snapshot-file": "snapshotFile", "--start-date": "startDate",
  "--end-date": "endDate", "--page-size": "pageSize", "--max-operation-results": "maxOperationResults",
  "--max-billings": "maxBillings", "--max-daily-attendances": "maxDailyAttendances",
  "--max-daily-operations-by-employee": "maxDailyOperationsByEmployee",
  "--max-site-employee-histories": "maxSiteEmployeeHistories", "--max-customers": "maxCustomers",
  "--timeout-ms": "timeoutMs", "--expected-commit": "expectedCommit",
});

export function parsePrepareRepairArgs(args) {
  if (!Array.isArray(args)) fail("arguments", 64);
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--prepare") { if (out.prepare) fail("arguments", 64); out.prepare = true; continue; }
    const field = VALUE_ARGS[args[i]], value = args[++i];
    if (!field || Object.hasOwn(out, field) || typeof value !== "string" || value.startsWith("--")) fail("arguments", 64);
    out[field] = value;
  }
  if (!out.prepare || Object.values(VALUE_ARGS).some((field) => !Object.hasOwn(out, field))) fail("arguments", 64);
  if (out.project !== REPAIR_TARGET.project || out.database !== REPAIR_TARGET.database || !/^[0-9a-f]{40}$/u.test(out.expectedCommit)) fail("target-rejected", 78);
  if (!date(out.startDate) || !date(out.endDate) || out.startDate > out.endDate) fail("arguments", 64);
  return { ...out, pageSize: int(out.pageSize, 500), maxOperationResults: int(out.maxOperationResults, 100000),
    maxBillings: int(out.maxBillings, 100000), maxDailyAttendances: int(out.maxDailyAttendances, 100000),
    maxDailyOperationsByEmployee: int(out.maxDailyOperationsByEmployee, 100000),
    maxSiteEmployeeHistories: int(out.maxSiteEmployeeHistories, 100000), maxCustomers: int(out.maxCustomers, 10000),
    timeoutMs: int(out.timeoutMs, 600000) };
}

export function validateCompanyAllowlist(payload, options) {
  const keys = Object.keys(payload || {}).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["companies", "database", "endDate", "limits", "project", "startDate"].sort()) ||
      payload.project !== options.project || payload.database !== options.database || payload.startDate !== options.startDate ||
      payload.endDate !== options.endDate || !Array.isArray(payload.companies) || payload.companies.length !== 4 ||
      canonicalProjectionDigest(payload.limits) !== canonicalProjectionDigest(limitRecord(options))) fail("target-rejected", 78);
  const seen = new Set();
  for (const item of payload.companies) {
    if (JSON.stringify(Object.keys(item || {}).sort()) !== JSON.stringify(["companyId", "firstPlanDigest", "secondPlanDigest"].sort()) ||
        !safeId(item.companyId) || seen.has(item.companyId) || !sha(item.firstPlanDigest) || item.firstPlanDigest !== item.secondPlanDigest) fail("target-rejected", 78);
    seen.add(item.companyId);
  }
  return payload.companies;
}

function limitRecord(o) { return { pageSize: o.pageSize, maxOperationResults: o.maxOperationResults, maxBillings: o.maxBillings,
  maxDailyAttendances: o.maxDailyAttendances, maxDailyOperationsByEmployee: o.maxDailyOperationsByEmployee,
  maxSiteEmployeeHistories: o.maxSiteEmployeeHistories, maxCustomers: o.maxCustomers, timeoutMs: o.timeoutMs }; }
const revision = (value) => value && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) ?
  { seconds: value.seconds, nanoseconds: value.nanoseconds } : null;

export function buildPrivateRepairSnapshot({ options, companies, inventories }) {
  const writes = [], sources = [], targets = [], companyPlans = [], aggregate = { create: 0, update: 0, extra: 0, blocked: 0, perProjection: {} };
  for (const company of companies) {
    const inventory = inventories.get(company.companyId); if (!inventory) fail("inventory-incomplete");
    const plan = planOperationResultProjections({ ...inventory, startDate: options.startDate, endDate: options.endDate });
    if (!plan.complete || plan.planDigest !== company.firstPlanDigest) fail("plan-changed");
    const bySource = new Map(inventory.operationResults.map((doc) => [doc.id, doc]));
    for (const [projection, field] of Object.entries(REPAIR_COLLECTIONS)) {
      const counts = plan.perProjection[projection]; aggregate.create += counts.missing; aggregate.update += counts.update;
      aggregate.extra += counts.extra; aggregate.blocked += counts.blocked;
      aggregate.perProjection[projection] ||= { create: 0, update: 0, extra: 0 };
      aggregate.perProjection[projection].create += counts.missing; aggregate.perProjection[projection].update += counts.update;
      aggregate.perProjection[projection].extra += counts.extra;
      const current = new Map(inventory[field].map((doc) => [doc.id, doc]));
      for (const detail of plan.details.filter((d) => d.projection === projection && ["missing", "update"].includes(d.action))) {
        const action = detail.action === "missing" ? "create" : "update";
        const path = `Companies/${company.companyId}/${projection}/${detail.key}`;
        const before = current.get(detail.key) || null;
        if ((action === "create" && before) || (action === "update" && (!before || !revision(before.updateTime)))) fail("target-precondition");
        const dependencies = detail.sourceIds.map((id) => {
          const source = bySource.get(id); if (!source || !revision(source.updateTime)) fail("source-precondition");
          return { path: `Companies/${company.companyId}/OperationResults/${id}`, updateTime: revision(source.updateTime), dataDigest: canonicalProjectionDigest(source.data), data: source.data };
        });
        sources.push(...dependencies);
        if (before) targets.push({ path, updateTime: revision(before.updateTime), dataDigest: canonicalProjectionDigest(before.data), data: before.data });
        writes.push({ companyId: company.companyId, projection, path, action, before: before && { updateTime: revision(before.updateTime), dataDigest: canonicalProjectionDigest(before.data), data: before.data }, expected: detail.expected,
          sourceDependencies: dependencies.map(({ data: _data, ...dep }) => dep) });
      }
    }
    companyPlans.push({ companyId: company.companyId, planDigest: plan.planDigest });
  }
  const uniqueSources = [...new Map(sources.map((item) => [item.path, item])).values()].sort((a, b) => a.path.localeCompare(b.path));
  writes.sort((a, b) => a.companyId.localeCompare(b.companyId) || a.path.localeCompare(b.path));
  targets.sort((a, b) => a.path.localeCompare(b.path)); companyPlans.sort((a, b) => a.companyId.localeCompare(b.companyId));
  assertExpectedCounts(aggregate);
  const writePlanDigest = canonicalProjectionDigest(writes.map(({ before, ...write }) => ({ ...write, before: before && { updateTime: before.updateTime, dataDigest: before.dataDigest } })));
  return { schemaVersion: 1, target: REPAIR_TARGET, expectedCommit: options.expectedCommit,
    dates: { start: options.startDate, end: options.endDate }, limits: limitRecord(options), counts: { ...aggregate, write: aggregate.create + aggregate.update },
    companyPlans, sourceDigest: canonicalProjectionDigest(uniqueSources), beforeDigest: canonicalProjectionDigest(targets),
    writePlanDigest, sources: uniqueSources, targets, writes };
}

function assertExpectedCounts(counts) {
  if (counts.create !== REPAIR_COUNTS.create || counts.update !== REPAIR_COUNTS.update || counts.extra !== REPAIR_COUNTS.extra || counts.blocked !== 0) fail("count-mismatch");
  for (const [name, expected] of Object.entries(REPAIR_COUNTS.perProjection)) {
    if (JSON.stringify(counts.perProjection[name]) !== JSON.stringify(expected)) fail("count-mismatch");
  }
}

async function repoState() {
  const run = async (...args) => (await promisify(execFile)("git", args, { cwd: ROOT, windowsHide: true, timeout: 5000, maxBuffer: 65536, encoding: "utf8" })).stdout.trim();
  return { root: (await run("rev-parse", "--show-toplevel")).replaceAll("\\", "/"), branch: await run("branch", "--show-current"), head: await run("rev-parse", "HEAD"), status: await run("status", "--porcelain") };
}

export async function guardRepairRuntime(options, env) {
  try { assertOperationResultProjectionEnvironment(env); } catch { fail("target-rejected", 78); }
  const state = await repoState();
  if (state.root.toLowerCase() !== ROOT.replaceAll("\\", "/").toLowerCase() || state.branch !== REPAIR_TARGET.branch || state.head !== options.expectedCommit || state.status !== "") fail("target-rejected", 78);
  let source; try { source = await readCustomerCredentialFile(env.AIRGUARD_DEV_CREDENTIAL_PATH); } catch { fail("target-rejected", 78); }
  try { validateOperationResultProjectionCredential(source); } catch { fail("target-rejected", 78); }
  return true;
}

export async function createRepairAdmin(options, env) {
  let source; try { source = await readCustomerCredentialFile(env.AIRGUARD_DEV_CREDENTIAL_PATH); } catch { fail("target-rejected", 78); }
  let credential; try { credential = validateOperationResultProjectionCredential(source); } catch { fail("target-rejected", 78); }
  try {
    const require = createRequire(resolve(ROOT, "functions/package.json"));
    const appApi = require("firebase-admin/app"), fireApi = require("firebase-admin/firestore");
    const app = appApi.initializeApp({ credential: appApi.cert(credential), projectId: options.project }, `operation-result-projection-repair-${process.pid}-${Date.now()}`);
    const firestore = fireApi.getFirestore(app, options.database);
    return { app, firestore, FieldValue: fireApi.FieldValue, factories: { Timestamp: fireApi.Timestamp, GeoPoint: fireApi.GeoPoint, reference: (path) => firestore.doc(path) }, deleteApp: appApi.deleteApp };
  } catch { fail("target-rejected", 78); }
}

async function readInventoriesFromDev(options, companies, env) {
  const admin = await createRepairAdmin(options, env); let timer = null;
  try {
    const deadline = Date.now() + options.timeoutMs;
    const withinDeadline = async (promise) => { const remaining = deadline - Date.now(); if (remaining <= 0) fail("timeout");
      return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new RepairError("timeout")), remaining); })]).finally(() => { if (timer) clearTimeout(timer); timer = null; }); };
    const definitions = [["OperationResults", "operationResults", "maxOperationResults"], ["Billings", "billings", "maxBillings"],
      ["DailyAttendances", "dailyAttendances", "maxDailyAttendances"], ["DailyOperationsByEmployee", "dailyOperationsByEmployee", "maxDailyOperationsByEmployee"],
      ["SiteEmployeeHistories", "siteEmployeeHistories", "maxSiteEmployeeHistories"]];
    const result = new Map();
    for (const company of companies) {
      const inventory = {};
      for (const [collection, field, limit] of definitions) {
        try { inventory[field] = await scanProjectionCollection({ firestore: admin.firestore, FieldPath: createRequire(resolve(ROOT, "functions/package.json"))("firebase-admin/firestore").FieldPath,
          companyId: company.companyId, collection, pageSize: options.pageSize, maximum: options[limit], withinDeadline }); }
        catch (error) { fail(typeof error?.code === "string" ? error.code : "response-incomplete"); }
      }
      const preliminary = planOperationResultProjections({ ...inventory, customers: new Map(), startDate: options.startDate, endDate: options.endDate });
      if (preliminary.requiredCustomerIds.size > options.maxCustomers) fail("customer-limit");
      inventory.customers = new Map();
      for (const customerId of [...preliminary.requiredCustomerIds].sort()) {
        if (!safeId(customerId)) fail("customer-id-invalid");
        const snapshot = await withinDeadline(admin.firestore.doc(`Companies/${company.companyId}/Customers/${customerId}`).get());
        if (snapshot.exists) inventory.customers.set(customerId, snapshot.data());
      }
      result.set(company.companyId, inventory);
    }
    return result;
  } finally { if (timer) clearTimeout(timer); await admin.deleteApp(admin.app).catch(() => {}); }
}

export async function executePrepareRepair({ args = [], env = {}, repositoryRoot = ROOT, dependencies = {} } = {}) {
  let lifecycleLock = null, outcome = null;
  try {
    const options = parsePrepareRepairArgs(args);
    const guard = await (dependencies.guard || guardRepairRuntime)(options, env); if (guard === false) fail("target-rejected", 78);
    const validatePath = dependencies.validateArtifactPath || validatePrivateArtifactPath;
    await validatePath(options.companiesFile, { repositoryRoot, allowExisting: true });
    await validatePath(options.snapshotFile, { repositoryRoot, allowExisting: false });
    lifecycleLock = await (dependencies.acquireLock || acquirePrivateLifecycleLock)(`${options.snapshotFile}.lock`, "prepare", { repositoryRoot });
    const allowlistArtifact = await (dependencies.readArtifact || readPrivateArtifact)(options.companiesFile, "operation-result-projection-companies", { repositoryRoot });
    const companies = validateCompanyAllowlist(allowlistArtifact.payload, options);
    const inventories = await (dependencies.readInventories || ((o, c) => readInventoriesFromDev(o, c, env)))(options, companies);
    const snapshot = buildPrivateRepairSnapshot({ options, companies, inventories });
    await (dependencies.writeArtifact || writeNewPrivateArtifact)(options.snapshotFile, "operation-result-projection-snapshot", snapshot, { repositoryRoot });
    outcome = { exitCode: 0, summary: { status: "prepared", complete: true, project: options.project, database: options.database,
      companyCount: companies.length, counts: snapshot.counts } }; return outcome;
  } catch (error) {
    const locked = error?.code === "artifact-exists", badPath = error?.code === "artifact-path";
    const exitCode = error instanceof RepairError ? error.exitCode : locked ? 3 : badPath ? 78 : 70;
    outcome = { exitCode, summary: { status: "blocked", complete: false, code: error instanceof RepairError ? error.code : locked ? "lifecycle-locked" : badPath ? "target-rejected" : "unexpected" } }; return outcome;
  } finally {
    if (lifecycleLock) try { await lifecycleLock.release(); } catch {
      if (outcome) { outcome.exitCode = 70; outcome.summary = { status: "blocked", complete: false, code: "lock-release" }; }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await executePrepareRepair({ args: process.argv.slice(2), env: process.env, repositoryRoot: ROOT });
  process.stdout.write(`${JSON.stringify(result.summary)}\n`); process.exitCode = result.exitCode;
}
