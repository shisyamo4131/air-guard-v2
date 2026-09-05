import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const stripImports = (source) => source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`);

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
