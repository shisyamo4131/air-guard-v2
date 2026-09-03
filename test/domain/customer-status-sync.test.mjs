import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Customer } from "../../schemas/index.js";

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
    schema: { Customer },
  };
  globalThis.__customerSyncHarness = injected;
  const executable = source.replace(/^import[^\n]*;\r?\n/gmu, "")
    .replace('await import("@shisyamo4131/air-guard-v2-schemas")', "schema");
  const moduleSource = `const {getFirestore, onDocumentUpdated, logger, schema} = globalThis.__customerSyncHarness;\n${executable}`;
  try {
    const module = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Math.random()}`);
    return { handler: module.onUpdateCustomer, paths, queries, updates, sites, schedules, otherTenant, commits: () => commits };
  } finally { delete globalThis.__customerSyncHarness; }
}

function event(status) {
  return { params: { companyId: "company-a", customerId: "customer-a" }, data: { after: { data: () => ({ docId: "customer-a", name: "合成取引先", contractStatus: status }) } } };
}

for (const status of [Customer.STATUS_TERMINATED, Customer.STATUS_ACTIVE]) {
  test(`Customer production sync projects ${status} only to matching tenant Sites, not Site status or schedules`, async () => {
    const h = await harness();
    const schedules = structuredClone(h.schedules);
    const otherTenant = structuredClone(h.otherTenant);
    assert.equal(await h.handler(event(status)), null);
    assert.deepEqual(h.paths, ["Companies/company-a/Sites"]);
    assert.equal(h.updates.length, 1);
    assert.deepEqual(Object.keys(h.updates[0].data), ["customer"]);
    assert.equal(h.sites[0].customer.contractStatus, status);
    assert.equal(h.sites[0].status, "ACTIVE");
    assert.deepEqual(h.schedules, schedules);
    assert.deepEqual(h.otherTenant, otherTenant);
    assert.equal(h.commits(), 1);
  });
}

test("Customer production sync with no Sites makes no batch writes", async () => {
  const h = await harness({ empty: true });
  await h.handler(event(Customer.STATUS_TERMINATED));
  assert.equal(h.commits(), 0);
  assert.deepEqual(h.updates, []);
});

test("Customer production sync propagates batch failure for trigger retry", async () => {
  const failure = new Error("synthetic batch failure");
  const h = await harness({ commitError: failure });
  await assert.rejects(() => h.handler(event(Customer.STATUS_TERMINATED)), (error) => error === failure);
  assert.equal(h.sites[0].customer.contractStatus, "ACTIVE");
});

test("Dedicated local Functions do not export the Customer update trigger", async () => {
  const source = await readFile(new URL("../../functions/codex-test/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /onUpdateCustomer|dependentSync/u);
});
