import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const stripImports = (source) => source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`);

async function loadGuard() {
  return await load(`
    const collection = (_firestore, ...segments) => ({path: segments.join('/')});
    const doc = (reference, id) => ({path: reference.path + '/' + id});
    const getDoc = reference => globalThis.__siteSchedule.firestore.getDoc(reference);
    const runTransaction = (_firestore, callback) => globalThis.__siteSchedule.firestore.runTransaction(callback);
    const serverTimestamp = () => globalThis.__siteSchedule.timestamp;
    ${stripImports(await read("utils/siteOperationSchedule/siteScheduleGuard.js"))}
  `);
}

function snapshot(data) {
  return { exists: () => data !== null, data: () => data };
}

function harness(sites) {
  const events = [];
  const transactionUpdates = [];
  const scheduleCalls = [];
  const timestamp = Object.freeze({ type: "server-timestamp" });
  const preflight = new Map(Object.entries(sites));
  const current = new Map(Object.entries(sites));
  const firestore = {
    async getDoc(reference) { return snapshot(preflight.get(reference.path) ?? null); },
    async runTransaction(callback) {
      const transaction = {
        async get(reference) {
          events.push({ type: "read", path: reference.path });
          return snapshot(current.get(reference.path) ?? null);
        },
        update(reference, data) {
          events.push({ type: "site-write", path: reference.path });
          transactionUpdates.push({ path: reference.path, data });
        },
      };
      return await callback(transaction);
    },
  };
  function schedule(data, before = null) {
    return {
      ...data,
      _beforeData: before,
      async create(options) {
        events.push({ type: "schedule-write", operation: "create" });
        scheduleCalls.push({ operation: "create", options });
      },
      async update(options) {
        events.push({ type: "schedule-write", operation: "update" });
        scheduleCalls.push({ operation: "update", options });
      },
    };
  }
  return {
    current, events, firestore, preflight, schedule, scheduleCalls, timestamp, transactionUpdates,
  };
}

test("Schedule create bumps missing Site revision atomically and confirms TERMINATED selection", async () => {
  const path = "Companies/company-a/Sites/site-a";
  const h = harness({ [path]: { status: "TERMINATED", isTemporary: false } });
  globalThis.__siteSchedule = h;
  try {
    const {
      attachSiteScheduleConfirmation,
      createSiteOperationScheduleWriter,
    } = await loadGuard();
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    const schedule = h.schedule({ siteId: "site-a", operationResultId: "forged-result" });
    attachSiteScheduleConfirmation(schedule, {
      companyId: "company-a", siteId: "site-a", operationId: "create-a",
    });
    await writer.create(schedule);
    assert.equal(schedule.operationResultId, null);
    assert.deepEqual(h.transactionUpdates, [{
      path,
      data: { scheduleRevision: 1, uid: "actor-a", updatedAt: h.timestamp },
    }]);
    assert.equal(h.scheduleCalls.length, 1);
    assert.equal(h.scheduleCalls[0].operation, "create");
    assert.ok(h.scheduleCalls[0].options.transaction);
  } finally {
    delete globalThis.__siteSchedule;
  }
});

test("Schedule guard denies unconfirmed TERMINATED, temporary, missing, and invalid Sites", async () => {
  const cases = [
    ["terminated-not-confirmed", { status: "TERMINATED", isTemporary: false }],
    ["temporary-site", { status: "ACTIVE", isTemporary: true }],
    ["site-not-found", null],
    ["invalid-site-status", { status: "UNKNOWN", isTemporary: false }],
  ];
  for (const [code, site] of cases) {
    const h = harness({ "Companies/company-a/Sites/site-a": site });
    globalThis.__siteSchedule = h;
    const { createSiteOperationScheduleWriter, SiteScheduleGuardError } = await loadGuard();
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    await assert.rejects(
      () => writer.create(h.schedule({ siteId: "site-a" })),
      (error) => error instanceof SiteScheduleGuardError && error.code === code,
    );
    assert.deepEqual(h.transactionUpdates, []);
    assert.deepEqual(h.scheduleCalls, []);
  }
  delete globalThis.__siteSchedule;
});

test("TERMINATED confirmation is operation-local, tenant-scoped, and cleared after success", async () => {
  const h = harness({
    "Companies/company-a/Sites/site-a": { status: "TERMINATED", isTemporary: false },
    "Companies/company-b/Sites/site-a": { status: "TERMINATED", isTemporary: false },
  });
  globalThis.__siteSchedule = h;
  try {
    const {
      attachSiteScheduleConfirmation,
      createSiteOperationScheduleWriter,
      SiteScheduleGuardError,
    } = await loadGuard();
    const schedule = h.schedule({ siteId: "site-a" });
    attachSiteScheduleConfirmation(schedule, {
      companyId: "company-a", siteId: "site-a", operationId: "create-a",
    });
    const companyBWriter = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-b", actorUid: "actor-b",
    });
    await assert.rejects(
      () => companyBWriter.create(schedule),
      (error) => error instanceof SiteScheduleGuardError && error.code === "terminated-not-confirmed",
    );
    const companyAWriter = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    await companyAWriter.create(schedule);
    await assert.rejects(
      () => companyAWriter.create(schedule),
      (error) => error instanceof SiteScheduleGuardError && error.code === "terminated-not-confirmed",
    );
    assert.equal(h.scheduleCalls.length, 1);
  } finally { delete globalThis.__siteSchedule; }
});

test("TERMINATED confirmation survives a failed write for explicit retry", async () => {
  const path = "Companies/company-a/Sites/site-a";
  const h = harness({ [path]: { status: "TERMINATED", isTemporary: false } });
  let attempts = 0;
  h.firestore.runTransaction = async (callback) => {
    attempts += 1;
    if (attempts === 1) throw new Error("retryable write failure");
    const transaction = {
      async get(reference) {
        h.events.push({ type: "read", path: reference.path });
        return snapshot(h.current.get(reference.path) ?? null);
      },
      update(reference, data) { h.transactionUpdates.push({ path: reference.path, data }); },
    };
    return await callback(transaction);
  };
  globalThis.__siteSchedule = h;
  try {
    const { attachSiteScheduleConfirmation, createSiteOperationScheduleWriter } = await loadGuard();
    const schedule = h.schedule({ siteId: "site-a" });
    attachSiteScheduleConfirmation(schedule, {
      companyId: "company-a", siteId: "site-a", operationId: "retry-a",
    });
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    await assert.rejects(() => writer.create(schedule), /retryable write failure/u);
    await writer.create(schedule);
    assert.equal(attempts, 2);
    assert.equal(h.scheduleCalls.length, 1);
  } finally { delete globalThis.__siteSchedule; }
});

test("Preset create and duplicate require the injected TERMINATED confirmation callback", async () => {
  const path = "Companies/company-a/Sites/site-a";
  const h = harness({ [path]: { status: "TERMINATED", isTemporary: false } });
  globalThis.__siteSchedule = h;
  try {
    const { createSiteOperationScheduleWriter, SiteScheduleGuardError } = await loadGuard();
    const denied = createSiteOperationScheduleWriter({
      firestore: h.firestore,
      companyId: "company-a",
      actorUid: "actor-a",
      confirmTerminatedSite: async () => false,
    });
    await assert.rejects(
      () => denied.create(h.schedule({ siteId: "site-a" })),
      (error) => error instanceof SiteScheduleGuardError && error.code === "terminated-not-confirmed",
    );
    await assert.rejects(
      () => denied.createMany([h.schedule({ siteId: "site-a" })]),
      (error) => error instanceof SiteScheduleGuardError && error.code === "terminated-not-confirmed",
    );
    assert.deepEqual(h.transactionUpdates, []);
    assert.deepEqual(h.scheduleCalls, []);

    const confirmations = [];
    const allowed = createSiteOperationScheduleWriter({
      firestore: h.firestore,
      companyId: "company-a",
      actorUid: "actor-a",
      confirmTerminatedSite: async (context) => {
        confirmations.push(context);
        return true;
      },
    });
    await allowed.create(h.schedule({ siteId: "site-a" }));
    await allowed.createMany([
      h.schedule({ siteId: "site-a" }),
      h.schedule({ siteId: "site-a" }),
    ]);
    assert.equal(confirmations.length, 2);
    assert.equal(confirmations.every(({ companyId, siteId }) =>
      companyId === "company-a" && siteId === "site-a"), true);
    assert.equal(h.scheduleCalls.length, 3);
  } finally { delete globalThis.__siteSchedule; }
});

test("Schedule update bumps old and new Sites and rejects an expected-status race", async () => {
  const oldPath = "Companies/company-a/Sites/site-old";
  const newPath = "Companies/company-a/Sites/site-new";
  const h = harness({
    [oldPath]: { status: "ACTIVE", isTemporary: false },
    [newPath]: { status: "ACTIVE", isTemporary: false, scheduleRevision: 4 },
  });
  globalThis.__siteSchedule = h;
  try {
    const { createSiteOperationScheduleWriter, SiteScheduleGuardError } = await loadGuard();
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    const moved = h.schedule(
      { siteId: "site-new", dateAt: new Date("2028-06-01T00:00:00Z") },
      { siteId: "site-old", dateAt: new Date("2028-05-01T00:00:00Z"), operationResultId: null },
    );
    await writer.update(moved);
    assert.deepEqual(h.transactionUpdates.map(({ path, data }) => [path, data.scheduleRevision]), [
      [oldPath, 1], [newPath, 5],
    ]);
    assert.ok(h.scheduleCalls[0].options.transaction);

    h.transactionUpdates.length = 0;
    h.scheduleCalls.length = 0;
    h.current.set(newPath, { status: "TERMINATED", isTemporary: false, scheduleRevision: 4 });
    await assert.rejects(
      () => writer.update(moved),
      (error) => error instanceof SiteScheduleGuardError && error.code === "site-conflict",
    );
    assert.deepEqual(h.transactionUpdates, []);
    assert.deepEqual(h.scheduleCalls, []);
  } finally { delete globalThis.__siteSchedule; }
});

test("Site move confirms only a TERMINATED target, never the old Site", async () => {
  const active = { status: "ACTIVE", isTemporary: false };
  const terminated = { status: "TERMINATED", isTemporary: false };
  const h = harness({
    "Companies/company-a/Sites/active": active,
    "Companies/company-a/Sites/terminated-old": terminated,
    "Companies/company-a/Sites/terminated-target": terminated,
  });
  globalThis.__siteSchedule = h;
  try {
    const {
      attachSiteScheduleConfirmation,
      createSiteOperationScheduleWriter,
      SiteScheduleGuardError,
    } = await loadGuard();
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    const movedAway = h.schedule(
      { siteId: "active", dateAt: new Date("2028-06-01T00:00:00Z") },
      {
        siteId: "terminated-old", dateAt: new Date("2028-05-01T00:00:00Z"),
        operationResultId: null,
      },
    );
    await writer.update(movedAway);

    const movedToTerminated = h.schedule(
      { siteId: "terminated-target", dateAt: new Date("2028-07-01T00:00:00Z") },
      { siteId: "active", dateAt: new Date("2028-06-01T00:00:00Z"), operationResultId: null },
    );
    await assert.rejects(
      () => writer.update(movedToTerminated),
      (error) => error instanceof SiteScheduleGuardError && error.code === "terminated-not-confirmed",
    );
    attachSiteScheduleConfirmation(movedToTerminated, {
      companyId: "company-a", siteId: "terminated-target", operationId: "move-target",
    });
    await writer.update(movedToTerminated);

    const terminatedToTerminated = h.schedule(
      { siteId: "terminated-target", dateAt: new Date("2028-08-01T00:00:00Z") },
      {
        siteId: "terminated-old", dateAt: new Date("2028-07-01T00:00:00Z"),
        operationResultId: null,
      },
    );
    attachSiteScheduleConfirmation(terminatedToTerminated, {
      companyId: "company-a", siteId: "terminated-target", operationId: "move-terminated-target",
    });
    await writer.update(terminatedToTerminated);
    assert.equal(h.scheduleCalls.length, 3);
  } finally { delete globalThis.__siteSchedule; }
});

test("Unrelated updates do not bump Site; result rollback writes nothing", async () => {
  const path = "Companies/company-a/Sites/site-a";
  const h = harness({ [path]: { status: "ACTIVE", isTemporary: false, scheduleRevision: 8 } });
  globalThis.__siteSchedule = h;
  try {
    const { createSiteOperationScheduleWriter, SiteScheduleGuardError } = await loadGuard();
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    const dateAt = new Date("2028-05-01T00:00:00Z");
    await writer.update(h.schedule(
      { siteId: "site-a", dateAt, operationResultId: null, remarks: "changed" },
      { siteId: "site-a", dateAt, operationResultId: null, remarks: "before" },
    ));
    assert.deepEqual(h.transactionUpdates, []);
    assert.equal(h.scheduleCalls.length, 1);
    assert.equal(h.scheduleCalls[0].options, undefined);

    h.scheduleCalls.length = 0;
    await assert.rejects(
      () => writer.update(h.schedule(
        { siteId: "site-a", dateAt, operationResultId: null },
        { siteId: "site-a", dateAt, operationResultId: "result-a" },
      )),
      (error) => error instanceof SiteScheduleGuardError && error.code === "result-rollback",
    );
    assert.deepEqual(h.transactionUpdates, []);
    assert.deepEqual(h.scheduleCalls, []);
  } finally { delete globalThis.__siteSchedule; }
});

test("Schedule guard rejects malformed persisted Site revision without writing", async () => {
  const path = "Companies/company-a/Sites/site-a";
  const h = harness({
    [path]: { status: "ACTIVE", isTemporary: false, scheduleRevision: "0" },
  });
  globalThis.__siteSchedule = h;
  try {
    const { createSiteOperationScheduleWriter, SiteScheduleGuardError } = await loadGuard();
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    await assert.rejects(
      () => writer.create(h.schedule({ siteId: "site-a" })),
      (error) => error instanceof SiteScheduleGuardError && error.code === "invalid-site-revision",
    );
    assert.deepEqual(h.transactionUpdates, []);
    assert.deepEqual(h.scheduleCalls, []);
  } finally { delete globalThis.__siteSchedule; }
});

test("Bulk create and update read every guarded Site before any write", async () => {
  const sites = Object.fromEntries(["site-a", "site-b"].map((siteId) => [
    `Companies/company-a/Sites/${siteId}`,
    { status: "ACTIVE", isTemporary: false, scheduleRevision: 0 },
  ]));
  const h = harness(sites);
  globalThis.__siteSchedule = h;
  try {
    const { createSiteOperationScheduleWriter } = await loadGuard();
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    await writer.createMany([
      h.schedule({ siteId: "site-a", operationResultId: "forged" }),
      h.schedule({ siteId: "site-b" }),
    ]);
    assert.deepEqual(h.events.slice(0, 2).map(({ type }) => type), ["read", "read"]);
    assert.equal(h.events.slice(2).every(({ type }) => type !== "read"), true);
    assert.equal(h.scheduleCalls.every(({ options }) => Boolean(options?.transaction)), true);

    h.events.length = 0;
    h.scheduleCalls.length = 0;
    h.transactionUpdates.length = 0;
    await writer.updateMany([
      h.schedule(
        { siteId: "site-b", dateAt: new Date("2028-06-01T00:00:00Z") },
        { siteId: "site-a", dateAt: new Date("2028-05-01T00:00:00Z"), operationResultId: null },
      ),
    ]);
    assert.deepEqual(h.events.slice(0, 2).map(({ type }) => type), ["read", "read"]);
    assert.equal(h.events.slice(2).every(({ type }) => type !== "read"), true);
    assert.equal(h.scheduleCalls[0].options.transaction !== undefined, true);
  } finally { delete globalThis.__siteSchedule; }
});

test("Bulk create and update accept eight unique Sites and reject nine before writes", async () => {
  const siteIds = Array.from({ length: 9 }, (_, index) => `site-${index + 1}`);
  const sites = Object.fromEntries(siteIds.map((siteId) => [
    `Companies/company-a/Sites/${siteId}`,
    { status: "ACTIVE", isTemporary: false },
  ]));
  const h = harness(sites);
  globalThis.__siteSchedule = h;
  try {
    const { createSiteOperationScheduleWriter, SiteScheduleGuardError } = await loadGuard();
    const writer = createSiteOperationScheduleWriter({
      firestore: h.firestore, companyId: "company-a", actorUid: "actor-a",
    });
    await writer.createMany(siteIds.slice(0, 8).map((siteId) => h.schedule({ siteId })));
    assert.equal(h.transactionUpdates.length, 8);
    assert.equal(h.scheduleCalls.length, 8);

    h.events.length = 0;
    h.scheduleCalls.length = 0;
    h.transactionUpdates.length = 0;
    await assert.rejects(
      () => writer.createMany(siteIds.map((siteId) => h.schedule({ siteId }))),
      (error) => error instanceof SiteScheduleGuardError && error.code === "too-many-sites",
    );
    assert.deepEqual(h.events, []);
    assert.deepEqual(h.scheduleCalls, []);
    assert.deepEqual(h.transactionUpdates, []);

    const updates = siteIds.map((siteId) => h.schedule(
      { siteId, dateAt: new Date("2028-06-01T00:00:00Z") },
      { siteId, dateAt: new Date("2028-05-01T00:00:00Z"), operationResultId: null },
    ));
    await writer.updateMany(updates.slice(0, 8));
    assert.equal(h.transactionUpdates.length, 8);
    assert.equal(h.scheduleCalls.length, 8);

    h.events.length = 0;
    h.scheduleCalls.length = 0;
    h.transactionUpdates.length = 0;
    await assert.rejects(
      () => writer.updateMany(updates),
      (error) => error instanceof SiteScheduleGuardError && error.code === "too-many-sites",
    );
    assert.deepEqual(h.events, []);
    assert.deepEqual(h.scheduleCalls, []);
    assert.deepEqual(h.transactionUpdates, []);
  } finally { delete globalThis.__siteSchedule; }
});
