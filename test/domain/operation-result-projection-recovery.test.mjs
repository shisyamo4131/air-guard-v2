import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Customer } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { operation } from "./employeeBackgroundTestSupport.mjs";
import {
  canonicalizeProjectionValue, planOperationResultProjections,
} from "../../scripts/lib/operation-result-projection-plan.mjs";
import {
  executeOperationResultProjectionCheck, parseOperationResultProjectionArgs,
  scanProjectionCollection, validateOperationResultProjectionCredential,
} from "../../scripts/check-operation-result-projections.mjs";

const HEAD = "1e3ae9cb0ffa39038c39d328c893be5da905f0fd";
const COMPANY = "company-private-value";
const ROOT = fileURLToPath(new URL("../../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/u, "");
const CUSTOMER = new Customer({ docId: "customer" }).toObject();
const doc = (data, updateTime = new Timestamp(1788200000, 123456789)) => ({ id: data.docId, data, updateTime });
const input = (operations, extra = {}) => ({
  operationResults: operations.map((raw) => doc(raw)),
  customers: new Map([["customer", CUSTOMER]]),
  startDate: "2026-09-01", endDate: "2026-09-30", ...extra,
});

function missingAsCurrent(plan) {
  const output = {};
  for (const [name, field] of [["Billings", "billings"], ["DailyAttendances", "dailyAttendances"],
    ["DailyOperationsByEmployee", "dailyOperationsByEmployee"], ["SiteEmployeeHistories", "siteEmployeeHistories"]]) {
    output[field] = plan.details.filter((entry) => entry.projection === name && entry.action === "missing")
      .map((entry) => doc(entry.expected));
  }
  return output;
}

test("planner groups all four projections and includes full-inventory dependencies outside the selected dates", () => {
  const before = operation(["employee-a", "employee-b"], "2026-08-31", { docId: "outside-result" });
  before.billingDate = "2026-09-01";
  before.billingDateAt = new Date("2026-08-31T15:00:00.000Z");
  const target = operation(["employee-a", "employee-b"], "2026-09-01", { docId: "target-result" });
  const plan = planOperationResultProjections(input([before, target]));
  assert.deepEqual(plan.candidateCounts, {
    Billings: 1, DailyAttendances: 2, DailyOperationsByEmployee: 2, SiteEmployeeHistories: 2,
  });
  const billing = plan.details.find((entry) => entry.projection === "Billings" && entry.action === "missing").expected;
  assert.equal(billing.operationResults.length, 2, "Billing uses the complete company inventory for a candidate key");
  const history = plan.details.find((entry) => entry.projection === "SiteEmployeeHistories" && entry.action === "missing").expected;
  assert.equal(history.firstDate, "2026-08-31");
  assert.equal(history.lastDate, "2026-09-01");
});

test("non-billable and overnight operations use the existing runtime calculation contracts", () => {
  const nonBillable = operation(["employee-a"], "2026-09-01", { docId: "not-billed", isBillable: false });
  nonBillable.isBillable = false;
  const overnight = operation(["employee-a"], "2026-09-02", { docId: "overnight", isStartNextDay: true });
  const plan = planOperationResultProjections(input([nonBillable, overnight]));
  assert.equal(plan.candidateCounts.Billings, 1);
  const attendanceKeys = plan.details.filter((entry) => entry.projection === "DailyAttendances").map((entry) => entry.key);
  const dailyKeys = plan.details.filter((entry) => entry.projection === "DailyOperationsByEmployee").map((entry) => entry.key);
  assert.ok(attendanceKeys.includes("employee-a_2026-09-03"));
  assert.ok(dailyKeys.includes("employee-a_2026-09-02"));
});

test("missing, noop, update and stale extra are classified without a delete plan", () => {
  const raw = operation(["employee-a"], "2026-09-01", { docId: "target-result" });
  const missing = planOperationResultProjections(input([raw]));
  assert.equal(Object.values(missing.perProjection).every((value) => value.missing > 0), true);
  const current = missingAsCurrent(missing);
  const noop = planOperationResultProjections(input([raw], current));
  assert.equal(Object.values(noop.perProjection).every((value) => value.noop > 0), true);
  const changed = Object.fromEntries(Object.entries(current).map(([key, value]) =>
    [key, value.map((item) => ({ ...item, data: { ...item.data } }))]));
  const stale = { ...current.dailyOperationsByEmployee[0].data };
  stale.docId = "employee-a_2026-09-02";
  stale.date = "2026-09-02";
  stale.dateAt = new Date("2026-09-01T15:00:00.000Z");
  changed.dailyOperationsByEmployee.push(doc(stale));
  const corrected = operation(["employee-a"], "2026-09-01", { docId: "target-result", startTime: "07:00" });
  const differences = planOperationResultProjections(input([corrected], changed));
  assert.equal(differences.perProjection.DailyAttendances.update, 1);
  assert.equal(differences.perProjection.DailyOperationsByEmployee.extra, 1);
  assert.equal(differences.details.some((entry) => entry.action === "delete"), false);
});

test("Billing preserves manual fields and Timestamp nanoseconds while recalculating owned fields", () => {
  const first = operation(["employee-a"], "2026-09-01", { docId: "first" });
  const initial = planOperationResultProjections(input([first]));
  const current = missingAsCurrent(initial);
  const nano = new Timestamp(1788200000, 987654321);
  Object.assign(current.billings[0].data, {
    status: "CLOSED", paymentDueDateAt: nano, manualAdjustment: 777,
    privateMetadata: { marker: nano },
  });
  const second = operation(["employee-a"], "2026-09-01", { docId: "second" });
  const plan = planOperationResultProjections(input([first, second], current));
  const update = plan.details.find((entry) => entry.projection === "Billings" && entry.action === "update");
  assert.equal(update.expected.status, "CLOSED");
  assert.strictEqual(update.expected.paymentDueDateAt, nano);
  assert.equal(update.expected.manualAdjustment, 777);
  assert.strictEqual(update.expected.privateMetadata.marker, nano);
});

test("missing Customer blocks Billing only and malformed aggregate handling stays projection-local", () => {
  const raw = operation(["employee-a"], "2026-09-01", { docId: "target-result" });
  const noCustomer = planOperationResultProjections(input([raw], { customers: new Map() }));
  assert.equal(noCustomer.perProjection.Billings.blocked, 1);
  assert.equal(noCustomer.perProjection.DailyAttendances.missing, 1);
  assert.equal(noCustomer.perProjection.DailyOperationsByEmployee.missing, 1);
  assert.equal(noCustomer.perProjection.SiteEmployeeHistories.missing, 1);
  const current = missingAsCurrent(planOperationResultProjections(input([raw])));
  current.billings[0].data.operationResults = "broken";
  const malformed = planOperationResultProjections(input([raw], current));
  assert.equal(malformed.perProjection.Billings.blocked, 1);
  assert.equal(malformed.perProjection.DailyAttendances.noop, 1);
});

test("history ties are blockers unless stored boundary IDs are valid and all projected fields match", () => {
  const first = operation(["employee-a"], "2026-09-01", { docId: "same-day-a" });
  const second = operation(["employee-a"], "2026-09-01", { docId: "same-day-b" });
  const blocked = planOperationResultProjections(input([first, second]));
  assert.equal(blocked.perProjection.SiteEmployeeHistories.blocked, 1);
  const current = [{ id: "site_employee-a", updateTime: new Timestamp(1788200000, 1), data: {
    docId: "site_employee-a", siteId: "site", employeeId: "employee-a",
    firstDate: "2026-09-01", firstDateAt: new Date("2026-08-31T15:00:00.000Z"),
    firstOperationResultId: "same-day-a", lastDate: "2026-09-01",
    lastDateAt: new Date("2026-08-31T15:00:00.000Z"), lastOperationResultId: "same-day-b",
  } }];
  const stable = planOperationResultProjections(input([first, second], { siteEmployeeHistories: current }));
  assert.equal(stable.perProjection.SiteEmployeeHistories.noop, 1);
  current[0].data.lastDate = "2026-09-02";
  const mismatch = planOperationResultProjections(input([first, second], { siteEmployeeHistories: current }));
  assert.equal(mismatch.perProjection.SiteEmployeeHistories.blocked, 1);
});

test("history range candidates detect deleted boundaries as extra or safe update and block invalid dates", () => {
  const base = {
    docId: "site_employee-a", siteId: "site", employeeId: "employee-a",
    firstDate: "2026-09-01", firstDateAt: new Date("2026-08-31T15:00:00.000Z"),
    firstOperationResultId: "deleted-result", lastDate: "2026-09-01",
    lastDateAt: new Date("2026-08-31T15:00:00.000Z"), lastOperationResultId: "deleted-result",
  };
  const range = { startDate: "2026-09-01", endDate: "2026-09-01", customers: new Map() };
  const extra = planOperationResultProjections({ ...range, siteEmployeeHistories: [doc(base)] });
  assert.equal(extra.perProjection.SiteEmployeeHistories.extra, 1);

  const remaining = operation(["employee-a"], "2026-09-02", { docId: "remaining-result" });
  const stale = { ...base, lastDate: "2026-09-02", lastDateAt: new Date("2026-09-01T15:00:00.000Z"),
    lastOperationResultId: "remaining-result" };
  const update = planOperationResultProjections({ ...range, operationResults: [doc(remaining)],
    siteEmployeeHistories: [doc(stale)] });
  assert.equal(update.perProjection.SiteEmployeeHistories.update, 1);

  const invalid = planOperationResultProjections({ ...range,
    siteEmployeeHistories: [doc({ ...base, firstDate: "not-a-date" })] });
  assert.equal(invalid.perProjection.SiteEmployeeHistories.blocked, 1);
  const reversed = planOperationResultProjections({ ...range,
    siteEmployeeHistories: [doc({ ...base, firstDate: "2026-09-02", lastDate: "2026-09-01",
      firstDateAt: new Date("2026-09-01T15:00:00.000Z") })] });
  assert.deepEqual(reversed.perProjection.SiteEmployeeHistories,
    { missing: 0, update: 0, noop: 0, extra: 0, blocked: 1 });
  for (const plan of [extra, update, invalid, reversed]) {
    assert.equal(plan.details.some((entry) => entry.action === "delete"), false);
  }
});

function fakeCollection(documents) {
  const calls = [];
  function query(cursor = null, maximum = null) {
    return {
      orderBy(field, direction) { calls.push(["orderBy", field, direction]); return this; },
      limit(value) { calls.push(["limit", value]); return query(cursor, value); },
      startAfter(document) { calls.push(["startAfter", document.id]); return query(document.id, maximum); },
      async get() {
        const start = cursor === null ? 0 : documents.findIndex((item) => item.id === cursor) + 1;
        return { docs: documents.slice(start, start + maximum) };
      },
    };
  }
  return { calls, firestore: { collection: () => query() } };
}

function snapshot(id) {
  return { id, ref: { path: `Companies/${COMPANY}/OperationResults/${id}` },
    updateTime: new Timestamp(1788200000, 1), data: () => ({ docId: id }) };
}

test("pagination proves exact-limit completion and rejects one-document overflow", async () => {
  const exact = fakeCollection([snapshot("a"), snapshot("b")]);
  const rows = await scanProjectionCollection({ firestore: exact.firestore,
    FieldPath: { documentId: () => "__name__" }, companyId: COMPANY, collection: "OperationResults",
    pageSize: 2, maximum: 2, withinDeadline: (promise) => promise });
  assert.equal(rows.length, 2);
  assert.deepEqual(exact.calls.filter(([kind]) => kind === "limit").map(([, value]) => value), [2, 1]);
  const overflow = fakeCollection([snapshot("a"), snapshot("b"), snapshot("c")]);
  await assert.rejects(() => scanProjectionCollection({ firestore: overflow.firestore,
    FieldPath: { documentId: () => "__name__" }, companyId: COMPANY, collection: "OperationResults",
    pageSize: 2, maximum: 2, withinDeadline: (promise) => promise }), { message: "document-limit" });
  const incomplete = { collection: () => ({ orderBy() { return this; }, limit() { return this; },
    async get() { return {}; } }) };
  await assert.rejects(() => scanProjectionCollection({ firestore: incomplete,
    FieldPath: { documentId: () => "__name__" }, companyId: COMPANY, collection: "OperationResults",
    pageSize: 2, maximum: 2, withinDeadline: (promise) => promise }), { message: "response-incomplete" });
});

const args = (company = COMPANY) => [
  "--read-only", "--project", "air-guard-v2-dev", "--database", "(default)",
  "--company-id", company, "--start-date", "2026-09-01", "--end-date", "2026-09-30",
  "--page-size", "100", "--max-operation-results", "1000", "--max-billings", "1000",
  "--max-daily-attendances", "1000", "--max-daily-operations-by-employee", "1000",
  "--max-site-employee-histories", "1000", "--max-customers", "100", "--timeout-ms", "30000",
  "--expected-commit", HEAD,
];
const credential = JSON.stringify({ type: "service_account", project_id: "air-guard-v2-dev",
  client_email: "reader@air-guard-v2-dev.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----\n" });

function execution(overrides = {}) {
  let initialized = 0;
  const state = {
    initialized: () => initialized,
    options: {
      args: args(), env: { AIRGUARD_DEV_CREDENTIAL_PATH: "C:\\fixed\\dev-reader.json" },
      getRepoState: async () => ({ root: ROOT, branch: "main", head: HEAD, status: "" }),
      readCredentialFile: async () => credential,
      adminFactory: async () => ({
        initializeApp: () => { initialized += 1; return {}; }, cert: (value) => value,
        getFirestore: () => ({}), deleteApp: async () => {}, FieldPath: {},
      }),
      scanCollection: async () => [], readCustomers: async () => new Map(), ...overrides,
    },
  };
  return state;
}

test("argument, environment, credential and repository guards reject before reads or Admin initialization", async () => {
  assert.throws(() => parseOperationResultProjectionArgs([...args(), "--apply"]));
  assert.throws(() => parseOperationResultProjectionArgs(args().map((value) => value === "air-guard-v2-dev" ? "air-guard-v2" : value)));
  assert.throws(() => validateOperationResultProjectionCredential(credential.replace("air-guard-v2-dev", "air-guard-v2")));
  for (const overrides of [
    { args: args().slice(1) },
    { env: { AIRGUARD_DEV_CREDENTIAL_PATH: "C:\\fixed\\dev-reader.json", FIRESTORE_EMULATOR_HOST: "localhost:8080" } },
    { getRepoState: async () => ({ root: ROOT, branch: "other", head: HEAD, status: "" }) },
    { getRepoState: async () => ({ root: ROOT, branch: "main", head: HEAD, status: "dirty" }) },
    { readCredentialFile: async () => { throw new Error("private"); } },
  ]) {
    const harness = execution(overrides);
    const result = await executeOperationResultProjectionCheck(harness.options);
    assert.ok([64, 78].includes(result.exitCode));
    assert.equal(harness.initialized(), 0);
  }
});

test("digest is stable, revision-sensitive, and safe summary contains no raw subject values", async () => {
  const raw = operation(["employee-secret"], "2026-09-01", {
    docId: "result-secret", siteId: "site-secret", customerId: "customer-secret",
  });
  const customer = new Customer({ docId: "customer-secret", name: "name-secret" }).toObject();
  const first = planOperationResultProjections({ ...input([raw]), customers: new Map([["customer-secret", customer]]) });
  const second = planOperationResultProjections({ ...input([raw]), customers: new Map([["customer-secret", customer]]) });
  assert.equal(first.planDigest, second.planDigest);
  const current = missingAsCurrent(first);
  const one = planOperationResultProjections({ ...input([raw], current), customers: new Map([["customer-secret", customer]]) });
  current.billings[0].updateTime = new Timestamp(1788200000, 2);
  const two = planOperationResultProjections({ ...input([raw], current), customers: new Map([["customer-secret", customer]]) });
  assert.notEqual(one.planDigest, two.planDigest);
  assert.deepEqual(canonicalizeProjectionValue(new Date(1788200000123)),
    canonicalizeProjectionValue(new Timestamp(1788200000, 123000000)));

  const harness = execution({
    args: args("company-secret"),
    scanCollection: async ({ collection }) => collection === "OperationResults" ? [doc(raw)] : [],
    readCustomers: async () => new Map([["customer-secret", customer]]),
  });
  const result = await executeOperationResultProjectionCheck(harness.options);
  assert.equal(result.exitCode, 2);
  const report = JSON.stringify(result.summary);
  for (const privateValue of ["company-secret", "result-secret", "employee-secret", "customer-secret",
    "site-secret", "name-secret", "reader@air-guard-v2-dev.iam.gserviceaccount.com"]) {
    assert.equal(report.includes(privateValue), false, privateValue);
  }
});

test("imported checker has no side effects and clean injected execution returns exit 0", async () => {
  const harness = execution();
  const result = await executeOperationResultProjectionCheck(harness.options);
  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.status, "clean");
  assert.equal(result.summary.complete, true);
  assert.equal(harness.initialized(), 1);
});

test("CLI exit classes stay distinct and direct missing-argument invocation emits one safe JSON line", async () => {
  const incomplete = execution({ scanCollection: async ({ collection }) => {
    if (collection === "OperationResults") {
      return scanProjectionCollection({ firestore: { collection: () => ({ orderBy() { return this; },
        limit() { return this; }, async get() { return {}; } }) }, FieldPath: { documentId: () => "__name__" },
      companyId: COMPANY, collection, pageSize: 1, maximum: 1, withinDeadline: (promise) => promise });
    }
    return [];
  } });
  assert.equal((await executeOperationResultProjectionCheck(incomplete.options)).exitCode, 3);
  const unexpected = execution({ adminFactory: async () => { throw new Error("private"); } });
  assert.equal((await executeOperationResultProjectionCheck(unexpected.options)).exitCode, 70);

  const child = spawnSync(process.execPath, [fileURLToPath(new URL(
    "../../scripts/check-operation-result-projections.mjs", import.meta.url,
  ))], { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024, encoding: "utf8" });
  assert.equal(child.status, 64);
  assert.equal(child.stderr, "");
  const lines = child.stdout.trim().split(/\r?\n/u);
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    status: "blocked", complete: false, findingCodeCounts: { arguments: 1 },
  });
});
