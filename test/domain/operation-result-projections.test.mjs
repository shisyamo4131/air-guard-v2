import test from "node:test";
import assert from "node:assert/strict";
import { syncOperationResultProjections } from "../../functions/modules/operations/syncOperationResultProjections.js";

function dependencies({ failures = [] } = {}) {
  const calls = [];
  const call = async (name, args) => {
    calls.push([name, ...args]);
    if (failures.includes(name)) throw Object.assign(new Error("synthetic"), { code: "synthetic" });
  };
  return {
    calls,
    value: {
      removeOperationResultFromBilling: (args) => call("billing", [args]),
      addOperationResultToBilling: (args) => call("billing", [args]),
      syncOperationResultToBilling: (args) => call("billing", [args]),
      syncOperationResultToDailyAttendances: (args) => call("daily-attendance", [args]),
      syncOperationResultToDailyOperationsByEmployee: (args) => call("daily-operations-by-employee", [args]),
      rebuildHistories: (...args) => call("site-employee-histories", args),
    },
  };
}

const before = { docId: "result", siteId: "old-site", date: "2026-09-01", employeeIds: ["a"] };
const after = { docId: "result", siteId: "new-site", date: "2026-09-02", employeeIds: ["b"] };

for (const event of [
  { name: "create", before: null, after },
  { name: "delete", before, after: null },
  { name: "update", before, after },
]) test(`${event.name} runs all projections in their established order`, async () => {
  const state = dependencies();
  await syncOperationResultProjections({ companyId: "company", ...event, dependencies: state.value });
  assert.deepEqual(state.calls.map(([name]) => name), [
    "billing",
    "daily-attendance",
    "daily-operations-by-employee",
    "site-employee-histories",
    ...(event.name === "update" ? ["site-employee-histories"] : []),
  ]);
  if (event.name === "create") assert.deepEqual(state.calls, [
    ["billing", { companyId: "company", doc: after }],
    ["daily-attendance", { companyId: "company", beforeData: null, afterData: after }],
    ["daily-operations-by-employee", { companyId: "company", beforeData: null, afterData: after }],
    ["site-employee-histories", "company", "new-site", ["b"]],
  ]);
  if (event.name === "delete") assert.deepEqual(state.calls, [
    ["billing", { companyId: "company", operationResult: before }],
    ["daily-attendance", { companyId: "company", beforeData: before, afterData: null }],
    ["daily-operations-by-employee", { companyId: "company", beforeData: before, afterData: null }],
    ["site-employee-histories", "company", "old-site", ["a"]],
  ]);
  if (event.name === "update") assert.deepEqual(state.calls, [
    ["billing", { companyId: "company", before, after }],
    ["daily-attendance", { companyId: "company", beforeData: before, afterData: after }],
    ["daily-operations-by-employee", { companyId: "company", beforeData: before, afterData: after }],
    ["site-employee-histories", "company", "old-site", ["a", "b"]],
    ["site-employee-histories", "company", "new-site", ["a", "b"]],
  ]);
});

test("a Billing failure does not stop attendance, daily operations, or histories", async () => {
  const state = dependencies({ failures: ["billing"] });
  const reported = [];
  await assert.rejects(
    syncOperationResultProjections({ companyId: "company", before: null, after, dependencies: state.value, onProjectionFailure: ({ projection }) => reported.push(projection) }),
    (error) => error instanceof AggregateError && error.projections.join(",") === "billing",
  );
  assert.deepEqual(state.calls.map(([name]) => name), ["billing", "daily-attendance", "daily-operations-by-employee", "site-employee-histories"]);
  assert.deepEqual(reported, ["billing"]);
});

test("multiple failures are all reported after every projection is attempted", async () => {
  const state = dependencies({ failures: ["daily-attendance", "site-employee-histories"] });
  await assert.rejects(
    syncOperationResultProjections({ companyId: "company", before: null, after, dependencies: state.value }),
    (error) => error instanceof AggregateError && assert.deepEqual(error.projections, ["daily-attendance", "site-employee-histories"]) === undefined,
  );
  assert.deepEqual(state.calls.map(([name]) => name), ["billing", "daily-attendance", "daily-operations-by-employee", "site-employee-histories"]);
});

test("a failing failure reporter cannot stop projection isolation or expose the original error", async () => {
  const state = dependencies({ failures: ["billing", "daily-attendance"] });
  let caught;
  try {
    await syncOperationResultProjections({
      companyId: "company",
      before: null,
      after,
      dependencies: state.value,
      onProjectionFailure: () => { throw new Error("reporter-sensitive-message"); },
    });
  } catch (error) {
    caught = error;
  }
  assert.deepEqual(state.calls.map(([name]) => name), ["billing", "daily-attendance", "daily-operations-by-employee", "site-employee-histories"]);
  assert.ok(caught instanceof AggregateError);
  assert.deepEqual(caught.projections, ["billing", "daily-attendance"]);
  assert.deepEqual(caught.errors, []);
  assert.equal(caught.message.includes("synthetic"), false);
  assert.equal(caught.message.includes("reporter-sensitive-message"), false);
});

test("history input errors are isolated from the first three update projections", async () => {
  const state = dependencies();
  await assert.rejects(syncOperationResultProjections({
    companyId: "company",
    before: { ...before, employeeIds: null },
    after,
    dependencies: state.value,
  }));
  assert.deepEqual(state.calls.map(([name]) => name), ["billing", "daily-attendance", "daily-operations-by-employee"]);
});
