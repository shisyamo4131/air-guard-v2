import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_LIFECYCLE_ERROR_CODES,
  SITE_STATUS,
  SITE_STATUS_SOURCE,
  SiteLifecycleError,
  autoTerminateSite,
  reactivateSite,
  terminateSite,
} from "../../functions/modules/sites/lifecycle.js";

function snapshot(data) {
  return { exists: data !== null, data: () => data };
}

function lifecycleHarness({
  identity = { uid: "actor-a", companyId: "company-a", isSuperUser: false },
  user = {
    docId: "actor-a", companyId: "company-a", isTemporary: false,
    disabled: false, isAdmin: false, roles: ["manager"],
  },
  system = { isMaintenance: false },
  site = {
    docId: "site-a", status: SITE_STATUS.ACTIVE, customerId: "customer-a",
    customer: { docId: "customer-a" }, agreementsV2: [{ docId: "agreement-a" }],
  },
  futureSchedules = [],
  unprocessedSchedules = [],
} = {}) {
  const updates = [];
  const queryReads = [];
  const firestore = {
    doc: (path) => ({ path }),
    collection: (path) => ({
      path,
      where(field, operator, value) {
        const constraints = [[field, operator, value]];
        return {
          path,
          constraints,
          where(nextField, nextOperator, nextValue) {
            constraints.push([nextField, nextOperator, nextValue]);
            return this;
          },
          limit(value) { this.limitValue = value; return this; },
        };
      },
    }),
    async runTransaction(callback) {
      return await callback({
        async get(reference) {
          if (reference.constraints) {
            queryReads.push(reference.constraints);
            const isUnprocessed = reference.constraints.some(([field]) => field === "operationResultId");
            const docs = isUnprocessed ? unprocessedSchedules : futureSchedules;
            return { empty: docs.length === 0, docs, size: docs.length };
          }
          if (reference.path === "System/system") return snapshot(system);
          if (reference.path.endsWith(`/Users/${identity.uid}`)) return snapshot(user);
          if (reference.path.endsWith("/Sites/site-a")) return snapshot(site);
          throw new Error(`Unexpected read: ${reference.path}`);
        },
        update(reference, data) { updates.push({ path: reference.path, data }); },
      });
    },
  };
  return { firestore, identity, queryReads, site, updates };
}

for (const [label, system] of [
  ["missing System document", null],
  ["active maintenance", { isMaintenance: true }],
  ["malformed maintenance flag", { isMaintenance: "false" }],
]) {
  test(`Site manual termination fails closed for ${label}`, async () => {
    const h = lifecycleHarness({ system });
    await assert.rejects(
      () => terminateSite({
        firestore: h.firestore,
        identity: h.identity,
        input: { siteId: "site-a", reason: "終了" },
      }),
      (error) => error instanceof SiteLifecycleError &&
        error.code === SITE_LIFECYCLE_ERROR_CODES.MAINTENANCE,
    );
    assert.deepEqual(h.updates, []);
  });
}

const allowedActors = [
  ["admin", { isAdmin: true, roles: [], isSuperUser: true }],
  ["manager", { isAdmin: false, roles: ["manager"], isSuperUser: false }],
  ["controller", { isAdmin: false, roles: ["controller"], isSuperUser: false }],
  ["legal", { isAdmin: false, roles: ["legal"], isSuperUser: false }],
  ["accountant", { isAdmin: false, roles: ["accountant"], isSuperUser: false }],
  ["role-less", { isAdmin: false, roles: [], isSuperUser: false }],
  ["unknown role", { isAdmin: false, roles: ["unknown"], isSuperUser: false }],
  ["non-admin super-user", { isAdmin: false, roles: [], isSuperUser: true }],
];

for (const [label, actor] of allowedActors) {
  test(`Site manual termination allows active same-tenant ${label} actor and writes lifecycle metadata only`, async () => {
    const identity = { uid: "actor-a", companyId: "company-a", isSuperUser: actor.isSuperUser };
    const h = lifecycleHarness({
      identity,
      user: {
        docId: "actor-a", companyId: "company-a", isTemporary: false,
        disabled: false, isAdmin: actor.isAdmin, roles: actor.roles,
      },
    });
    assert.deepEqual(
      await terminateSite({
        firestore: h.firestore,
        identity,
        input: { siteId: "site-a", reason: "  通常利用終了  " },
        now: new Date("2028-05-01T00:00:00.000Z"),
      }),
      { success: true, siteId: "site-a", status: SITE_STATUS.TERMINATED },
    );
    assert.equal(h.updates.length, 1);
    const patch = h.updates[0].data;
    assert.deepEqual(Object.keys(patch).sort(), [
      "status", "statusChangeReason", "statusChangeSource", "statusChangedAt",
      "statusChangedBy", "uid", "updatedAt",
    ].sort());
    assert.equal(patch.status, SITE_STATUS.TERMINATED);
    assert.equal(patch.statusChangeSource, SITE_STATUS_SOURCE.MANUAL);
    assert.equal(patch.statusChangedBy, "actor-a");
    assert.equal(patch.statusChangeReason, "通常利用終了");
    assert.equal(h.site.customerId, "customer-a");
    assert.deepEqual(h.site.agreementsV2, [{ docId: "agreement-a" }]);
    assert.deepEqual(h.queryReads, [
      [["siteId", "==", "site-a"], ["date", ">=", "2028-05-01"]],
      [["siteId", "==", "site-a"], ["operationResultId", "==", null]],
    ]);
  });
}

const deniedActors = [
  ["temporary", { roles: ["manager"], isTemporary: true }],
  ["disabled", { roles: ["manager"], disabled: true }],
  ["other tenant", { roles: ["manager"], companyId: "company-b" }],
  ["other uid", { roles: ["manager"], docId: "actor-b" }],
  ["malformed admin flag", { roles: ["manager"], isAdmin: undefined }],
];

for (const [label, overrides] of deniedActors) {
  test(`Site manual termination denies ${label} actor with write zero`, async () => {
    const identity = {
      uid: "actor-a", companyId: "company-a", isSuperUser: overrides.isSuperUser ?? false,
    };
    const h = lifecycleHarness({
      identity,
      user: {
        docId: overrides.docId ?? "actor-a",
        companyId: overrides.companyId ?? "company-a",
        isTemporary: overrides.isTemporary ?? false,
        disabled: overrides.disabled ?? false,
        isAdmin: Object.hasOwn(overrides, "isAdmin") ? overrides.isAdmin : false,
        roles: overrides.roles,
        permissions: overrides.permissions,
      },
    });
    await assert.rejects(
      () => terminateSite({
        firestore: h.firestore,
        identity,
        input: { siteId: "site-a", reason: "終了" },
      }),
      (error) => error instanceof SiteLifecycleError &&
        error.code === SITE_LIFECYCLE_ERROR_CODES.ACTOR_NOT_ALLOWED,
    );
    assert.deepEqual(h.updates, []);
  });
}

for (const [label, setup] of [
  ["future schedule", { futureSchedules: [{}] }],
  ["unprocessed schedule", { unprocessedSchedules: [{}] }],
  ["both schedule guards", { futureSchedules: [{}], unprocessedSchedules: [{}] }],
]) {
  test(`Site manual termination keeps Site and downstream documents unchanged with ${label}`, async () => {
    const h = lifecycleHarness(setup);
    const before = structuredClone(h.site);
    await assert.rejects(
      () => terminateSite({
        firestore: h.firestore,
        identity: h.identity,
        input: { siteId: "site-a", reason: "終了" },
      }),
      (error) => error.code === SITE_LIFECYCLE_ERROR_CODES.SCHEDULES_EXIST,
    );
    assert.deepEqual(h.updates, []);
    assert.deepEqual(h.site, before);
  });
}

test("Site manual termination rejects malformed schedule revision with write zero", async () => {
  const h = lifecycleHarness({ site: {
    docId: "site-a", status: SITE_STATUS.ACTIVE, scheduleRevision: "0",
    customerId: "customer-a", customer: { docId: "customer-a" }, agreementsV2: [],
  } });
  await assert.rejects(
    () => terminateSite({
      firestore: h.firestore,
      identity: h.identity,
      input: { siteId: "site-a", reason: "終了" },
    }),
    (error) => error instanceof SiteLifecycleError &&
      error.code === SITE_LIFECYCLE_ERROR_CODES.INVALID_STATE,
  );
  assert.deepEqual(h.updates, []);
});

test("Site reactivation preserves Customer and downstream data while writing strict dates and metadata", async () => {
  const h = lifecycleHarness({ site: {
    docId: "site-a", status: SITE_STATUS.TERMINATED, customerId: null,
    customer: null, agreementsV2: [{ docId: "agreement-a" }],
  } });
  await reactivateSite({
    firestore: h.firestore,
    identity: h.identity,
    input: {
      siteId: "site-a", reason: "継続再開",
      constructionPeriodStartDate: "2028-02-29",
      constructionPeriodEndDate: "2028-03-31",
    },
  });
  assert.equal(h.updates.length, 1);
  assert.deepEqual(Object.keys(h.updates[0].data).sort(), [
    "constructionPeriodEndAt", "constructionPeriodStartAt", "hasConstructionPeriod",
    "hasConstructionPeriodEndAt", "hasConstructionPeriodStartAt", "status",
    "statusChangeReason", "statusChangeSource", "statusChangedAt", "statusChangedBy",
    "uid", "updatedAt",
  ].sort());
  assert.equal(h.updates[0].data.status, SITE_STATUS.ACTIVE);
  assert.equal(h.updates[0].data.statusChangeSource, SITE_STATUS_SOURCE.REACTIVATION);
  assert.equal(h.site.customerId, null);
  assert.equal(h.site.customer, null);
  assert.deepEqual(h.site.agreementsV2, [{ docId: "agreement-a" }]);
});

test("Automatic termination rechecks candidate, accepts missing revision, and writes exact system metadata", async () => {
  const h = lifecycleHarness({ site: {
    docId: "site-a", status: SITE_STATUS.ACTIVE, customerId: "customer-a",
    customer: { docId: "customer-a" }, agreementsV2: [{ docId: "agreement-a" }],
    constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") },
  } });
  assert.equal(await autoTerminateSite({
    firestore: h.firestore,
    siteReference: { path: "Companies/company-a/Sites/site-a" },
    now: new Date("2028-04-01T15:00:00.000Z"),
  }), true);
  assert.equal(h.updates.length, 1);
  assert.deepEqual(Object.keys(h.updates[0].data).sort(), [
    "status", "statusChangeReason", "statusChangeSource", "statusChangedAt",
    "statusChangedBy", "uid", "updatedAt",
  ].sort());
  assert.equal(h.updates[0].data.status, SITE_STATUS.TERMINATED);
  assert.equal(h.updates[0].data.statusChangeSource, SITE_STATUS_SOURCE.AUTO);
  assert.equal(h.updates[0].data.statusChangedBy, "system");
  assert.equal(h.updates[0].data.statusChangeReason, "工期終了後90日経過");
});

for (const [label, setup] of [
  ["status race", { site: { status: SITE_STATUS.TERMINATED } }],
  ["future construction end", { site: {
    status: SITE_STATUS.ACTIVE,
    constructionPeriodEndAt: { toDate: () => new Date("2028-04-01T15:00:00.000Z") },
  } }],
  ["future schedule", { site: {
    status: SITE_STATUS.ACTIVE,
    constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") },
  }, futureSchedules: [{}] }],
  ["unprocessed schedule", { site: {
    status: SITE_STATUS.ACTIVE,
    constructionPeriodEndAt: { toDate: () => new Date("2028-01-01T15:00:00.000Z") },
  }, unprocessedSchedules: [{}] }],
]) {
  test(`Automatic termination leaves candidate unchanged after ${label}`, async () => {
    const h = lifecycleHarness(setup);
    assert.equal(await autoTerminateSite({
      firestore: h.firestore,
      siteReference: { path: "Companies/company-a/Sites/site-a" },
      now: new Date("2028-04-01T15:00:00.000Z"),
    }), false);
    assert.deepEqual(h.updates, []);
  });
}
