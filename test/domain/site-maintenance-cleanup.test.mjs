import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../functions/modules/maintenance.js", import.meta.url),
  "utf8",
);

const withoutImports = source.replace(/^import[\s\S]*?;\r?\n/gmu, "");

async function loadCleanup(db) {
  globalThis.__siteMaintenanceDb = db;
  const injected = `
    const dayjs = () => ({tz: () => ({subtract: () => ({format: () => "2028-01-01"})})});
    const onSchedule = (_options, callback) => callback;
    const FieldPath = {documentId: () => "__name__"};
    const getFirestore = () => globalThis.__siteMaintenanceDb;
    const logger = {info() {}, log() {}, error() {}};
    const sitesAutoTermination = async () => {};
    ${withoutImports}
    export {cleanUpSiteOperationSchedules};
  `;
  return await import(`data:text/javascript;base64,${Buffer.from(injected).toString("base64")}#${Math.random()}`);
}

function cleanupHarness(system) {
  const events = [];
  const schedule = {
    id: "schedule-a",
    ref: { path: "Companies/company-a/SiteOperationSchedules/schedule-a" },
    data: () => ({ operationResultId: "result-a" }),
  };
  const arrangement = { ref: { path: "Companies/company-a/ArrangementNotifications/a" } };
  const db = {
    doc(path) {
      assert.equal(path, "System/system");
      return {
        async get() {
          events.push("maintenance-read");
          return { exists: system !== null, data: () => system };
        },
      };
    },
    collectionGroup(name) {
      assert.equal(name, "SiteOperationSchedules");
      const query = {
        where() { return this; },
        orderBy() { return this; },
        limit() { return this; },
        startAfter() { return this; },
        async get() {
          events.push("schedule-query");
          return { empty: false, docs: [schedule], size: 1 };
        },
      };
      return query;
    },
    collection(path) {
      assert.equal(path, "Companies/company-a/ArrangementNotifications");
      return {
        where() {
          return { async get() { return { docs: [arrangement], size: 1 }; } };
        },
      };
    },
    batch() {
      return {
        delete(reference) { events.push(`delete:${reference.path}`); },
        async commit() { events.push("commit"); },
      };
    },
  };
  return { db, events };
}

for (const [label, system] of [
  ["missing System", null],
  ["malformed maintenance", { isMaintenance: "false" }],
  ["maintenance enabled", { isMaintenance: true }],
]) {
  test(`Site schedule cleanup fails closed with write zero for ${label}`, async () => {
    const h = cleanupHarness(system);
    const { cleanUpSiteOperationSchedules } = await loadCleanup(h.db);
    await assert.rejects(
      () => cleanUpSiteOperationSchedules(),
      /cleanup is disabled during maintenance/u,
    );
    assert.deepEqual(h.events, ["maintenance-read"]);
    delete globalThis.__siteMaintenanceDb;
  });
}

test("Site schedule cleanup checks maintenance before querying and processes only when false", async () => {
  const h = cleanupHarness({ isMaintenance: false });
  const { cleanUpSiteOperationSchedules } = await loadCleanup(h.db);
  await cleanUpSiteOperationSchedules();
  assert.deepEqual(h.events.slice(0, 3), [
    "maintenance-read", "maintenance-read", "schedule-query",
  ]);
  assert.deepEqual(h.events.filter((event) => event === "commit"), ["commit", "commit"]);
  assert.equal(h.events.some((event) => event.includes("ArrangementNotifications/a")), true);
  assert.equal(h.events.some((event) => event.includes("SiteOperationSchedules/schedule-a")), true);
  delete globalThis.__siteMaintenanceDb;
});

test("Site schedule cleanup source rechecks maintenance inside each pagination iteration", () => {
  assert.match(source, /await assertMaintenanceOff\(db\);[\s\S]*do \{[\s\S]*await assertMaintenanceOff\(db\);[\s\S]*query\.get\(\)/u);
});
