import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SITE_CUSTOMER_PROJECTION_FIELDS = [
  "docId", "updatedAt", "code", "name", "abbreviation", "cutoffDate",
];

class Timestamp {
  constructor(date) { this.date = date; }
  static fromDate(date) { return new Timestamp(date); }
}

async function loadCustomerProjection() {
  const source = await readFile(
    new URL("../../functions/domain/siteCustomerProjection.js", import.meta.url),
    "utf8",
  );
  globalThis.__customerProjectionHarness = { Timestamp };
  const executable = source.replace(/^import[^\n]*;\r?\n/gmu, "");
  try {
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(`const { Timestamp } = globalThis.__customerProjectionHarness;\n${executable}`).toString("base64")}#${Math.random()}`,
    );
    assert.deepEqual(module.SITE_CUSTOMER_PROJECTION_FIELDS, SITE_CUSTOMER_PROJECTION_FIELDS);
    return module.createSiteCustomerProjection;
  } finally {
    delete globalThis.__customerProjectionHarness;
  }
}

// Execute the production handler body. Only Firestore, logging, registration,
// and schema loading are injected; no Functions/Emulator/network is started.
async function harness({ empty = false, commitError = null } = {}) {
  const source = await readFile(new URL("../../functions/modules/dependentSync.js", import.meta.url), "utf8");
  const paths = [];
  const queries = [];
  const updates = [];
  const sites = [{ status: "ACTIVE", customerId: "customer-a", customer: { contractStatus: "ACTIVE" } }];
  const schedules = [{ siteId: "site-a", status: "ACTIVE" }];
  const otherTenant = { status: "ACTIVE", customer: { contractStatus: "ACTIVE" } };
  let commits = 0;
  let projectionError = null;
  const productionCustomerProjection = await loadCustomerProjection();
  const db = {
    collection(path) {
      paths.push(path);
      assert.equal(path, "Companies/company-a/Sites");
      return { where(...args) {
        queries.push(args);
        assert.deepEqual(args, ["customerId", "==", "customer-a"]);
        return { get: async () => ({ empty, size: empty ? 0 : sites.length,
          docs: empty ? [] : sites.map((site) => ({ ref: site })) }) };
      } };
    },
    batch() { return {
      update(ref, data) { updates.push({ ref, data }); },
      async commit() {
        commits += 1;
        if (commitError) throw commitError;
        for (const { ref, data } of updates) Object.assign(ref, data);
      },
    }; },
  };
  const injected = {
    getFirestore: () => db,
    onDocumentUpdated: (path, handler) => {
      assert.equal(path, "Companies/{companyId}/Customers/{customerId}");
      return handler;
    },
    logger: { info() {}, warn() {}, error() {} },
    createSiteCustomerProjection: (...args) => {
      try {
        return productionCustomerProjection(...args);
      } catch (error) {
        projectionError = error;
        throw error;
      }
    },
  };
  globalThis.__customerSyncHarness = injected;
  const executable = source.replace(/^import[^\n]*;\r?\n/gmu, "");
  const moduleSource = `const {getFirestore, onDocumentUpdated, logger, createSiteCustomerProjection} = globalThis.__customerSyncHarness;\n${executable}`;
  try {
    const module = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Math.random()}`);
    return {
      handler: module.onUpdateCustomer,
      paths,
      queries,
      updates,
      sites,
      schedules,
      otherTenant,
      commits: () => commits,
      projectionError: () => projectionError,
    };
  } finally { delete globalThis.__customerSyncHarness; }
}

function customerEventData(overrides = {}) {
  return {
    docId: "customer-a",
    uid: "customer-actor",
    createdAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z")),
    updatedAt: Timestamp.fromDate(new Date("2026-09-05T00:00:00.000Z")),
    code: "C001",
    name: "合成取引先",
    branchName: null,
    abbreviation: "合成略称",
    nameKana: "ゴウセイトリヒキサキ",
    zipcode: "1000001",
    prefCode: "13",
    city: "千代田区",
    address: "千代田1-1",
    building: null,
    location: { formattedAddress: "合成住所", lat: 35.5, lng: 139.5 },
    geopoint: { latitude: 35.5, longitude: 139.5 },
    tel: "03-1234-5678",
    fax: "03-1234-5679",
    contractStatus: "TERMINATED",
    cutoffDate: 20,
    paymentMonth: 1,
    paymentDate: 25,
    remarks: "同期対象外",
    fullAddress: "東京都千代田区千代田1-1",
    prefecture: "東京都",
    tokenMap: { 合成: true },
    futureField: { version: 2 },
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    params: { companyId: "company-a", customerId: "customer-a" },
    data: { after: { data: () => customerEventData(overrides) } },
  };
}

test("Customer production sync writes only the exact six-field Site projection in the matching tenant", async () => {
  const h = await harness();
  const schedules = structuredClone(h.schedules);
  const otherTenant = structuredClone(h.otherTenant);
  const data = customerEventData();
  assert.equal(await h.handler(event()), null);
  assert.deepEqual(h.paths, ["Companies/company-a/Sites"]);
  assert.equal(h.updates.length, 1);
  assert.deepEqual(Object.keys(h.updates[0].data), ["customer"]);
  assert.deepEqual(Object.keys(h.sites[0].customer), [...SITE_CUSTOMER_PROJECTION_FIELDS]);
  assert.deepEqual(h.sites[0].customer, {
    docId: data.docId,
    updatedAt: data.updatedAt,
    code: data.code,
    name: data.name,
    abbreviation: data.abbreviation,
    cutoffDate: data.cutoffDate,
  });
  for (const field of [
    "contractStatus", "tel", "fax", "address", "location", "geopoint",
    "tokenMap", "futureField",
  ]) {
    assert.equal(Object.hasOwn(h.sites[0].customer, field), false, field);
  }
  assert.equal(h.sites[0].status, "ACTIVE");
  assert.deepEqual(h.schedules, schedules);
  assert.deepEqual(h.otherTenant, otherTenant);
  assert.equal(h.commits(), 1);
});

for (const [label, mutate, expectedMessage] of [
  ["missing", (data) => { delete data.name; }, "Missing Customer projection field: name"],
  ["malformed", (data) => { data.cutoffDate = 7; }, "Invalid Customer projection field: cutoffDate"],
]) {
  test(`Customer production sync fails closed for ${label} required projection data`, async () => {
    const data = customerEventData();
    mutate(data);
    const h = await harness();
    let thrown = null;
    await assert.rejects(
      () => h.handler({
        params: { companyId: "company-a", customerId: "customer-a" },
        data: { after: { data: () => data } },
      }),
      (error) => {
        thrown = error;
        return error instanceof TypeError && error.message === expectedMessage;
      },
    );
    assert.equal(thrown, h.projectionError());
    assert.deepEqual(h.paths, []);
    assert.deepEqual(h.queries, []);
    assert.deepEqual(h.updates, []);
    assert.equal(h.commits(), 0);
  });
}

test("Customer production sync with no Sites makes no batch writes", async () => {
  const h = await harness({ empty: true });
  await h.handler(event());
  assert.equal(h.commits(), 0);
  assert.deepEqual(h.updates, []);
});

test("Customer production sync propagates batch failure for trigger retry", async () => {
  const failure = new Error("synthetic batch failure");
  const h = await harness({ commitError: failure });
  await assert.rejects(() => h.handler(event()), (error) => error === failure);
  assert.equal(h.sites[0].customer.contractStatus, "ACTIVE");
});

test("Dedicated local Functions do not export the Customer update trigger", async () => {
  const source = await readFile(new URL("../../functions/codex-test/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /onUpdateCustomer|dependentSync/u);
});
