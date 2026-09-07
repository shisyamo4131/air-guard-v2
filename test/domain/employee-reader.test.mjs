import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Vue from "vue";
import { Timestamp, GeoPoint } from "firebase/firestore";
import { Employee, User } from "@shisyamo4131/air-guard-v2-schemas";
import FireModel from "@shisyamo4131/air-firebase-v2";
import ClientAdapter from "@shisyamo4131/air-firebase-v2-client-adapter";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import * as contract from "../../functions/shared/employeeContract.js";
import * as rangeValidators from "../../composables/validators/rangeValidator.js";
import { createEmployeeReadSession } from "../../composables/domain/employee/employeeReadSession.js";
import { employeeReadLabel } from "../../composables/domain/employee/employeeReadLabel.js";
import { createEmployeeListSession } from "../../composables/domain/employee/employeeListSession.js";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await Vue.nextTick(); };
const raw = (docId = "employee", displayName = "合成従業員", extra = {}) => ({ docId, displayName, lastName: "合成", firstName: "従業員", employmentStatus: "ACTIVE", ...extra });
const record = (data) => ({ id: data.docId, raw: data });
const snapshot = (data, fromCache = false) => ({ metadata: { fromCache }, exists: () => data !== null, data: () => data });
const querySnapshot = (values, fromCache = false) => ({ metadata: { fromCache }, docs: values.map((value) => ({ id: value.docId, data: () => value })) });
async function factory(path, name, bindings) {
  const code = (await source(path)).replace(/import[\s\S]*?;\s*/gu, "").replaceAll("export function", "function");
  return new Function(...Object.keys(bindings), `${code}; return ${name};`)(...Object.values(bindings));
}
function coreHarness() {
  const listeners = [], searches = [];
  const session = createEmployeeReadSession({
    convert: (value) => new Employee(contract.rawForClass(value)),
    listen(scope, id, next, error) { const entry = { scope, id, next, error, stopped: false }; listeners.push(entry); return () => { entry.stopped = true; }; },
    search(scope, text, options) { const request = { scope, text, options, ...deferred() }; searches.push(request); return request.promise; },
  });
  session.setScope("company-A");
  return { session, listeners, searches };
}
function sdkHarness() {
  const listeners = [], queries = [];
  return { listeners, queries, bindings: {
    doc: (_, path) => ({ path }), collection: (_, path) => ({ path }), where: (...args) => args,
    query: (reference, ...constraints) => ({ ...reference, constraints }),
    onSnapshot(reference, options, next, error) { const entry = { reference, options, next, error, stopped: false }; listeners.push(entry); return () => { entry.stopped = true; }; },
    getDocsFromServer(reference) { const entry = { reference, ...deferred() }; queries.push(entry); return entry.promise; },
  } };
}
async function readerHarness(providedAccess) {
  const sdk = sdkHarness(), scope = providedAccess?.scope || Vue.ref(null), access = providedAccess || { scope, loading: Vue.ref(false), canRead: Vue.computed(() => scope.value !== null) };
  const make = await factory("composables/fetch/useFetchEmployee.js", "useFetchEmployee", { ...Vue, ...sdk.bindings, Employee, rawForClass: contract.rawForClass, createEmployeeReadSession, useEmployeeReadAccess: () => access, useNuxtApp: () => ({ $firestore: {} }) });
  const effect = Vue.effectScope(); let reader; effect.run(() => { reader = make(); });
  return { ...sdk, reader, scope, access, effect, allow: () => { scope.value = JSON.stringify(["company", "actor", false, true, []]); } };
}

async function authorizedListHarness() {
  FireModel.setAdapter(Object.create(ClientAdapter.prototype));
  const sdk = sdkHarness();
  const actor = { docId: "actor", companyId: "company", disabled: false, isTemporary: false, isAdmin: true, roles: [] };
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isEmailVerified: true, isSuperUserClaimValid: true, isSuperUser: false, user: actor });
  const bindings = { ...Vue, ...sdk.bindings, ...contract, Employee, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {} }) };
  const makeAccess = await factory("composables/application/employee/useEmployeeReadAccess.js", "useEmployeeReadAccess", bindings);
  const effect = Vue.effectScope(); let access, list;
  effect.run(() => { access = makeAccess(); });
  const makeList = await factory("composables/application/employee/useEmployeeList.js", "useEmployeeList", { ...bindings, createEmployeeListSession, useEmployeeReadAccess: () => access });
  effect.run(() => { list = makeList({ status: "ACTIVE", search: Vue.ref(""), fetchAllOnEmpty: true }); });
  return { ...sdk, auth, actor, access, list, effect };
}

for (const afterSuccess of [false, true]) test(`EMP08 actual list reports access failure and reloads raw authorization (prior success: ${afterSuccess})`, async () => {
  const h = await authorizedListHarness();
  try {
    const oldAccess = h.listeners[0];
    if (afterSuccess) {
      oldAccess.next(snapshot(h.actor)); h.listeners[1].next(querySnapshot([raw()]));
      assert.equal(h.list.docs.value.length, 1);
    }
    oldAccess.error(new Error("private transport detail"));
    assert.deepEqual(h.list.docs.value, []); assert.equal(h.list.loading.value, false);
    assert.equal(h.list.error.value, "従業員情報を取得できません。再読込してください。");
    const count = h.listeners.length;
    h.list.reload(); assert.equal(h.listeners.length, count + 1);
    const retried = h.listeners.at(-1);
    assert.equal(retried.reference.path, "Companies/company/Users/actor");
    assert.equal(h.list.loading.value, true); assert.equal(h.list.error.value, "");
    oldAccess.next(snapshot(h.actor)); oldAccess.error(new Error());
    assert.equal(h.access.canRead.value, false); assert.equal(h.list.loading.value, true);
    retried.next(snapshot(h.actor, true)); assert.equal(h.access.canRead.value, false);
    retried.next(snapshot(h.actor)); h.listeners.at(-1).next(querySnapshot([raw("fresh")]));
    assert.deepEqual(h.list.docs.value.map((item) => item.docId), ["fresh"]);
    const listCount = h.listeners.length;
    h.list.reload(); assert.equal(h.listeners.length, listCount + 1);
    assert.equal(h.listeners.at(-1).reference.path, "Companies/company/Employees", "ordinary reload keeps authorization listener");
  } finally { h.effect.stop(); }
});

test("EMP08 access failure cannot revive after auth loss or disposal, including stale callbacks", async () => {
  const h = await authorizedListHarness();
  const oldAccess = h.listeners[0]; oldAccess.next(snapshot(h.actor));
  const oldList = h.listeners[1]; oldList.next(querySnapshot([raw()]));
  oldAccess.error(new Error()); h.list.reload(); const retry = h.listeners.at(-1);
  assert.equal(retry.reference.path, "Companies/company/Users/actor");
  h.auth.isEmailVerified = false;
  assert.deepEqual(h.list.docs.value, []); assert.equal(h.list.loading.value, false);
  assert.equal(h.list.error.value, ""); const count = h.listeners.length;
  retry.next(snapshot(h.actor)); retry.error(new Error()); oldList.next(querySnapshot([raw("stale")]));
  h.list.reload(); assert.equal(h.listeners.length, count); assert.equal(h.access.canRead.value, false);
  h.auth.isEmailVerified = true; const active = h.listeners.at(-1);
  h.effect.stop(); const stoppedCount = h.listeners.length;
  active.next(snapshot(h.actor)); active.error(new Error()); h.access.reload();
  assert.equal(h.listeners.length, stoppedCount); assert.equal(h.access.canRead.value, false);
  assert.ok(h.listeners.every((entry) => entry.stopped));
});

test("EMP08 shared Employee reader settles pending reads and clears cached PII on access failure", async () => {
  const h = await authorizedListHarness(); const reader = await readerHarness(h.access);
  try {
    const waiting = reader.reader.getEmployee("employee");
    h.listeners[0].error(new Error()); assert.equal(await waiting, null);
    assert.equal(reader.reader.canRead.value, false); assert.equal(reader.reader.isLoading.value, false);
    h.access.reload(); h.listeners.at(-1).next(snapshot(h.actor));
    const next = reader.reader.getEmployee("employee"); reader.listeners[0].next(snapshot(raw()));
    assert.equal((await next).docId, "employee");
    const latestAccess = h.listeners.findLast((entry) => entry.reference.path.endsWith("Users/actor"));
    latestAccess.error(new Error());
    assert.deepEqual(reader.reader.cachedEmployees.value, {});
    reader.listeners[0].next(snapshot(raw("employee", "遅延氏名")));
    assert.deepEqual(reader.reader.cachedEmployees.value, {});
  } finally { reader.effect.stop(); h.effect.stop(); }
});

test("EMP05 reader subscribes only requested IDs once, upserts current Class, and keeps raw Timestamp precision", async () => {
  const { session, listeners } = coreHarness();
  const first = session.fetch("employee"), duplicate = session.fetch("employee"); assert.equal(first, duplicate); assert.equal(listeners.length, 1);
  const stamp = new Timestamp(1700000000, 123456789), point = new GeoPoint(35, 139);
  listeners[0].next(raw("employee", "旧名", { dateOfHire: stamp, location: point }));
  assert.ok((await first) instanceof Employee); assert.ok(session.get("employee").dateOfHire instanceof Date);
  assert.equal(session.raw("employee").dateOfHire.nanoseconds, 123456789); assert.equal(session.raw("employee").location, point);
  listeners[0].next(raw("employee", "新名", { dateOfHire: new Timestamp(1700000000, 123456789), location: new GeoPoint(35, 139) }));
  assert.equal(session.get("employee").displayName, "新名"); assert.equal(session.isLoading(), false);
  listeners[0].next(null); assert.equal(session.get("employee"), null); assert.equal(session.status("employee"), "missing");
});

test("EMP05 clear and tenant replacement discard protected cache, search, inflight, old success/error/finally", async () => {
  const { session, listeners, searches } = coreHarness();
  const oldFetch = session.fetch("employee"), oldSearch = session.find("旧");
  session.setScope("company-B"); assert.equal(await oldFetch, null); assert.equal(listeners[0].stopped, true);
  const fresh = session.fetch("employee"); assert.equal(session.isLoading(), true);
  listeners[0].next(raw("employee", "旧会社")); listeners[0].error(new Error()); searches[0].resolve([record(raw("employee", "旧検索"))]);
  assert.deepEqual(await oldSearch, []); assert.equal(session.isLoading(), true); assert.equal(session.isFailed(), false); assert.deepEqual(session.values(), []);
  listeners[1].next(raw("employee", "新会社")); await fresh; assert.equal(session.get("employee").displayName, "新会社");
  session.clear(); assert.deepEqual(session.values(), []); assert.equal(listeners[1].stopped, true); assert.equal(session.isLoading(), false);
  session.dispose(); listeners[1].next(raw()); assert.deepEqual(session.values(), []);
});

test("EMP05 search membership excludes unrelated cached IDs and rechecks a renamed member", async () => {
  const { session, listeners, searches } = coreHarness();
  void session.fetch("unrelated"); listeners[0].next(raw("unrelated", "別人"));
  const found = session.find("旧", { returnAllCached: false }); searches[0].resolve([record(raw("employee", "旧名"))]);
  assert.deepEqual((await found).map((value) => value.docId), ["employee"]);
  assert.equal(listeners.length, 2); listeners[1].next(raw("employee", "新名"));
  assert.deepEqual(session.results("旧"), []); assert.equal(searches.length, 2);
  searches[1].resolve([]); await flush();
  assert.deepEqual(await session.find("旧", { returnAllCached: false }), []);
  assert.equal(session.get("employee").displayName, "新名"); assert.equal(session.get("unrelated").displayName, "別人");
});

test("EMP05 older query cannot overwrite a newer ID subscription; query membership is re-read", async () => {
  const { session, listeners, searches } = coreHarness();
  void session.fetch("employee"); listeners[0].next(raw("employee", "旧名"));
  const found = session.find("名", { returnAllCached: false }); listeners[0].next(raw("employee", "最新名"));
  searches[0].resolve([record(raw("employee", "旧名"))]); await flush();
  assert.equal(searches.length, 2); assert.equal(session.get("employee").displayName, "最新名");
  searches[1].resolve([record(raw("employee", "最新名"))]); assert.equal((await found)[0].displayName, "最新名");
});

test("EMP05 query failure and missing raw identity clear every protected read until explicit reload", async () => {
  for (const failure of ["query", "identity", "document"]) {
    const h = coreHarness(); void h.session.fetch("employee"); h.listeners[0].next(raw());
    if (failure === "query") { const pending = h.session.find("名"); h.searches[0].reject(new Error("private details")); await pending; }
    else if (failure === "identity") h.listeners[0].next({ displayName: "invalid" });
    else h.listeners[0].error(new Error("private details"));
    assert.equal(h.session.isFailed(), true); assert.deepEqual(h.session.values(), []); assert.equal(h.session.isLoading(), false); assert.equal(h.listeners[0].stopped, true);
    await h.session.fetch("employee"); assert.equal(h.listeners.length, 1); h.session.clear(); void h.session.fetch("employee"); assert.equal(h.listeners.length, 2);
  }
});

test("EMP05 public fetch adapter retries after permission readiness, ignores cache snapshots, and never trusts Class pushes", async () => {
  const h = await readerHarness(); assert.equal(await h.reader.getEmployee("employee"), null); assert.equal(h.listeners.length, 0);
  h.allow(); const request = h.reader.fetchEmployee(["employee", { employeeId: "employee" }, { workerId: "other" }]); assert.equal(h.listeners.length, 2);
  h.listeners[0].next(snapshot(raw(), true)); assert.equal(h.reader.cachedEmployees.value.employee, undefined);
  h.listeners[0].next(snapshot(raw())); h.listeners[1].next(snapshot(null)); await request;
  h.reader.pushEmployee(new Employee(raw("employee", "untrusted"))); assert.equal(h.reader.cachedEmployees.value.employee.displayName, "合成従業員");
  assert.equal(h.reader.getStatus("other"), "missing"); h.scope.value = null;
  assert.deepEqual(h.reader.cachedEmployees.value, {}); assert.equal(h.reader.canRead.value, false); assert.ok(h.listeners.every((entry) => entry.stopped)); h.effect.stop();
});

test("EMP05 access requires each of seven allowed actors and both current Auth and raw User", async () => {
  const sdk = sdkHarness();
  const user = (role) => ({ docId: "actor", companyId: "company", disabled: false, isTemporary: false, isAdmin: role === "admin", roles: role === "admin" ? [] : [role] });
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isEmailVerified: true, isSuperUserClaimValid: true, isSuperUser: false, user: user("admin") });
  const make = await factory("composables/application/employee/useEmployeeReadAccess.js", "useEmployeeReadAccess", { ...Vue, ...sdk.bindings, ...contract, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {} }) });
  const effect = Vue.effectScope(); let access; effect.run(() => { access = make(); });
  for (const role of ["admin", ...contract.EMPLOYEE_ROLES]) {
    auth.user = user(role); const listener = sdk.listeners.at(-1);
    listener.next(snapshot(user(role), true)); assert.equal(access.canRead.value, false);
    listener.next(snapshot(user(role))); assert.equal(access.canRead.value, true, role);
    listener.next(snapshot({ ...user(role), disabled: true })); assert.equal(access.canRead.value, false);
  }
  auth.user = user("admin"); const old = sdk.listeners.at(-1); old.next(snapshot(user("admin"))); assert.equal(access.canRead.value, true);
  auth.isSuperUserClaimValid = false; assert.equal(access.canRead.value, false); old.next(snapshot(user("admin"))); old.error(new Error()); assert.equal(access.canRead.value, false);
  auth.isSuperUserClaimValid = true;
  for (const bad of [{ roles: ["unknown"], isAdmin: false }, { disabled: true }, { isTemporary: true }, { companyId: "elsewhere" }, { docId: "elsewhere" }]) {
    auth.user = { ...user("admin"), ...bad }; assert.equal(access.canRead.value, false);
  }
  auth.user = user("labor"); auth.isSuperUser = true; assert.equal(access.canRead.value, false);
  effect.stop(); assert.ok(sdk.listeners.every((entry) => entry.stopped));
});

test("EMP05 calls made during initial authorization retain requested IDs but never cross identity reset", async () => {
  const h = await readerHarness(); h.access.loading.value = true;
  const first = h.reader.getEmployee("employee"); assert.equal(h.listeners.length, 0);
  h.allow(); h.access.loading.value = false; await flush(); assert.equal(h.listeners.length, 1);
  h.listeners[0].next(snapshot(raw())); assert.equal((await first).docId, "employee");
  h.scope.value = null; h.access.loading.value = true; const old = h.reader.fetchEmployee("old-company-id");
  h.access.loading.value = false; h.access.loading.value = true; h.allow(); h.access.loading.value = false;
  await old; assert.equal(h.listeners.length, 1);
  h.scope.value = null; h.access.loading.value = true; const cleared = h.reader.fetchEmployee("cleared"); h.reader.clearCache(); h.allow(); await cleared;
  assert.equal(h.listeners.length, 1); h.effect.stop();
});

test("EMP05 actual raw User authorization resolves an already waiting first Employee ID", async () => {
  const sdk = sdkHarness(), actor = { docId: "actor", companyId: "company", disabled: false, isTemporary: false, isAdmin: true, roles: [] };
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isEmailVerified: true, isSuperUserClaimValid: true, isSuperUser: false, user: actor });
  const make = await factory("composables/application/employee/useEmployeeReadAccess.js", "useEmployeeReadAccess", { ...Vue, ...sdk.bindings, ...contract, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {} }) });
  const effect = Vue.effectScope(); let access; effect.run(() => { access = make(); });
  const h = await readerHarness(access); assert.equal(access.loading.value, true);
  const first = h.reader.getEmployee("employee"); assert.equal(h.listeners.length, 0);
  sdk.listeners[0].next(snapshot(actor)); await flush(); assert.equal(h.listeners.length, 1);
  h.listeners[0].next(snapshot(raw())); assert.equal((await first).displayName, "合成従業員");
  sdk.listeners[0].next(snapshot({ ...actor, disabled: true })); assert.equal(h.reader.canRead.value, false); assert.deepEqual(h.reader.cachedEmployees.value, {});
  h.effect.stop(); effect.stop();
});

test("EMP05 query adapter retains installed ngram constraints, limit, tenant and force refresh", async () => {
  // Only pure constraint builders are used: no adapter constructor or Firebase app/network.
  FireModel.setAdapter(Object.create(ClientAdapter.prototype));
  const h = await readerHarness(); h.allow();
  const options = { additionalConstraints: [["where", "employmentStatus", "==", "ACTIVE"]], limit: 7, returnAllCached: false };
  const result = h.reader.searchEmployees("合成", options);
  assert.equal(h.queries.length, 1); assert.equal(h.queries[0].reference.path, "Companies/company/Employees");
  const model = new Employee(); assert.deepEqual(h.queries[0].reference.constraints, [...model.createTokenMapQueries("合成"), ...model.createQueries([...options.additionalConstraints, ["limit", 7]])]);
  h.queries[0].resolve(querySnapshot([raw()])); assert.ok((await result)[0] instanceof Employee);
  await h.reader.searchEmployees("合成", options); assert.equal(h.queries.length, 1);
  const fresh = h.reader.searchEmployees("合成", { ...options, forceRefresh: true }); assert.equal(h.queries.length, 2);
  h.queries[1].resolve(querySnapshot([])); assert.deepEqual(await fresh, []); h.effect.stop();
});

test("EMP05 actual Autocomplete draft shows latest selected Class, exact query membership and clears on revocation", async () => {
  const h = await readerHarness();
  const props = Vue.reactive({ modelValue: "employee", itemValue: "docId", itemTitle: "displayName", returnObject: true, delay: 0 });
  const events = [], timers = [];
  const script = parse(await source("components/Employee/Autocomplete.vue")).descriptor.scriptSetup.content.replace(/import[\s\S]*?;\s*/gu, "");
  const bindings = { ...Vue, useFetch: () => ({ fetchEmployeeComposable: h.reader }), useDefaults: (value) => value, defineOptions() {}, defineProps: () => props, defineEmits: () => (...args) => events.push(args),
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {} };
  const effect = Vue.effectScope(); let autocomplete;
  effect.run(() => { autocomplete = new Function(...Object.keys(bindings), `${script}; return { model, items, search, requestedSearch };`)(...Object.values(bindings)); });
  assert.equal(autocomplete.model.value, null); h.allow(); await flush(); h.listeners[0].next(snapshot(raw("employee", "選択中")));
  assert.ok(autocomplete.model.value instanceof Employee); assert.equal(autocomplete.model.value.displayName, "選択中");
  h.listeners[0].next(snapshot(raw("employee", "更新表示"))); assert.equal(autocomplete.model.value.displayName, "更新表示");
  void h.reader.fetchEmployee("unrelated"); h.listeners[1].next(snapshot(raw("unrelated", "無関係")));
  autocomplete.search.value = "候補"; await flush(); timers.at(-1)(); h.queries[0].resolve(querySnapshot([raw("candidate", "候補従業員")])); await flush();
  assert.deepEqual(autocomplete.items.value.map((item) => item.docId), ["employee", "candidate"]);
  autocomplete.search.value = "検索"; await flush(); const late = timers.at(-1); h.scope.value = null; await flush(); late();
  assert.equal(h.queries.length, 1); assert.equal(autocomplete.model.value, null); assert.deepEqual(autocomplete.items.value, []); assert.equal(autocomplete.requestedSearch.value, "");
  assert.equal(props.modelValue, "employee"); assert.equal(events.some(([name]) => name === "update:model-value"), false);
  effect.stop(); h.effect.stop();
});

test("EMP05 period live reads combine ACTIVE and in-period RESIGNED without replaying another query's old raw", async () => {
  const h = await readerHarness(); h.allow(); const sdk = sdkHarness();
  const make = await factory("composables/dataLayers/employee/useEmployeesInRange.js", "useEmployeesInRange", { ...Vue, ...sdk.bindings, ...rangeValidators, useFetch: () => ({ fetchEmployeeComposable: h.reader }), useNuxtApp: () => ({ $firestore: {} }) });
  const from = Vue.ref(new Date("2026-01-01")), to = Vue.ref(new Date("2026-01-31")); const effect = Vue.effectScope(); let range;
  effect.run(() => { range = make({ from, to }); }); assert.equal(sdk.listeners.length, 2);
  assert.deepEqual(sdk.listeners[1].reference.constraints[2], ["dateOfTermination", ">=", from.value]);
  sdk.listeners[0].next(querySnapshot([raw()])); sdk.listeners[1].next(querySnapshot([raw("retired", "退職者", { employmentStatus: "RESIGNED" })]));
  assert.deepEqual(range.docs.value.map((item) => item.docId), ["employee", "retired"]); assert.ok(range.docs.value[1] instanceof Employee);
  sdk.listeners[0].next(querySnapshot([raw("employee", "更新後")]));
  h.listeners.at(-1).next(snapshot(raw("employee", "更新後"))); // differing query values require one original-ID confirmation
  sdk.listeners[1].next(querySnapshot([]));
  assert.equal(range.docs.value[0].displayName, "更新後"); assert.equal(h.listeners.at(-1).reference.path.split("/").at(-1), "retired");
  // A period removal must not masquerade as original-document deletion.
  h.listeners.at(-1).next(snapshot(raw("retired", "範囲外退職者", { employmentStatus: "RESIGNED" })));
  assert.equal(h.reader.cachedEmployees.value.retired.displayName, "範囲外退職者"); assert.equal(range.docs.value.length, 1);
  const prior = [...sdk.listeners]; from.value = new Date("2026-01-02"); assert.deepEqual(range.docs.value, []);
  prior[0].next(querySnapshot([raw("stale")])); prior[1].error(new Error()); assert.equal(h.reader.canRead.value, true); assert.deepEqual(range.docs.value, []);
  h.scope.value = null; assert.equal(range.loading.value, false); assert.ok(sdk.listeners.every((entry) => entry.stopped)); effect.stop(); h.effect.stop();
});

test("EMP05 snapshot period waits for both queries and discards old completions after range change", async () => {
  const h = await readerHarness(); h.allow(); const sdk = sdkHarness();
  const make = await factory("composables/dataLayers/employee/useEmployeesInRange.js", "useEmployeesInRange", { ...Vue, ...sdk.bindings, ...rangeValidators, useFetch: () => ({ fetchEmployeeComposable: h.reader }), useNuxtApp: () => ({ $firestore: {} }) });
  const from = Vue.ref(new Date("2026-01-01")), to = Vue.ref(new Date("2026-01-31")); const effect = Vue.effectScope(); let range;
  effect.run(() => { range = make({ from, to, snapshot: true }); }); sdk.queries[0].resolve(querySnapshot([raw()])); await flush(); assert.deepEqual(range.docs.value, []);
  to.value = new Date("2026-02-01"); sdk.queries[1].resolve(querySnapshot([])); await flush(); assert.deepEqual(range.docs.value, []);
  sdk.queries[2].resolve(querySnapshot([raw("fresh")])); sdk.queries[3].resolve(querySnapshot([])); await flush(); assert.equal(range.docs.value[0].docId, "fresh");
  effect.stop(); h.effect.stop();
});

test("EMP05 late same-generation period queries cannot overwrite an ID update or recreate its missing original", async () => {
  for (const snapshotMode of [false, true]) for (const nextRaw of [raw("employee", "個別購読の最新名"), null]) {
    const h = await readerHarness(); h.allow(); void h.reader.fetchEmployee("employee"); const sdk = sdkHarness();
    const make = await factory("composables/dataLayers/employee/useEmployeesInRange.js", "useEmployeesInRange", { ...Vue, ...sdk.bindings, ...rangeValidators, useFetch: () => ({ fetchEmployeeComposable: h.reader }), useNuxtApp: () => ({ $firestore: {} }) });
    const effect = Vue.effectScope(); let range;
    effect.run(() => { range = make({ from: Vue.ref(new Date("2026-01-01")), to: Vue.ref(new Date("2026-01-31")), snapshot: snapshotMode }); });
    h.listeners[0].next(snapshot(nextRaw));
    if (snapshotMode) { sdk.queries[0].resolve(querySnapshot([raw("employee", "古い期間応答")])); sdk.queries[1].resolve(querySnapshot([])); }
    else { sdk.listeners[0].next(querySnapshot([raw("employee", "古い期間応答")])); sdk.listeners[1].next(querySnapshot([])); }
    await flush();
    assert.equal(h.reader.getRaw("employee"), nextRaw); assert.equal(h.reader.getStatus("employee"), nextRaw ? "ready" : "missing");
    assert.deepEqual(range.docs.value.map((item) => item.displayName), nextRaw ? ["個別購読の最新名"] : []);
    // Even a repeated query delivery must not need another individual callback to repair the cache.
    if (!snapshotMode) sdk.listeners[0].next(querySnapshot([raw("employee", "さらに古い再送")]));
    assert.equal(h.reader.getRaw("employee"), nextRaw); assert.equal(h.listeners.length, 1); effect.stop(); h.effect.stop();
  }
});

test("EMP05 conflicting ACTIVE/RESIGNED query values converge through only that original ID in both arrival orders", async () => {
  for (const reverse of [false, true]) for (const snapshotMode of [false, true]) {
    const h = await readerHarness(); h.allow(); const sdk = sdkHarness();
    const make = await factory("composables/dataLayers/employee/useEmployeesInRange.js", "useEmployeesInRange", { ...Vue, ...sdk.bindings, ...rangeValidators, useFetch: () => ({ fetchEmployeeComposable: h.reader }), useNuxtApp: () => ({ $firestore: {} }) });
    const effect = Vue.effectScope(); let range;
    effect.run(() => { range = make({ from: Vue.ref(new Date("2026-01-01")), to: Vue.ref(new Date("2026-01-31")), snapshot: snapshotMode }); });
    const active = raw("employee", "旧在職情報", { dateOfHire: new Date("2025-01-01") });
    const resigned = { ...active, displayName: "最新退職情報", employmentStatus: "RESIGNED", dateOfTermination: new Date("2026-01-15") };
    const deliver = async (index, value) => {
      if (snapshotMode) sdk.queries[index].resolve(querySnapshot([value])); else sdk.listeners[index].next(querySnapshot([value]));
      await flush();
    };
    const [first, second] = reverse ? [[1, resigned], [0, active]] : [[0, active], [1, resigned]];
    await deliver(...first); assert.equal(h.listeners.length, 0, "initial query values do not subscribe all candidate IDs");
    if (!snapshotMode) { await deliver(...first); assert.equal(h.listeners.length, 0, "equal query delivery needs no extra original read"); }
    await deliver(...second); assert.equal(h.listeners.length, 1, "only the conflicting ID is confirmed");
    assert.equal(h.listeners[0].reference.path, "Companies/company/Employees/employee");
    h.listeners[0].next(snapshot(resigned));
    assert.equal(h.reader.getRaw("employee"), resigned); assert.equal(range.docs.value[0].displayName, "最新退職情報"); assert.equal(range.docs.value[0].employmentStatus, "RESIGNED");
    if (!snapshotMode) { await deliver(0, active); await deliver(1, resigned); }
    assert.equal(h.reader.getRaw("employee"), resigned); assert.equal(h.listeners.length, 1, "stale query repeats cannot rewind or re-subscribe a resolved ID");
    effect.stop(); h.effect.stop();
  }
});

test("EMP05 actual Tag and Worker displays distinguish idle/loading/denied/missing/error without an old name", async () => {
  const state = Vue.ref("idle"), worker = Vue.reactive({ id: "employee", isEmployee: true });
  const employee = { scope: Vue.ref(null), cachedEmployees: Vue.ref({ employee: { displayName: "前の氏名" } }), fetchEmployee() {}, getStatus: () => state.value };
  const outsourcer = { cachedOutsourcers: Vue.ref({ employee: { displayName: "外注先表示" } }), fetchOutsourcer() {} };
  const useFetch = () => ({ fetchEmployeeComposable: employee, fetchOutsourcerComposable: outsourcer });
  const effect = Vue.effectScope(), tagProps = Vue.reactive({ docId: "employee" }); let tag;
  const makeTag = await factory("components/Employee/Tag/useIndex.js", "useIndex", { Vue, useFetch, employeeReadLabel });
  effect.run(() => { tag = makeTag(tagProps, () => {}); });
  const labels = [];
  for (const file of ["components/Worker/Chip.vue", "components/Workers/Table/Tr.vue"]) {
    const script = parse(await source(file)).descriptor.scriptSetup.content.replace(/import[\s\S]*?;\s*/gu, "");
    const bindings = { ...Vue, employeeReadLabel, useFetch, useDefaults: (props) => props, defineProps: () => ({ worker, arrangementNotification: null }), OperationDetail: class {}, ArrangementNotification: class {} };
    effect.run(() => { labels.push(new Function(...Object.keys(bindings), `${script}; return displayName;`)(...Object.values(bindings))); });
  }
  for (const [status, label] of [["idle", "従業員未取得"], ["loading", "読込中"], ["denied", "閲覧不可"], ["missing", "従業員情報なし"], ["error", "取得失敗"], ["ready", "前の氏名"]]) {
    state.value = status; assert.equal(tag.attrs.value.label, label); assert.equal(tag.attrs.value.loading, status === "loading");
    for (const value of labels) assert.equal(value.value, label);
  }
  tagProps.docId = ""; assert.equal(tag.attrs.value.label, "従業員未取得"); assert.equal(tag.attrs.value.loading, false);
  worker.isEmployee = false; for (const value of labels) assert.equal(value.value, "外注先表示"); effect.stop();
});

test("EMP05 detail has no placeholder Employee and stops/clears User snapshots on missing, route and auth change", async () => {
  const h = await readerHarness(), sdk = sdkHarness(), id = Vue.ref("employee");
  const make = await factory("composables/application/employee/useEmployeeDetailRead.js", "useEmployeeDetailRead", { ...Vue, ...sdk.bindings, User, rawForClass: contract.rawForClass, useFetchEmployee: () => h.reader, useNuxtApp: () => ({ $firestore: {} }) });
  const effect = Vue.effectScope(); let detail; effect.run(() => { detail = make(() => id.value); }); assert.equal(detail.doc.value, null);
  h.allow(); h.listeners.at(-1).next(snapshot(raw())); assert.equal(detail.doc.value.docId, "employee");
  const userListener = sdk.listeners.at(-1); userListener.next(querySnapshot([{ docId: "user", employeeId: "employee" }])); assert.ok(detail.users.value[0] instanceof User);
  id.value = "next"; assert.equal(userListener.stopped, true); assert.deepEqual(detail.users.value, []); assert.equal(detail.doc.value, null);
  userListener.next(querySnapshot([{ docId: "stale" }])); userListener.error(new Error()); assert.deepEqual(detail.users.value, []); assert.equal(detail.userError.value, "");
  h.listeners.at(-1).next(snapshot(null)); assert.equal(detail.missing.value, true);
  h.scope.value = null; assert.equal(detail.canRead.value, false); assert.equal(detail.doc.value, null); effect.stop(); h.effect.stop();
});

test("EMP05 Site Employee connection uses the shared authorized reader and rejects old history callbacks", async () => {
  const code = parse(await source("pages/sites/[id].vue")).descriptor.scriptSetup.content;
  const h = await readerHarness(); h.allow();
  const historyInstance = { docs: [], unsubscribe() {}, subscribeDocs(_options, callback) { this.callback = callback; } };
  const other = { docs: [], unsubscribe() {} }, docId = Vue.ref("site"), canRead = Vue.ref(true);
  const bindings = { employeeReader: h.reader, fetchEmployee: h.reader.fetchEmployee, historyInstance, displayedScheduleInstance: other, scheduleInstance: { ...other, subscribeDocs() {} }, docId, canRead, subscribeDisplayedSchedules() {} };
  const extract = (name, next) => code.slice(code.indexOf(`function ${name}(`), code.indexOf(`\n${next}`, code.indexOf(`function ${name}(`)));
  const { clearRelated, subscribe } = new Function(...Object.keys(bindings), `let employeeHistoryGeneration = 0; ${extract("clearCollection", "function clearRelatedReads")}${extract("clearRelatedReads", "provide(")}${extract("subscribeRelatedReads", "async function subscribeDetail")}; return { clearRelated: clearRelatedReads, subscribe: subscribeRelatedReads };`)(...Object.values(bindings));
  assert.match(code, /provide\("fetchEmployeeComposable", employeeReader\)/); assert.doesNotMatch(code, /createSiteEmployeeCache/);
  subscribe("site"); historyInstance.callback({ employeeId: "employee" }); h.listeners[0].next(snapshot(raw("employee", "元名"))); await flush();
  h.listeners[0].next(snapshot(raw("employee", "変更名"))); assert.equal(h.reader.cachedEmployees.value.employee.displayName, "変更名");
  h.listeners[0].next(snapshot(null)); assert.equal(h.reader.cachedEmployees.value.employee, undefined);
  const oldHistory = historyInstance.callback; clearRelated(); oldHistory({ employeeId: "stale" }); assert.equal(h.listeners.length, 1);
  subscribe("site"); h.scope.value = null; historyInstance.callback({ employeeId: "denied" }); assert.equal(h.listeners.length, 1); assert.deepEqual(h.reader.cachedEmployees.value, {});
  // History subscription may precede Employee's independent raw User authorization.
  h.access.loading.value = true; historyInstance.callback({ employeeId: "authorized-later" }); h.allow(); h.access.loading.value = false; await flush(); assert.equal(h.listeners.length, 2);
  historyInstance.callback({ employeeId: "new-history" }); assert.equal(h.listeners.length, 3); h.effect.stop();
});

test("EMP05 changed Vue surfaces compile with statically resolvable autocomplete", async () => {
  for (const file of ["components/Employee/Autocomplete.vue", "components/Employee/Select.vue", "components/Worker/Chip.vue", "components/Workers/Table/Tr.vue", "pages/employees/[id].vue", "pages/sites/[id].vue"]) {
    const { descriptor, errors } = parse(await source(file), { filename: file }); assert.deepEqual(errors, [], file);
    const script = compileScript(descriptor, { id: file }); const template = compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } });
    assert.deepEqual(template.errors, [], file);
    if (file.endsWith("Autocomplete.vue")) assert.match(template.code, /_resolveComponent\("v-autocomplete"\)/);
  }
});
