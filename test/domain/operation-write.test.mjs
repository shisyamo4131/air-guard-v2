import test from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { Site, SiteOperationSchedule, OperationResult, ArrangementNotification } from "@shisyamo4131/air-guard-v2-schemas";
import { saveOperation } from "../../functions/modules/operations/saveOperation.js";
import { expectedForOperation, notificationExpectation, parseOperationCommand } from "../../functions/shared/operationWriteContract.js";
import { encodeExpected } from "../../functions/shared/employeeContract.js";

for (const kind of ["schedule", "result"]) test(`${kind} duplicate reads the original raw and preserves copied workers/articles/adjustment without granting billing edits`, async () => {
  const raw = operation(kind), stamp = new Timestamp(1788200000, 123456789);
  raw.employees[0].unknown = { stamp };
  if (kind === "result") { raw.useAdjusted = true; raw.adjustedQuantityBase = 3; raw.articles = [{ articleId: "article", price: 200, quantity: 2, unknown: { stamp } }]; }
  const state = harness(raw, { kind });
  const copy = command(raw, "duplicate", { dateAt: "2026-09-02" }, { kind, documentId: "copy", sourceId: "operation", ...(kind === "schedule" ? { siteStatuses: { site: "ACTIVE" } } : {}) });
  await state.save(copy);
  const saved = state.records.get(path(kind, "copy"));
  assert.equal(saved.docId, "copy"); assert.equal(saved.date, "2026-09-02");
  assert.deepEqual(saved.employeeIds, raw.employeeIds); assert.equal(saved.employees[0].unknown.stamp, stamp);
  assert.equal(state.employeesRead().length, 2); assert.strictEqual(state.records.get(path(kind)), raw);
  if (kind === "schedule") { assert.equal(saved.operationResultId, null); assert.ok(saved.workers.every((row) => row.siteOperationScheduleId === "copy" && row.hasNotification === false)); }
  else { assert.equal(saved.siteOperationScheduleId, null); assert.equal(saved.adjustedQuantityBase, 3); assert.equal(saved.useAdjusted, true); assert.equal(saved.articles[0].unknown.stamp, stamp); }
  const before = state.writes.length;
  await assert.rejects(state.save(copy), { code: "already-exists" }); assert.equal(state.writes.length, before);
  state.records.set(path(kind), { ...raw, remarks: "parallel update" });
  await assert.rejects(state.save({ ...copy, documentId: "other-copy" }), { code: "aborted" }); assert.equal(state.writes.length, before);
});

test("duplicate rejects a missing/locked source or missing Employee before writing and validates the source expectation", async () => {
  const raw = operation("result"), state = harness(raw, { kind: "result" });
  const copy = command(raw, "duplicate", { dateAt: "2026-09-02" }, { kind: "result", documentId: "copy", sourceId: "operation" });
  state.records.delete(`${root}/Employees/employee-a`);
  await assert.rejects(state.save(copy), { code: "failed-precondition" }); assert.equal(state.writes.length, 0);
  state.records.set(`${root}/Employees/employee-a`, {});
  const locked = { ...raw, isLocked: true }; state.records.set(path("result"), locked);
  await assert.rejects(state.save(command(locked, "duplicate", copy.changes, { ...copy, expected: undefined })), { code: "failed-precondition" }); assert.equal(state.writes.length, 0);
  state.records.delete(path("result"));
  await assert.rejects(state.save(copy), { code: "not-found" }); assert.equal(state.writes.length, 0);
});

test("result duplicate rejects billing aliases of source/destination in either order and permits independent billing", async () => {
  const raw = operation("result");
  for (const action of ["lock", "adjusted"]) for (const target of ["operation", "copy"]) for (const reversed of [false, true]) {
    const state = harness(raw, { kind: "result", actor: { isAdmin: true } });
    const duplicate = command(raw, "duplicate", { dateAt: "2026-09-02" }, { kind: "result", documentId: "copy", sourceId: "operation" });
    const billing = command(raw, action, action === "lock" ? { desiredLocked: true } : { useAdjusted: true, adjustedQuantityBase: 4 }, { kind: "billing", documentId: target });
    await assert.rejects(state.save(...(reversed ? [billing, duplicate] : [duplicate, billing])), { code: "invalid-argument" });
    assert.equal(state.writes.length, 0); assert.equal(state.records.has(path("result", "copy")), false);
  }
  const state = harness(raw, { kind: "result", actor: { isAdmin: true } });
  const other = { ...raw, docId: "other" }; state.records.set(path("result", "other"), other);
  await state.save(command(raw, "duplicate", { dateAt: "2026-09-02" }, { kind: "result", documentId: "copy", sourceId: "operation" }), command(other, "lock", { desiredLocked: true }, { kind: "billing" }));
  assert.equal(state.records.get(path("result", "other")).isLocked, true);
  assert.equal(state.records.get(path("result", "copy")).isLocked, false);
  assert.strictEqual(state.records.get(path("result")), raw);
});

test("move then add uses the exact original anchor after rows have changed order", async () => {
  const model = new SiteOperationSchedule(operation()); model.addWorker({ id: "employee-c", isEmployee: true }, -1);
  const raw = model.toObject(), state = harness(raw); state.records.set(`${root}/Employees/new`, {});
  await state.save(command(raw, "workers", {}, { rowAction: "move", array: "employees", position: 2, destination: 0 }), command(raw, "workers", { id: "new" }, { rowAction: "add", array: "employees", position: 0 }));
  assert.deepEqual(state.records.get(path("schedule")).employeeIds, ["employee-c", "new", "employee-a", "employee-b"]);
});

test("Site revision legacy absence becomes one; malformed and exhausted counters reject all writes", async () => {
  for (const revision of [undefined, -1, 0.5, null, "1", Number.MAX_SAFE_INTEGER]) {
    const state = harness(null), site = state.records.get(`${root}/Sites/site`);
    if (revision === undefined) delete site.scheduleRevision; else site.scheduleRevision = revision;
    const create = command(null, "create", { siteId: "site", securityType: "TRAFFIC", dateAt: "2026-09-01", startTime: "08:00", endTime: "17:00", requiredPersonnel: 2 }, { siteStatuses: { site: "ACTIVE" } });
    if (revision === undefined) { await state.save(create); assert.equal(state.records.get(`${root}/Sites/site`).scheduleRevision, 1); }
    else { await assert.rejects(state.save(create), { code: "failed-precondition" }); assert.equal(state.writes.length, 0); }
  }
});

test("bulk Site boundary accepts eight unique Sites and rejects nine or a later invalid Site atomically", async () => {
  for (const count of [8, 9]) {
    const state = harness(null), commands = [], site = state.records.get(`${root}/Sites/site`);
    for (let index = 0; index < count; index++) {
      const siteId = `site-${index}`; state.records.set(`${root}/Sites/${siteId}`, { ...site, docId: siteId, unknown: { kept: true } });
      commands.push(command(null, "create", { siteId, securityType: "TRAFFIC", dateAt: "2026-09-01", startTime: "08:00", endTime: "17:00", requiredPersonnel: 2 }, { documentId: `operation-${index}`, siteStatuses: { [siteId]: "ACTIVE" } }));
    }
    if (count === 8) {
      await state.save(...commands); assert.equal(state.writes.filter(([type]) => type === "create").length, 8);
      for (let index = 0; index < count; index++) { const saved = state.records.get(`${root}/Sites/site-${index}`); assert.equal(saved.scheduleRevision, 5); assert.deepEqual(saved.unknown, { kept: true }); }
    } else { await assert.rejects(state.save(...commands), { code: "invalid-argument" }); assert.equal(state.writes.length, 0); }
    const failed = harness(null); for (let index = 0; index < count; index++) failed.records.set(`${root}/Sites/site-${index}`, { ...site, isTemporary: index === count - 1 });
    await assert.rejects(failed.save(...commands), { code: "aborted" }); assert.equal(failed.writes.length, 0);
  }
});

test("Site move bumps old and new revisions, checks both states, and unrelated updates preserve raw without Site reads", async () => {
  const raw = operation(), state = harness(raw), oldSite = state.records.get(`${root}/Sites/site`);
  state.records.set(`${root}/Sites/next`, { ...oldSite, docId: "next", status: "TERMINATED", scheduleRevision: 8 });
  const moving = command(raw, "overview", { siteId: "next", dateAt: "2026-09-02" }, { siteStatuses: { site: "ACTIVE", next: "ACTIVE" } });
  await assert.rejects(state.save(moving), { code: "aborted" }); assert.equal(state.writes.length, 0);
  moving.siteStatuses.next = "TERMINATED"; await state.save(moving);
  assert.equal(state.records.get(`${root}/Sites/site`).scheduleRevision, 5); assert.equal(state.records.get(`${root}/Sites/next`).scheduleRevision, 9);
  const saved = state.records.get(path("schedule")), count = state.reads.length;
  await state.save(command(saved, "overview", { remarks: "only remarks" }));
  assert.equal(state.reads.slice(count).some((key) => key.includes("/Sites/")), false);
  assert.deepEqual(state.records.get(path("schedule")).unknown, raw.unknown);
});

test("Customer/Site existence is required for new references but unrelated result updates preserve a legacy reference", async () => {
  const raw = operation("result"), state = harness(raw, { kind: "result" });
  state.records.delete(`${root}/Sites/site`); state.records.delete(`${root}/Customers/customer`);
  await state.save(command(raw, "overview", { remarks: "legacy correction" }, { kind: "result" }));
  const saved = state.records.get(path("result")); assert.equal(saved.customerId, raw.customerId); assert.equal(saved.siteId, raw.siteId);
  await state.save(command(saved, "delete", {}, { kind: "result" })); assert.equal(state.records.has(path("result")), false);
});

const root = "Companies/company";
const identity = { uid: "actor", companyId: "company", isSuperUser: false };
const path = (kind, id = "operation") => `${root}/${kind === "schedule" ? "SiteOperationSchedules" : "OperationResults"}/${id}`;
function operation(kind = "schedule", ids = ["employee-a", "employee-b"]) {
  const Schema = kind === "schedule" ? SiteOperationSchedule : OperationResult;
  const model = new Schema({ docId: "operation", siteId: "site", securityType: "TRAFFIC", dateAt: new Date("2026-09-01T00:00:00+09:00"), startTime: "08:00", endTime: "17:00", requiredPersonnel: 2 });
  for (const id of ids) model.addWorker({ id, isEmployee: true }, -1);
  model.addWorker({ id: "outsourcer", isEmployee: false }, -1);
  return { ...model.toObject(), ...(kind === "schedule" ? {} : { customerId: "customer" }), unknown: { retained: true } };
}
function command(raw, action, changes = {}, extras = {}) {
  const result = { kind: "schedule", documentId: raw?.docId || "operation", action, changes, ...extras };
  result.expected = expectedForOperation(raw, result);
  return result;
}
function harness(raw = operation(), options = {}) {
  const site = new Site({ docId: "site", customerId: "customer", status: "ACTIVE", securityType: "TRAFFIC" }).toObject();
  const records = new Map([
    [`${root}/Users/actor`, { docId: "actor", companyId: "company", isAdmin: false, roles: ["controller"], disabled: false, isTemporary: false, ...options.actor }],
    ["System/system", { isMaintenance: false }],
    [`${root}/Sites/site`, { ...site, isTemporary: false, scheduleRevision: 4 }],
    [`${root}/Customers/customer`, { docId: "customer" }],
  ]);
  if (raw) records.set(path(options.kind || "schedule"), raw);
  for (const id of ["employee-a", "employee-b", "employee-c"]) records.set(`${root}/Employees/${id}`, { docId: id, employmentStatus: "RESIGNED" });
  const reads = [], writes = [];
  let auths = 0;
  const snapshot = (recordPath, data) => ({ id: recordPath.split("/").at(-1), exists: data !== undefined, data: () => data });
  const query = (queryPath, filters = [], order = null, limit = null) => ({ path: queryPath, filters, order, limitValue: limit,
    where: (field, operator, value) => query(queryPath, [...filters, [field, operator, value]], order, limit),
    orderBy: (field, direction) => query(queryPath, filters, [field, direction], limit),
    limit: (amount) => query(queryPath, filters, order, amount),
  });
  const firestore = { doc: (recordPath) => ({ path: recordPath }), collection: (queryPath) => query(queryPath), runTransaction: async (callback) => {
    const pending = [];
    const result = await callback({
      get: async (ref) => {
        assert.equal(pending.length, 0, "all reads must precede every write"); reads.push(ref.path);
        if (!ref.filters) return snapshot(ref.path, records.get(ref.path));
        let found = [...records].filter(([key, value]) => key.startsWith(`${ref.path}/`) && key.split("/").length === ref.path.split("/").length + 1 && ref.filters.every(([field, op, expected]) => op === "==" && value[field] === expected));
        if (ref.order) found.sort((a, b) => (a[1][ref.order[0]] - b[1][ref.order[0]]) * (ref.order[1] === "desc" ? -1 : 1));
        if (ref.limitValue) found = found.slice(0, ref.limitValue);
        return { docs: found.map(([key, value]) => snapshot(key, value)) };
      },
      create: (ref, value) => pending.push(["create", ref.path, value]),
      update: (ref, value) => pending.push(["update", ref.path, value]),
      delete: (ref) => pending.push(["delete", ref.path]),
    });
    for (const [type, key, value] of pending) {
      if (type === "delete") records.delete(key);
      else records.set(key, type === "create" ? value : { ...records.get(key), ...value });
    }
    writes.push(...pending);
    return result;
  } };
  return { records, reads, writes, save: (...operations) => saveOperation({ firestore, input: { operations }, timestamp: () => new Timestamp(1790000000, 123456789), resolveIdentity: async () => { auths++; return options.identity?.(auths) || identity; } }), employeesRead: () => reads.filter((key) => key.startsWith(`${root}/Employees/`)) };
}

test("schedule worker row operations preserve unknown raw and nanos, reject stale positions, and only read added IDs", async () => {
  const raw = operation();
  const stamp = new Timestamp(1788200000, 123456789);
  raw.employees[0].unknown = { stamp };
  raw.employees[0].createdAt = stamp;
  const state = harness(raw);
  await state.save(command(raw, "workers", { startTime: "09:00" }, { rowAction: "update", array: "employees", position: 0 }));
  const saved = state.records.get(path("schedule"));
  assert.equal(saved.employees[0].startTime, "09:00");
  assert.equal(saved.employees[0].createdAt, stamp);
  assert.equal(saved.employees[0].unknown.stamp, stamp);
  assert.deepEqual(saved.employeeIds, raw.employeeIds);
  assert.equal(state.employeesRead().length, 0);
  const count = state.writes.length;
  await assert.rejects(state.save(command(raw, "workers", { id: "employee-c" }, { rowAction: "update", array: "employees", position: 0 })), { code: "aborted" });
  assert.equal(state.writes.length, count);
  await state.save(command(saved, "workers", { id: "employee-c" }, { rowAction: "update", array: "employees", position: 0 }));
  assert.deepEqual(state.employeesRead(), [`${root}/Employees/employee-c`]);
  assert.deepEqual(state.records.get(path("schedule")).employeeIds, ["employee-c", "employee-b"]);
});

test("same-value and reorder use no Employee read; deleting remains zero-read", async () => {
  const raw = operation(), state = harness(raw);
  const noop = await state.save(command(raw, "overview", { remarks: raw.remarks }));
  assert.equal(noop.updated, false); assert.equal(state.writes.length, 0);
  await state.save(command(raw, "workers", {}, { rowAction: "move", array: "employees", position: 0, destination: 1 }));
  const reordered = state.records.get(path("schedule"));
  assert.deepEqual(reordered.employeeIds, ["employee-b", "employee-a"]);
  await state.save(command(reordered, "delete"));
  assert.equal(state.records.has(path("schedule")), false);
  assert.equal(state.employeesRead().length, 0);
});

test("invalid actor state, current identity, maintenance, raw corruption and missing added Employee all refuse write", async () => {
  const raw = operation();
  const changes = command(raw, "workers", { id: "employee-missing" }, { rowAction: "add", array: "employees", position: 0 });
  for (const options of [{ actor: { disabled: true } }, { actor: { isTemporary: true } }, { identity: (count) => count === 2 ? { ...identity, companyId: "other" } : identity }]) {
    const state = harness(raw, options);
    await assert.rejects(state.save(changes), { code: "permission-denied" }); assert.equal(state.writes.length, 0);
  }
  for (const corrupt of [(state) => state.records.set("System/system", { isMaintenance: true }), (state) => state.records.set(path("schedule"), { ...raw, employeeIds: [] }), () => {}]) {
    const state = harness(raw); corrupt(state);
    await assert.rejects(state.save(changes), { code: "failed-precondition" }); assert.equal(state.writes.length, 0);
  }
});

test("active same-tenant users can update and delete schedules while restricted commands still reject the whole batch", async () => {
  const actorCases = [
    { actor: { roles: [] } },
    { actor: { roles: ["accountant"] } },
    { actor: { roles: ["controller", "invented"] } },
    { actor: { roles: [] }, identity: () => ({ ...identity, isSuperUser: true }) },
  ];
  for (const options of actorCases) {
    const raw = operation(), state = harness(raw, options);
    await state.save(command(raw, "overview", { remarks: "tenant-wide schedule edit" }));
    const saved = state.records.get(path("schedule"));
    assert.equal(saved.remarks, "tenant-wide schedule edit");
    await state.save(command(saved, "delete"));
    assert.equal(state.records.has(path("schedule")), false);
  }

  for (const action of ["notify", "convert"]) {
    const raw = operation(), state = harness(raw, { actor: { roles: [] } });
    await assert.rejects(state.save(command(raw, action, action === "notify" ? { shouldNotify: false } : {}, action === "convert" ? { notifications: {} } : {})), { code: "permission-denied" });
    assert.equal(state.writes.length, 0);
  }

  const raw = operation(), mixed = harness(raw, { actor: { roles: [] } });
  await assert.rejects(mixed.save(
    command(raw, "overview", { remarks: "must not commit" }),
    command(null, "create", { siteId: "site", dateAt: "2026-09-01", startTime: "08:00", endTime: "17:00", requiredPersonnel: 1 }, { kind: "result", documentId: "result" }),
  ), { code: "permission-denied" });
  assert.equal(mixed.writes.length, 0);
  assert.notEqual(mixed.records.get(path("schedule")).remarks, "must not commit");
});

test("active same-tenant users can edit unlocked result overview and employee or outsourcer rows independent of role", async () => {
  const actorCases = [
    { actor: { roles: [] } },
    { actor: { roles: ["accountant"] } },
    { actor: { roles: ["controller", "invented"] } },
    { actor: { roles: [] }, identity: () => ({ ...identity, isSuperUser: true }) },
  ];
  for (const options of actorCases) {
    const overviewRaw = operation("result"), overview = harness(overviewRaw, { kind: "result", ...options });
    await overview.save(command(overviewRaw, "overview", { remarks: "tenant-wide result edit" }, { kind: "result" }));
    assert.equal(overview.records.get(path("result")).remarks, "tenant-wide result edit");

    for (const array of ["employees", "outsourcers"]) for (const rowAction of ["add", "update", "remove", "move"]) {
      const model = new OperationResult(operation("result"));
      model.addWorker({ id: "outsourcer-b", isEmployee: false }, -1);
      const raw = model.toObject(), state = harness(raw, { kind: "result", ...options });
      const changes = rowAction === "add"
        ? { id: array === "employees" ? "employee-c" : "outsourcer-c" }
        : rowAction === "update" ? { startTime: "09:00" } : {};
      await state.save(command(raw, "workers", changes, {
        kind: "result",
        array,
        rowAction,
        position: 0,
        ...(rowAction === "move" ? { destination: 1 } : {}),
      }));
      assert.ok(state.writes.length > 0, `${array}/${rowAction}`);
    }
  }
});

test("tenant-wide result editing still rejects lifecycle, article, billing, invalid actor and locked-result operations", async () => {
  const raw = operation("result");
  const restricted = [
    command(null, "create", { siteId: "site", dateAt: "2026-09-01", startTime: "08:00", endTime: "17:00", requiredPersonnel: 1 }, { kind: "result" }),
    command(raw, "duplicate", { dateAt: "2026-09-02" }, { kind: "result", documentId: "copy", sourceId: "operation" }),
    command(raw, "delete", {}, { kind: "result" }),
    command(raw, "articles", { articleId: "article", price: 100, quantity: 1 }, { kind: "result", rowAction: "add", array: "articles", position: 0 }),
    command(raw, "adjusted", { useAdjusted: true }, { kind: "billing" }),
    command(raw, "lock", { desiredLocked: true }, { kind: "billing" }),
  ];
  for (const operationCommand of restricted) {
    const state = harness(operationCommand.action === "create" ? null : raw, { kind: "result", actor: { roles: [] } });
    await assert.rejects(state.save(operationCommand), { code: "permission-denied" });
    assert.equal(state.writes.length, 0);
  }

  const edit = command(raw, "overview", { remarks: "must reject" }, { kind: "result" });
  for (const options of [
    { actor: { disabled: true } },
    { actor: { isTemporary: true } },
    { actor: { companyId: "other" } },
    { identity: (count) => count === 2 ? { ...identity, companyId: "other" } : identity },
  ]) {
    const state = harness(raw, { kind: "result", ...options });
    await assert.rejects(state.save(edit), { code: "permission-denied" });
    assert.equal(state.writes.length, 0);
  }
  const missing = harness(raw, { kind: "result", actor: { roles: [] } });
  missing.records.delete(`${root}/Users/actor`);
  await assert.rejects(missing.save(edit), { code: "permission-denied" });
  assert.equal(missing.writes.length, 0);

  const lockedRaw = { ...raw, isLocked: true };
  for (const lockedCommand of [
    command(lockedRaw, "overview", { remarks: "must reject" }, { kind: "result" }),
    command(lockedRaw, "workers", { startTime: "09:00" }, { kind: "result", rowAction: "update", array: "employees", position: 0 }),
  ]) {
    const state = harness(lockedRaw, { kind: "result", actor: { roles: [] } });
    await assert.rejects(state.save(lockedCommand), { code: "failed-precondition" });
    assert.equal(state.writes.length, 0);
  }
});

test("tenant-wide result editing rejects stale expected state and a lock added after command preparation without writing", async () => {
  const raw = operation("result");
  const staleOverview = harness(raw, { kind: "result", actor: { roles: [] } });
  staleOverview.records.set(path("result"), { ...raw, remarks: "parallel update" });
  await assert.rejects(staleOverview.save(command(raw, "overview", { remarks: "requested update" }, { kind: "result" })), { code: "aborted" });
  assert.equal(staleOverview.writes.length, 0);

  const changedEmployees = raw.employees.map((worker, index) => index === 0 ? { ...worker, startTime: "09:00" } : worker);
  const staleWorkers = harness(raw, { kind: "result", actor: { roles: [] } });
  staleWorkers.records.set(path("result"), { ...raw, employees: changedEmployees, workers: [...changedEmployees, ...raw.outsourcers] });
  await assert.rejects(staleWorkers.save(command(raw, "workers", { startTime: "10:00" }, { kind: "result", rowAction: "update", array: "employees", position: 0 })), { code: "aborted" });
  assert.equal(staleWorkers.writes.length, 0);

  for (const prepared of [
    command(raw, "overview", { remarks: "requested update" }, { kind: "result" }),
    command(raw, "workers", { startTime: "10:00" }, { kind: "result", rowAction: "update", array: "employees", position: 0 }),
  ]) {
    const locked = harness({ ...raw, isLocked: true }, { kind: "result", actor: { roles: [] } });
    await assert.rejects(locked.save(prepared), { code: "failed-precondition" });
    assert.equal(locked.writes.length, 0);
  }
});

test("allowed result edits mixed with restricted result or billing commands reject the whole batch", async () => {
  const raw = operation("result");
  for (const restricted of [
    command(raw, "delete", {}, { kind: "result" }),
    command(raw, "adjusted", { useAdjusted: true }, { kind: "billing" }),
  ]) {
    const state = harness(raw, { kind: "result", actor: { roles: [] } });
    await assert.rejects(state.save(
      command(raw, "overview", { remarks: "must not commit" }, { kind: "result" }),
      command(raw, "workers", { startTime: "09:00" }, { kind: "result", rowAction: "update", array: "employees", position: 0 }),
      restricted,
    ), { code: "permission-denied" });
    assert.equal(state.writes.length, 0);
    assert.strictEqual(state.records.get(path("result")), raw);
  }
});

test("billing edits may run locked but result worker edits remain lock-protected; lock is desired-state with raw expected", async () => {
  const raw = { ...operation("result"), isLocked: true }, state = harness(raw, { kind: "result", actor: { roles: ["accountant"] } });
  await state.save(command(raw, "adjusted", { useAdjusted: true, adjustedQuantityBase: 7 }, { kind: "billing" }));
  const adjusted = state.records.get(path("result"));
  assert.deepEqual(adjusted.employees, raw.employees); assert.equal(adjusted.isLocked, true); assert.equal(adjusted.adjustedQuantityBase, 7);
  await assert.rejects(state.save(command(adjusted, "workers", {}, { kind: "result", rowAction: "remove", array: "employees", position: 0 })), { code: "failed-precondition" });
  const unlock = command(adjusted, "lock", { desiredLocked: false }, { kind: "billing" });
  await state.save(unlock);
  await assert.rejects(state.save(unlock), { code: "aborted" });
  assert.equal(state.records.get(path("result")).isLocked, false);
  assert.equal(state.employeesRead().length, 0);
  const controller = harness(raw, { kind: "result" });
  await assert.rejects(controller.save(command(raw, "overview", { remarks: "edit" }, { kind: "result" })), { code: "failed-precondition" });
});

test("nonempty article operations patch only articles and their billing calculations", async () => {
  const raw = operation("result"), state = harness(raw, { kind: "result", actor: { roles: ["accountant"] } });
  await state.save(command(raw, "articles", { articleId: "article", price: 300, quantity: 2 }, { kind: "billing", rowAction: "add", array: "articles", position: 0 }));
  const saved = state.records.get(path("result"));
  assert.deepEqual(saved.articles, [{ articleId: "article", price: 300, quantity: 2 }]);
  assert.equal(saved.salesArticles, 600);
  assert.deepEqual(saved.employees, raw.employees);
  assert.equal(state.employeesRead().length, 0);
});

test("schedule create and moved date retain Site status, Customer reference and revision protection", async () => {
  const state = harness(null);
  const create = command(null, "create", { siteId: "site", dateAt: "2026-09-01", startTime: "08:00", endTime: "17:00", requiredPersonnel: 2 }, { siteStatuses: { site: "ACTIVE" } });
  await state.save(create);
  const saved = state.records.get(path("schedule"));
  assert.equal(saved.operationResultId, null);
  assert.equal(state.records.get(`${root}/Sites/site`).scheduleRevision, 5);
  await state.save(command(saved, "overview", { dateAt: "2026-09-02" }, { siteStatuses: { site: "ACTIVE" } }));
  assert.equal(state.records.get(`${root}/Sites/site`).scheduleRevision, 6);
  for (const sitePatch of [{ isTemporary: true }, { status: "TERMINATED" }, { scheduleRevision: "0" }, { scheduleRevision: Number.MAX_SAFE_INTEGER }]) {
    const refused = harness(null); refused.records.set(`${root}/Sites/site`, { ...refused.records.get(`${root}/Sites/site`), ...sitePatch });
    await assert.rejects(refused.save(create)); assert.equal(refused.writes.length, 0);
  }
  const result = harness(null); result.records.delete(`${root}/Customers/customer`);
  await assert.rejects(result.save({ ...create, kind: "result", siteStatuses: undefined }));
  assert.equal(result.writes.length, 0);
});

test("notify and conversion read each destination, preserve actual false/zero and reject notification-only conflict atomically", async () => {
  const raw = operation(), state = harness(raw);
  await state.save(command(raw, "notify", { shouldNotify: false }));
  assert.equal(state.employeesRead().length, 2, "each new notification adds its Employee even though schedule already referenced it");
  const prepared = state.records.get(path("schedule"));
  const notifications = {};
  for (const worker of prepared.workers) {
    const key = `${root}/ArrangementNotifications/${worker.notificationKey}`;
    const notification = { ...state.records.get(key), actualStartTime: "09:00", actualBreakMinutes: 0, actualIsStartNextDay: false, isQualified: true, isOjt: false };
    state.records.set(key, notification); notifications[worker.notificationKey] = notificationExpectation(notification);
  }
  const convert = command(prepared, "convert", {}, { notifications });
  const firstKey = `${root}/ArrangementNotifications/${prepared.workers[0].notificationKey}`;
  const first = state.records.get(firstKey);
  state.records.set(firstKey, { ...first, actualStartTime: "10:00" });
  const previousWrites = state.writes.length;
  await assert.rejects(state.save(convert), { code: "aborted" });
  assert.equal(state.writes.length, previousWrites); assert.equal(state.records.has(path("result")), false);
  state.records.set(firstKey, first);
  await state.save(convert);
  const result = state.records.get(path("result"));
  assert.equal(state.records.get(path("schedule")).operationResultId, "operation");
  for (const worker of result.workers) { assert.equal(worker.startTime, "09:00"); assert.equal(worker.breakMinutes, 0); assert.equal(worker.isStartNextDay, false); assert.equal(worker.isQualified, true); }
  assert.equal(state.employeesRead().length, 4, "result is another new destination");
  await assert.rejects(state.save(convert));
});

test("wire rejects client indexes, paths, metadata, foreign field groups, invalid row positions and wrong input types", () => {
  const raw = operation();
  for (const input of [
    { ...command(raw, "overview"), employeeIds: [] }, command(raw, "overview", { uid: "other" }),
    command(raw, "overview", { breakMinutes: "60" }), command(raw, "overview", { isStartNextDay: "false" }),
    command(raw, "workers", {}, { array: "workers", rowAction: "remove", position: 0 }),
    command(raw, "workers", { index: 7 }, { array: "outsourcers", rowAction: "add", position: 0 }),
    command(raw, "overview", { securityType: "TRAFFIC" }, { kind: "billing" }),
  ]) assert.throws(() => parseOperationCommand(input), { code: "invalid-argument" });
});

test("worker replacement cancels the old notification and clears the replacement flag; concurrent unrelated raw stays intact", async () => {
  const raw = operation(), state = harness(raw);
  await state.save(command(raw, "notify", { shouldNotify: false }));
  const notified = state.records.get(path("schedule"));
  const stamp = new Timestamp(1788200000, 123456789);
  state.records.set(path("schedule"), { ...notified, remarks: "parallel", unknown: { stamp } });
  await state.save(command(notified, "workers", { id: "employee-c" }, { rowAction: "update", array: "employees", position: 0 }));
  const saved = state.records.get(path("schedule"));
  assert.equal(saved.employees[0].hasNotification, false);
  assert.equal(saved.employees[1].hasNotification, true);
  assert.equal(state.records.has(`${root}/ArrangementNotifications/operation_employee-a`), false);
  assert.equal(saved.remarks, "parallel"); assert.equal(saved.unknown.stamp, stamp);
});

test("conversion uses nullish fallbacks for both worker kinds and preserves unchanged raw Timestamp precision", async () => {
  const raw = operation(), state = harness(raw);
  const stamp = new Timestamp(1788200000, 123456789);
  raw.employees[0].createdAt = stamp;
  raw.employees[0].unknown = { stamp };
  const notifications = {};
  for (const worker of raw.workers) {
    const notification = new ArrangementNotification(worker).toObject();
    notification.docId = worker.notificationKey;
    notification.actualStartTime = null;
    delete notification.actualEndTime;
    notification.actualBreakMinutes = null;
    delete notification.actualIsStartNextDay;
    state.records.set(`${root}/ArrangementNotifications/${notification.docId}`, notification);
    notifications[notification.docId] = notificationExpectation(notification);
  }
  await state.save(command(raw, "convert", {}, { notifications }));
  const saved = state.records.get(path("result"));
  for (const worker of saved.workers) {
    assert.equal(worker.startTime, "08:00"); assert.equal(worker.endTime, "17:00"); assert.equal(worker.breakMinutes, 60); assert.equal(worker.isStartNextDay, false);
  }
  assert.deepEqual(encodeExpected(saved.employees[0].createdAt), encodeExpected(stamp));
  assert.equal(saved.employees[0].unknown.stamp, stamp);
});

test("normal result create derives Customer from Site and rejects missing Site or Customer before writing", async () => {
  const create = command(null, "create", { siteId: "site", dateAt: "2026-09-01", startTime: "08:00", endTime: "17:00", requiredPersonnel: 1 }, { kind: "result" });
  const valid = harness(null);
  await valid.save(create);
  assert.equal(valid.records.get(path("result")).customerId, "customer");
  for (const removed of ["Sites/site", "Customers/customer"]) {
    const state = harness(null); state.records.delete(`${root}/${removed}`);
    await assert.rejects(state.save(create), { code: "failed-precondition" }); assert.equal(state.writes.length, 0);
  }
});

for (const array of ["employees", "articles"]) for (const sequence of ["remove-update", "move-remove", "add-update"]) {
  test(`multiple ${array} operations ${sequence} retain original positions`, async () => {
    const raw = operation("result", ["employee-a", "employee-b", "employee-c"]);
    raw.articles = ["article-a", "article-b", "article-c"].map((articleId) => ({ articleId, price: 10, quantity: 1 }));
    const state = harness(raw, { kind: "result" });
    state.records.set(`${root}/Employees/new-employee`, { employmentStatus: "RESIGNED" });
    const action = array === "employees" ? "workers" : "articles";
    const row = (rowAction, position, changes = {}, extra = {}) => command(raw, action, changes, { kind: "result", array, rowAction, position, ...extra });
    const correction = array === "employees" ? { startTime: "10:00" } : { price: 80 };
    const added = array === "employees" ? { id: "new-employee", startTime: "09:00" } : { articleId: "new-article", price: 20, quantity: 1 };
    if (sequence === "remove-update") {
      await state.save(row("remove", 0), row("update", 1, correction));
      const saved = state.records.get(path("result"))[array];
      assert.equal(saved[0][array === "employees" ? "id" : "articleId"], array === "employees" ? "employee-b" : "article-b");
      assert.equal(saved[0][array === "employees" ? "startTime" : "price"], array === "employees" ? "10:00" : 80);
    } else if (sequence === "move-remove") {
      await state.save(row("move", 0, {}, { destination: 2 }), row("remove", 1));
      assert.deepEqual(state.records.get(path("result"))[array].map((value) => value[array === "employees" ? "id" : "articleId"]), array === "employees" ? ["employee-c", "employee-a"] : ["article-c", "article-a"]);
    } else {
      await state.save(row("add", 0, added), row("update", 0, correction));
      const saved = state.records.get(path("result"))[array];
      assert.equal(saved[0][array === "employees" ? "startTime" : "price"], array === "employees" ? "09:00" : 20);
      assert.equal(saved[1][array === "employees" ? "startTime" : "price"], array === "employees" ? "10:00" : 80);
    }
  });
}

test("existing notification with false schedule flag refuses reset, including concurrently changed actual values", async () => {
  const raw = operation(), state = harness(raw);
  const worker = raw.workers[0], notification = new ArrangementNotification(worker).toObject();
  notification.docId = worker.notificationKey;
  notification.actualStartTime = "10:00"; notification.status = "LEAVED";
  state.records.set(`${root}/ArrangementNotifications/${notification.docId}`, notification);
  await assert.rejects(state.save(command(raw, "notify", { shouldNotify: true })), { code: "failed-precondition" });
  assert.equal(state.writes.length, 0);
  assert.strictEqual(state.records.get(`${root}/ArrangementNotifications/${notification.docId}`), notification);
});

test("worker change/notify and conversion cannot skip the completed preparation and fresh confirmation read", async () => {
  const raw = operation(), state = harness(raw);
  const convert = command(raw, "convert", {}, { notifications: Object.fromEntries(raw.workers.map((worker) => [worker.notificationKey, null])) });
  for (const preparation of [command(raw, "notify", { shouldNotify: false }), command(raw, "workers", { startTime: "10:00" }, { rowAction: "update", array: "employees", position: 0 })]) {
    await assert.rejects(state.save(preparation, convert), { code: "invalid-argument" });
    assert.equal(state.writes.length, 0);
  }
});

test("actual server create plus ten worker adds checks ten unique Employee paths across two new destinations", async () => {
  const state = harness(null), commands = [];
  const ids = Array.from({ length: 10 }, (_, index) => `new-${index}`);
  for (const id of ids) state.records.set(`${root}/Employees/${id}`, { docId: id, employmentStatus: "RESIGNED" });
  for (const documentId of ["first", "second"]) {
    const changes = { siteId: "site", securityType: "TRAFFIC", dateAt: "2026-09-01", startTime: "08:00", endTime: "17:00", requiredPersonnel: 10 };
    commands.push(command(null, "create", changes, { documentId, siteStatuses: { site: "ACTIVE" } }));
    const display = new SiteOperationSchedule({ ...changes, dateAt: new Date("2026-09-01T00:00:00+09:00"), docId: documentId });
    for (const [position, id] of ids.entries()) {
      commands.push(command(display.toObject(), "workers", { id }, { documentId, rowAction: "add", array: "employees", position }));
      display.addWorker({ id, isEmployee: true }, -1);
    }
  }
  await state.save(...commands);
  assert.deepEqual(state.employeesRead().sort(), ids.map((id) => `${root}/Employees/${id}`).sort());
  for (const id of ["first", "second"]) assert.deepEqual(state.records.get(path("schedule", id)).employeeIds, ids);
  assert.equal(state.writes.filter(([kind, key]) => kind === "create" && key.includes("/SiteOperationSchedules/")).length, 2);
  const first = state.records.get(path("schedule", "first"));
  await state.save(command(first, "delete", {}, { documentId: "first" }));
  const before = state.employeesRead().length;
  await state.save(...commands.filter((entry) => entry.documentId === "first"));
  assert.equal(state.employeesRead().length - before, 10, "recreated destination is empty even though another destination still references all ten");
});

for (const kind of ["schedule", "result"]) test(`${kind} rejects duplicate outsourcer workerId but allows one outsourcer at distinct indexes`, async () => {
  const model = new (kind === "schedule" ? SiteOperationSchedule : OperationResult)(operation(kind));
  model.addWorker({ id: "other-outsourcer", isEmployee: false }, -1);
  const raw = model.toObject(), state = harness(raw, { kind });
  const replace = command(raw, "workers", { id: "other-outsourcer" }, { kind, array: "outsourcers", rowAction: "update", position: 0 });
  await assert.rejects(state.save(replace), { code: "failed-precondition" });
  assert.equal(state.writes.length, 0);
  const duplicate = { ...raw, outsourcers: [raw.outsourcers[0], raw.outsourcers[0]], outsourcerIds: ["outsourcer", "outsourcer"], workers: [...raw.employees, raw.outsourcers[0], raw.outsourcers[0]] };
  const corrupt = harness(duplicate, { kind });
  await assert.rejects(corrupt.save(command(duplicate, "overview", { remarks: "correction" }, { kind })), { code: "failed-precondition" });
  assert.equal(corrupt.writes.length, 0);
  await state.save(command(raw, "workers", { id: "outsourcer" }, { kind, array: "outsourcers", rowAction: "add", position: 2 }));
  const added = state.records.get(path(kind));
  assert.deepEqual(added.outsourcers.map((row) => row.workerId), ["outsourcer:1", "other-outsourcer:1", "outsourcer:2"]);
  if (kind === "schedule") await state.save(command(added, "notify", { shouldNotify: false }));
  const baseline = state.records.get(path(kind));
  await state.save(command(baseline, "workers", { id: "third-outsourcer" }, { kind, array: "outsourcers", rowAction: "update", position: 0 }));
  const updated = state.records.get(path(kind));
  assert.deepEqual(updated.outsourcers.slice(1), baseline.outsourcers.slice(1));
  assert.equal(updated.outsourcers[0].workerId, "third-outsourcer:1");
  if (kind === "schedule") {
    assert.equal(state.records.has(`${root}/ArrangementNotifications/operation_outsourcer:1`), false);
    assert.equal(state.records.has(`${root}/ArrangementNotifications/operation_outsourcer:2`), true);
    assert.equal(updated.outsourcers[0].hasNotification, false);
  }
});

test("actual server moving an existing employee to a different destination checks exactly that one added ID", async () => {
  const raw = operation(), state = harness(raw);
  const targetModel = new SiteOperationSchedule({ docId: "target", siteId: "site", securityType: "TRAFFIC", dateAt: new Date("2026-09-01"), startTime: "08:00", endTime: "17:00", requiredPersonnel: 2 });
  targetModel.addWorker({ id: "employee-b", isEmployee: true }, -1);
  const target = targetModel.toObject(); state.records.set(path("schedule", "target"), target);
  await state.save(command(raw, "workers", {}, { rowAction: "remove", array: "employees", position: 0 }), command(target, "workers", { id: "employee-a" }, { rowAction: "add", array: "employees", position: 1 }));
  assert.deepEqual(state.employeesRead(), [`${root}/Employees/employee-a`]);
  assert.deepEqual(state.records.get(path("schedule")).employeeIds, ["employee-b"]);
  assert.deepEqual(state.records.get(path("schedule", "target")).employeeIds, ["employee-b", "employee-a"]);
});
