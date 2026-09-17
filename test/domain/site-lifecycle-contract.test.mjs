import assert from "node:assert/strict";
import test from "node:test";
import { SiteOperationSchedule } from "@shisyamo4131/air-guard-v2-schemas";
import Site from "../../schemas/Site.js";

let scheduleDocs = [];
const originalFetchDocs = SiteOperationSchedule.prototype.fetchDocs;
SiteOperationSchedule.prototype.fetchDocs = async () => scheduleDocs;

function createSite(overrides = {}) {
  const site = new Site({
    docId: "site-a",
    uid: "owner-uid",
    status: Site.STATUS_ACTIVE,
    customerId: "customer-a",
    customer: { docId: "customer-a" },
    name: "現場A",
    address: "東京都千代田区1-1",
    agreementsV2: [{ docId: "agreement-a", rate: 1000 }],
    constructionPeriodStartAt: new Date("2028-01-01T00:00:00.000Z"),
    constructionPeriodEndAt: new Date("2028-01-31T00:00:00.000Z"),
    ...overrides,
  });
  site._beforeData = structuredClone(site.toObject());
  return site;
}

function setLifecycle(site, { status, source, reason, actor = "u".repeat(128) }) {
  site.status = status;
  site.statusChangeSource = source;
  site.statusChangeReason = reason;
  site.statusChangedAt = new Date("2028-02-01T00:00:00.000Z");
  site.statusChangedBy = actor;
}

test.after(() => {
  SiteOperationSchedule.prototype.fetchDocs = originalFetchDocs;
});

test("Site schema directly accepts manual termination with normalized dates and unrelated data preserved", async () => {
  scheduleDocs = [];
  const site = createSite();
  const before = structuredClone(site.toObject());
  setLifecycle(site, { status: Site.STATUS_TERMINATED, source: "MANUAL", reason: "通常利用終了" });

  await assert.doesNotReject(() => site.beforeUpdate());
  assert.equal(site.customerId, before.customerId);
  assert.equal(site.agreementsV2.length, before.agreementsV2.length);
  assert.equal(site.agreementsV2[0].docId, before.agreementsV2[0].docId);
  assert.equal(site.agreementsV2[0].rate, before.agreementsV2[0].rate);
  assert.equal(site.name, before.name);
  assert.equal(site.address, before.address);
  assert.equal(site.statusChangeReason, "通常利用終了");
  assert.equal(site.statusChangedAt.toISOString(), "2028-02-01T00:00:00.000Z");
});

test("Site schema accepts reactivation only with a new ordered period and unchanged Customer", async () => {
  const site = createSite({ status: Site.STATUS_TERMINATED });
  site._beforeData = structuredClone(site.toObject());
  setLifecycle(site, { status: Site.STATUS_ACTIVE, source: "REACTIVATION", reason: "  継続再開  " });
  site.constructionPeriodStartAt = new Date("2028-02-29T00:00:00.000Z");
  site.constructionPeriodEndAt = new Date("2028-03-31T00:00:00.000Z");

  await assert.doesNotReject(() => site.beforeUpdate());
  assert.equal(site.customerId, "customer-a");
  assert.equal(site.constructionPeriodStartAt.toISOString(), "2028-02-29T00:00:00.000Z");
  assert.equal(site.constructionPeriodEndAt.toISOString(), "2028-03-31T00:00:00.000Z");
});

test("Site schema rejects invalid transitions, missing or oversized reasons, bad periods, and Customer changes", async () => {
  const cases = [
    {
      label: "active to active lifecycle metadata",
      setup: (site) => { site.status = "UNKNOWN"; site.statusChangeReason = "理由"; },
    },
    {
      label: "missing reason",
      setup: (site) => setLifecycle(site, { status: Site.STATUS_TERMINATED, source: "MANUAL", reason: "" }),
    },
    {
      label: "reason over 200 characters",
      setup: (site) => setLifecycle(site, { status: Site.STATUS_TERMINATED, source: "MANUAL", reason: "x".repeat(201) }),
    },
    {
      label: "termination changes period",
      setup: (site) => { setLifecycle(site, { status: Site.STATUS_TERMINATED, source: "MANUAL", reason: "終了" }); site.constructionPeriodEndAt = new Date("2028-02-01T00:00:00.000Z"); },
    },
    {
      label: "reactivation missing period",
      setup: (site) => { site.status = Site.STATUS_TERMINATED; site._beforeData = structuredClone(site.toObject()); setLifecycle(site, { status: Site.STATUS_ACTIVE, source: "REACTIVATION", reason: "再開" }); site.constructionPeriodEndAt = null; },
    },
    {
      label: "reactivation reverses period",
      setup: (site) => { site.status = Site.STATUS_TERMINATED; site._beforeData = structuredClone(site.toObject()); setLifecycle(site, { status: Site.STATUS_ACTIVE, source: "REACTIVATION", reason: "再開" }); site.constructionPeriodStartAt = new Date("2028-04-01T00:00:00.000Z"); site.constructionPeriodEndAt = new Date("2028-03-01T00:00:00.000Z"); },
    },
    {
      label: "reactivation changes Customer",
      setup: (site) => { site.status = Site.STATUS_TERMINATED; site._beforeData = structuredClone(site.toObject()); setLifecycle(site, { status: Site.STATUS_ACTIVE, source: "REACTIVATION", reason: "再開" }); site.constructionPeriodStartAt = new Date("2028-02-01T00:00:00.000Z"); site.constructionPeriodEndAt = new Date("2028-03-01T00:00:00.000Z"); site.customerId = "customer-b"; },
    },
    {
      label: "termination changes unrelated field",
      setup: (site) => { setLifecycle(site, { status: Site.STATUS_TERMINATED, source: "MANUAL", reason: "終了" }); site.name = "別名"; },
    },
    {
      label: "reactivation changes unrelated field",
      setup: (site) => { site.status = Site.STATUS_TERMINATED; site._beforeData = structuredClone(site.toObject()); setLifecycle(site, { status: Site.STATUS_ACTIVE, source: "REACTIVATION", reason: "再開" }); site.constructionPeriodStartAt = new Date("2028-02-01T00:00:00.000Z"); site.constructionPeriodEndAt = new Date("2028-03-01T00:00:00.000Z"); site.address = "大阪府大阪市1-1"; },
    },
  ];

  for (const { label, setup } of cases) {
    const site = createSite();
    setup(site);
    await assert.rejects(() => site.beforeUpdate(), undefined, label);
  }
});

test("Site schema rejects manual termination when a future or unprocessed schedule exists", async () => {
  for (const docs of [[{ docId: "future" }], [{ docId: "unprocessed" }]]) {
    scheduleDocs = docs;
    const site = createSite();
    setLifecycle(site, { status: Site.STATUS_TERMINATED, source: "MANUAL", reason: "終了" });
    await assert.rejects(
      () => site.beforeUpdate(),
      /JST当日以降の予定または未処理予定がある現場は終了できません/u,
    );
  }
  scheduleDocs = [];
});
