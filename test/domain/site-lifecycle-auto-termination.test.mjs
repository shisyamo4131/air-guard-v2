import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SITE_LIFECYCLE_ERROR_CODES,
  SITE_STATUS,
  SITE_STATUS_SOURCE,
  autoTerminateSite,
  isAutoTerminationDue,
} from "../../functions/modules/sites/lifecycle.js";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const stripImports = (source) => source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`);

function directAutoHarness({ site, system = { isMaintenance: false }, future = [], unprocessed = [] }) {
  const updates = [];
  const reads = [];
  const firestore = {
    doc(path) { return { kind: "doc", path }; },
    collection(path) {
      return {
        kind: "collection", path,
        where(field, operator, value) {
          return { kind: "query", path, constraints: [[field, operator, value]],
            where(nextField, nextOperator, nextValue) {
              this.constraints.push([nextField, nextOperator, nextValue]);
              return this;
            },
            limit(value) { this.limitValue = value; return this; } };
        },
      };
    },
    async runTransaction(callback) {
      return await callback({
        async get(reference) {
          reads.push(reference);
          if (reference.path === "System/system") return { exists: system !== null, data: () => system };
          if (reference.kind === "doc") return { exists: site !== null, data: () => site };
          const isUnprocessed = reference.constraints.some(([field]) => field === "operationResultId");
          const docs = isUnprocessed ? unprocessed : future;
          return { empty: docs.length === 0, docs, size: docs.length };
        },
        update(reference, data) { updates.push({ path: reference.path, data }); },
      });
    },
  };
  return { firestore, reads, updates };
}

async function loadAutoTermination() {
  return await load(`
    const FieldPath = {documentId: () => '__name__'};
    const Timestamp = {fromDate: date => ({date})};
    const logger = {info: (...args) => globalThis.__siteAuto.logs.push(args)};
    class SiteLifecycleError extends Error { constructor(code, message) { super(message); this.code = code; } }
    const SITE_LIFECYCLE_ERROR_CODES = {MAINTENANCE: 'maintenance'};
    const autoTerminateSite = options => globalThis.__siteAuto.autoTerminateSite(options);
    ${stripImports(await read("functions/modules/sites/autoTermination.js"))}
  `);
}

function firestoreHarness({ pages, system = { isMaintenance: false }, outcomes = new Map() }) {
  const queryLog = [];
  const calls = [];
  let pageIndex = 0;
  let maintenanceReads = 0;
  const chain = {
    where(...args) { queryLog.push(["where", ...args]); return this; },
    orderBy(...args) { queryLog.push(["orderBy", ...args]); return this; },
    limit(value) { queryLog.push(["limit", value]); return this; },
    startAfter(snapshot) { queryLog.push(["startAfter", snapshot.ref.path]); return this; },
    async get() {
      const docs = (pages[pageIndex++] ?? []).map((path) => ({ ref: { path } }));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  };
  const firestore = {
    doc(path) {
      assert.equal(path, "System/system");
      return { async get() { maintenanceReads += 1; return {
        exists: system !== null, data: () => system,
      }; } };
    },
    collectionGroup(name) { assert.equal(name, "Sites"); return chain; },
  };
  async function autoTerminateSite(options) {
    calls.push(options);
    const outcome = outcomes.get(options.siteReference.path);
    if (outcome instanceof Error) throw outcome;
    return outcome ?? false;
  }
  return {
    autoTerminateSite, calls, firestore, logs: [], queryLog,
    get maintenanceReads() { return maintenanceReads; },
  };
}

test("Automatic Site scan paginates with a stable cursor and rechecks every candidate", async () => {
  const paths = [
    "Companies/a/Sites/a", "Companies/a/Sites/b", "Companies/b/Sites/c",
  ];
  const h = firestoreHarness({
    pages: [paths.slice(0, 2), paths.slice(2)],
    outcomes: new Map([[paths[0], true], [paths[1], false], [paths[2], true]]),
  });
  globalThis.__siteAuto = h;
  try {
    const { sitesAutoTermination } = await loadAutoTermination();
    assert.deepEqual(await sitesAutoTermination({
      firestore: h.firestore, now: new Date("2028-04-01T15:00:00.000Z"), pageSize: 2,
    }), { processed: 3, terminated: 2 });
    assert.deepEqual(h.calls.map(({ siteReference }) => siteReference.path), paths);
    assert.equal(h.maintenanceReads, 3, "checked before scan and before each page");
    assert.ok(h.queryLog.some((entry) => entry[0] === "startAfter" && entry[1] === paths[1]));
    assert.deepEqual(h.queryLog.filter(([name]) => name === "orderBy"), [
      ["orderBy", "constructionPeriodEndAt", "asc"], ["orderBy", "__name__", "asc"],
      ["orderBy", "constructionPeriodEndAt", "asc"], ["orderBy", "__name__", "asc"],
    ]);
  } finally { delete globalThis.__siteAuto; }
});

for (const [label, system] of [
  ["missing maintenance document", null],
  ["maintenance enabled", { isMaintenance: true }],
  ["malformed maintenance flag", { isMaintenance: "false" }],
]) {
  test(`Automatic Site scan fails closed for ${label}`, async () => {
    const h = firestoreHarness({ pages: [[]], system });
    globalThis.__siteAuto = h;
    try {
      const { sitesAutoTermination } = await loadAutoTermination();
      await assert.rejects(
        () => sitesAutoTermination({ firestore: h.firestore }),
        (error) => error.code === "maintenance",
      );
      assert.deepEqual(h.calls, []);
    } finally { delete globalThis.__siteAuto; }
  });
}

test("Automatic Site scan propagates a candidate failure so partial processing is not reported as success", async () => {
  const failedPath = "Companies/a/Sites/b";
  const h = firestoreHarness({
    pages: [["Companies/a/Sites/a", failedPath]],
    outcomes: new Map([["Companies/a/Sites/a", true], [failedPath, new Error("synthetic failure")]]),
  });
  globalThis.__siteAuto = h;
  try {
    const { sitesAutoTermination } = await loadAutoTermination();
    await assert.rejects(
      () => sitesAutoTermination({ firestore: h.firestore, pageSize: 2 }),
      /synthetic failure/u,
    );
    assert.deepEqual(h.calls.map(({ siteReference }) => siteReference.path), [
      "Companies/a/Sites/a", failedPath,
    ]);
    assert.deepEqual(h.logs, []);

    const retry = firestoreHarness({
      pages: [["Companies/a/Sites/a", failedPath], []],
      outcomes: new Map([["Companies/a/Sites/a", false], [failedPath, true]]),
    });
    globalThis.__siteAuto = retry;
    assert.deepEqual(
      await sitesAutoTermination({ firestore: retry.firestore, pageSize: 2 }),
      { processed: 2, terminated: 1 },
    );
  } finally { delete globalThis.__siteAuto; }
});

test("auto termination uses the exact JST 90-day boundary", () => {
  const site = { constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") } };
  assert.equal(isAutoTerminationDue(site, new Date("2028-03-31T14:59:59.999Z")), false);
  assert.equal(isAutoTerminationDue(site, new Date("2028-03-31T15:00:00.000Z")), true);
});

test("autoTerminateSite executes the transaction and writes exact AUTO/system metadata", async () => {
  const h = directAutoHarness({
    site: {
      status: SITE_STATUS.ACTIVE,
      constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") },
    },
  });
  assert.equal(await autoTerminateSite({
    firestore: h.firestore,
    siteReference: { path: "Companies/company-a/Sites/site-a" },
    now: new Date("2028-03-31T15:00:00.000Z"),
  }), true);
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].path, "Companies/company-a/Sites/site-a");
  assert.equal(h.updates[0].data.status, SITE_STATUS.TERMINATED);
  assert.equal(h.updates[0].data.statusChangeSource, SITE_STATUS_SOURCE.AUTO);
  assert.equal(h.updates[0].data.statusChangedBy, "system");
  assert.equal(h.updates[0].data.statusChangeReason, "工期終了後90日経過");
});

for (const [label, setup] of [
  ["status race", { site: { status: SITE_STATUS.TERMINATED } }],
  ["future schedule", {
    site: { status: SITE_STATUS.ACTIVE, constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") } },
    future: [{ id: "future" }],
  }],
  ["unprocessed schedule", {
    site: { status: SITE_STATUS.ACTIVE, constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") } },
    unprocessed: [{ id: "unprocessed" }],
  }],
]) {
  test(`autoTerminateSite performs no write after ${label}`, async () => {
    const h = directAutoHarness(setup);
    assert.equal(await autoTerminateSite({
      firestore: h.firestore,
      siteReference: { path: "Companies/company-a/Sites/site-a" },
      now: new Date("2028-03-31T15:00:00.000Z"),
    }), false);
    assert.deepEqual(h.updates, []);
  });
}

test("autoTerminateSite accepts missing revision but rejects malformed revision atomically", async () => {
  const missing = directAutoHarness({
    site: { status: SITE_STATUS.ACTIVE, constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") } },
  });
  assert.equal(await autoTerminateSite({ firestore: missing.firestore, siteReference: { path: "Companies/company-a/Sites/site-a" }, now: new Date("2028-03-31T15:00:00.000Z") }), true);
  assert.equal(missing.updates.length, 1);

  for (const revision of [-1, 1.5, "0"]) {
    const h = directAutoHarness({
      site: { status: SITE_STATUS.ACTIVE, scheduleRevision: revision, constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") } },
    });
    await assert.rejects(
      () => autoTerminateSite({ firestore: h.firestore, siteReference: { path: "Companies/company-a/Sites/site-a" }, now: new Date("2028-03-31T15:00:00.000Z") }),
      (error) => error.code === SITE_LIFECYCLE_ERROR_CODES.INVALID_STATE,
    );
    assert.deepEqual(h.updates, []);
  }
});
