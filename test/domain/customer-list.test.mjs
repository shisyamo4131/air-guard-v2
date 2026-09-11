import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Customer } from "../../schemas/index.js";
import { normalizeTokenText } from "@shisyamo4131/air-firebase-v2/utils/tokenMap";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const stripImports = (source) => source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`);

test("Customer list repeats ACTIVE/TERMINATED/all using the real adapter listener replacement and cleanup", async () => {
  const adapter = await read("node_modules/@shisyamo4131/air-firebase-v2-client-adapter/index.js");
  const unsubscribe = adapter.match(/^  unsubscribe\(\) \{[\s\S]*?^  \}/mu)?.[0];
  const subscribeDocs = adapter.match(/^  subscribeDocs\([\s\S]*?^  \}/mu)?.[0];
  assert.ok(unsubscribe && subscribeDocs);
  const subscriptions = [];
  const constraintsSeen = [], tokenSearches = [];
  const routes = [];
  const lifecycle = {};
  globalThis.__customerList = {
    Customer, normalizeTokenText, subscriptions, constraintsSeen, tokenSearches, routes, lifecycle,
    collection: () => ({ withConverter() { return this; } }),
    query: (_ref, ...constraints) => constraints,
    onSnapshot: (constraints, callback) => {
      const entry = { constraints, callback, stopped: false };
      subscriptions.push(entry);
      return () => { entry.stopped = true; };
    },
  };
  try {
    const page = (await read("pages/customers/index.vue")).match(/<script setup>([\s\S]*?)<\/script>/u)[1];
    const module = await load(`
      const {Customer: RealCustomer, subscriptions, constraintsSeen, tokenSearches, routes, lifecycle, collection, query, onSnapshot} = globalThis.__customerList;
      const ClientAdapter = {firestore: null};
      class ClientAdapterError extends Error {}
      const ERRORS = {SYSTEM_UNKNOWN_ERROR: 'mock failure'};
      class Customer {
        static STATUS = RealCustomer.STATUS;
        static STATUS_ACTIVE = RealCustomer.STATUS_ACTIVE;
        static getCollectionPath() { return 'Companies/synthetic/Customers'; }
        static converter() { return {}; }
        docs = [];
        listener = null;
        createQueries(constraints) { constraintsSeen.push(constraints); return constraints; }
        createTokenMapQueries(text) { tokenSearches.push(text); return [["token", text]]; }
        _outputErrorConsole(_method, error) { throw error; }
        ${unsubscribe}
        ${subscribeDocs}
      }
      const defineOptions = () => {};
      const reactive = value => value;
      const ref = value => ({value});
      const normalizeTokenText = globalThis.__customerList.normalizeTokenText;
      const useRouter = () => ({push: route => routes.push(route)});
      const onMounted = callback => {lifecycle.mount = callback;};
      const onUnmounted = callback => {lifecycle.unmount = callback;};
      const watch = (_source, callback) => {lifecycle.change = callback;};
      ${stripImports(page)}
      export {customerInstance, search, selectedStatus, statusOptions, handleBeforeEdit};
    `);
    assert.equal(module.selectedStatus.value, Customer.STATUS_ACTIVE);
    assert.deepEqual(module.statusOptions, [...Object.values(Customer.STATUS), { title: "すべて", value: "ALL" }]);
    lifecycle.mount();
    const states = [Customer.STATUS_ACTIVE, Customer.STATUS_TERMINATED, "ALL", Customer.STATUS_ACTIVE, Customer.STATUS_TERMINATED, "ALL"];
    for (const [index, status] of states.entries()) {
      if (index > 0) { module.selectedStatus.value = status; lifecycle.change(); }
      assert.equal(module.customerInstance.docs.length, 0, "old rows cleared before new snapshot");
      assert.equal(subscriptions.filter(({ stopped }) => !stopped).length, 1);
      assert.deepEqual(constraintsSeen.at(-1), [
        ...(status === "ALL" ? [] : [["where", "contractStatus", "==", status]]),
        ["orderBy", "updatedAt", "desc"],
        ["limit", 20],
      ]);
      const entry = subscriptions.at(-1);
      const rows = [{ docId: `synthetic-${index}`, contractStatus: status === "ALL" ? "TERMINATED" : status }];
      entry.callback({ docChanges: () => rows.map((item) => ({ type: "added", doc: { data: () => item } })) });
      assert.deepEqual(module.customerInstance.docs, rows);
      assert.equal(module.handleBeforeEdit("UPDATE", rows[0]), false);
      assert.equal(routes.at(-1), `/customers/${rows[0].docId}`);
    }
    module.search.value = "やまだ";
    lifecycle.change();
    assert.equal(tokenSearches.at(-1), "ヤマダ");
    assert.deepEqual(constraintsSeen.at(-1), []);
    const routeCount = routes.length;
    assert.equal(module.handleBeforeEdit("CREATE", null), true);
    assert.equal(routes.length, routeCount);
    lifecycle.unmount();
    assert.equal(subscriptions.filter(({ stopped }) => !stopped).length, 0);
    assert.deepEqual(module.customerInstance.docs, []);
  } finally { delete globalThis.__customerList; }
});

test("Real useFetchCustomer/useFetchBase preserve TERMINATED search, ID fetch and cache selection", async () => {
  const queries = [];
  const ids = [];
  const active = { docId: "active", contractStatus: "ACTIVE" };
  const terminated = { docId: "terminated", contractStatus: "TERMINATED" };
  const errors = [];
  globalThis.__customerFetch = { queries, ids, active, terminated, errors };
  try {
    const module = await load(`
      const {queries, ids, active, terminated, errors} = globalThis.__customerFetch;
      class Customer {
        async fetchDocs(options) { queries.push(options); return [active, terminated]; }
        async fetchDoc({docId}) { ids.push(docId); return docId === terminated.docId ? terminated : active; }
      }
      const ref = value => ({value});
      const computed = getter => ({get value() {return getter();}});
      const useErrorsStore = () => ({});
      const useLogger = () => ({info() {}, warn() {}, error(error) {errors.push(error);}});
      ${stripImports(await read("composables/fetch/useFetchBase.js"))}
      ${stripImports(await read("composables/fetch/useFetchCustomer.js"))}
    `);
    const fetcher = module.useFetchCustomer();
    assert.equal(await fetcher.getCustomer({ customerId: "terminated" }), terminated);
    assert.deepEqual(ids, ["terminated"]);
    assert.deepEqual(await fetcher.searchCustomers("合成", { returnAllCached: false }), [active, terminated]);
    assert.deepEqual(queries, [{ constraints: "合成", options: [["limit", 50]] }]);
    assert.equal(await fetcher.getCustomer("terminated"), terminated);
    assert.deepEqual(ids, ["terminated"]);
    assert.ok(fetcher.cachedCustomersArray.value.includes(terminated));
    assert.deepEqual(errors, []);
  } finally { delete globalThis.__customerFetch; }
});
