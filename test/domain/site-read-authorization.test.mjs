import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ref, watch, effectScope, nextTick } from "vue";
import { canReadSite } from "../../composables/domain/site/siteReadAuthorization.js";
import {
  createSiteDetailAccessSession,
  createSiteDetailReadSession,
  createSiteEmployeeCache,
} from "../../composables/domain/site/siteDetailAccessSession.js";

const valid = {
  uid: "user-1",
  companyId: "company-1",
  isEmailVerified: true,
  user: {
    docId: "user-1",
    companyId: "company-1",
    isTemporary: false,
    disabled: false,
  },
};

test("Site read requires the current active registered tenant user", () => {
  assert.equal(canReadSite(valid), true);
  assert.equal(canReadSite({ ...valid, isEmailVerified: false }), false);
  assert.equal(canReadSite({ ...valid, companyId: "company-2" }), false);
  assert.equal(canReadSite({ ...valid, user: { ...valid.user, docId: "user-2" } }), false);
});

test("temporary and disabled users fail closed and can recover", () => {
  assert.equal(canReadSite({
    ...valid,
    user: { ...valid.user, isTemporary: true },
  }), false);
  assert.equal(canReadSite({
    ...valid,
    user: { ...valid.user, disabled: true },
  }), false);
  assert.equal(canReadSite(valid), true);
});

test("User listener failure revokes and latches the same identity while old callbacks are ignored", () => {
  const listeners = [];
  const changes = [];
  const session = createSiteDetailAccessSession({
    listenToUser(context, listener) {
      const entry = { context, listener, stopped: false };
      listeners.push(entry);
      return () => { entry.stopped = true; };
    },
    onAccessChanged: (allowed) => changes.push(allowed),
  });

  session.start(valid);
  listeners[0].listener.next(valid.user);
  assert.deepEqual(changes, [true]);
  listeners[0].listener.error();
  assert.deepEqual(changes, [true, false]);
  assert.equal(listeners[0].stopped, true);

  session.start(valid);
  assert.equal(listeners.length, 1, "same identity must remain revoked");
  const nextIdentity = {
    ...valid,
    uid: "user-2",
    user: { ...valid.user, docId: "user-2" },
  };
  session.start(nextIdentity);
  assert.equal(listeners.length, 2);
  listeners[0].listener.next(valid.user);
  assert.deepEqual(changes, [true, false]);
  listeners[1].listener.next(nextIdentity.user);
  assert.deepEqual(changes, [true, false, true]);
  session.dispose();
  assert.equal(listeners[1].stopped, true);
  assert.deepEqual(changes, [true, false, true, false]);
});

test("an incomplete local User starts raw verification and only its canonical snapshot can allow", () => {
  const listeners = [];
  const changes = [];
  const session = createSiteDetailAccessSession({
    listenToUser(context, listener) {
      listeners.push({ context, listener });
      return () => {};
    },
    onAccessChanged: (allowed) => changes.push(allowed),
  });
  session.start({ ...valid, user: {} });
  assert.equal(listeners.length, 1);
  assert.deepEqual(changes, []);
  listeners[0].listener.next(valid.user);
  assert.deepEqual(changes, [true]);
});

test("a stale previous-identity local User does not latch a newly signed-in identity", () => {
  const listeners = [];
  const session = createSiteDetailAccessSession({
    listenToUser(context, listener) {
      listeners.push({ context, listener });
      return () => {};
    },
    onAccessChanged() {},
  });
  session.start({
    ...valid,
    uid: "user-2",
    user: valid.user,
  });
  assert.equal(listeners.length, 1);
});

test("an invalid canonical snapshot latches until a new identity starts", () => {
  const listeners = [];
  const changes = [];
  const session = createSiteDetailAccessSession({
    listenToUser(context, listener) {
      const entry = { context, listener, stopped: false };
      listeners.push(entry);
      return () => { entry.stopped = true; };
    },
    onAccessChanged: (allowed) => changes.push(allowed),
  });
  session.start({ ...valid, user: {} });
  listeners[0].listener.next({ ...valid.user, disabled: true });
  assert.equal(listeners[0].stopped, true);
  session.start(valid);
  assert.equal(listeners.length, 1);

  const nextIdentity = {
    ...valid,
    uid: "user-2",
    user: {},
  };
  session.start(nextIdentity);
  assert.equal(listeners.length, 2);
  listeners[1].listener.next({ ...valid.user, docId: "user-2" });
  assert.deepEqual(changes, [true]);
});

test("detail read session invalidates pending routes, scopes date refresh, and clears on revoke/unmount", () => {
  let clearCount = 0;
  const refreshed = [];
  const session = createSiteDetailReadSession({
    clearProtectedReads: () => { clearCount += 1; },
  });
  const first = session.begin("site-a");
  const second = session.begin("site-b");
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
  assert.equal(clearCount, 2);
  session.refreshDate((siteId) => refreshed.push(siteId));
  assert.deepEqual(refreshed, ["site-b"]);
  session.revoke();
  assert.equal(second.isCurrent(), false);
  assert.equal(clearCount, 3);
  session.refreshDate((siteId) => refreshed.push(siteId));
  assert.deepEqual(refreshed, ["site-b"]);
  session.dispose();
  assert.equal(clearCount, 4);
});

test("Employee cache shares current results and rejects an old tenant promise after clear", async () => {
  const pending = [];
  const cache = {};
  let scopeKey = "company-1";
  const employeeCache = createSiteEmployeeCache({
    cache,
    getScopeKey: () => scopeKey,
    loadEmployee(employeeId) {
      return new Promise((resolve) => pending.push({ employeeId, resolve }));
    },
  });

  const oldRequest = employeeCache.fetchEmployee("employee-1");
  await Promise.resolve();
  employeeCache.clear();
  scopeKey = "company-2";
  pending[0].resolve({ docId: "employee-1", displayName: "old tenant" });
  assert.equal(await oldRequest, null);
  assert.deepEqual(cache, {});

  const currentRequest = employeeCache.fetchEmployee("employee-1");
  await Promise.resolve();
  pending[1].resolve({ docId: "employee-1", displayName: "current tenant" });
  assert.equal((await currentRequest).displayName, "current tenant");
  assert.equal(cache["employee-1"].displayName, "current tenant");
  assert.equal(await employeeCache.fetchEmployee("employee-1"), cache["employee-1"]);
  assert.equal(pending.length, 2, "cached child/page reads share one load");
});

test("Site detail wires the runtime sessions to protected read cleanup", async () => {
  const source = await readFile(
    new URL("../../pages/sites/[id].vue", import.meta.url),
    "utf8",
  );
  assert.match(source, /useSiteDetailAccessGuard\(\)/u);
  assert.match(source, /function clearDetail[\s\S]*doc\.initialize\(\)[\s\S]*clearRelatedReads\(\)/u);
  assert.match(source, /function clearRelatedReads[\s\S]*historyInstance\.unsubscribe\(\)[\s\S]*displayedScheduleInstance[\s\S]*scheduleInstance/u);
  assert.match(source, /detailReadSession\.revoke\(\)[\s\S]*subscribeDetail\(id\)[\s\S]*flush: "sync"/u);
  assert.match(source, /detailReadSession\.refreshDate\(subscribeDisplayedSchedules\)/u);
  assert.match(source, /detailReadSession\.dispose\(\)/u);
  assert.match(source, /<template v-if="hasSite">/u);

  // Exercise the page's wiring/cleanup here. The Employee reader's raw User
  // authorization, old response rejection and live names are covered separately
  // by employee-reader.test.mjs, using the actual reader implementation.
  const calls = [], provided = [];
  const reader = { scope: ref(null), canRead: ref(false), cachedEmployees: ref({}),
    fetchEmployee: (ids) => calls.push(["fetch", [...ids]]), clearCache: () => { calls.push(["employee-clear"]); reader.cachedEmployees.value = {}; } };
  const collection = (name) => ({ docs: [], unsubscribe: () => calls.push([name]) });
  const historyInstance = collection("history-stop"), displayedScheduleInstance = collection("displayed-stop"), scheduleInstance = collection("schedule-stop");
  const canRead = ref(false), doc = { initialize: () => calls.push(["detail-clear"]), unsubscribe: () => calls.push(["detail-stop"]) };
  const bindings = { ref, watch, useFetchEmployee: () => reader, canRead, siteEmployeeHistories: historyInstance.docs,
    historyInstance, displayedScheduleInstance, scheduleInstance, doc, detailResolved: ref(false), detailError: ref(""), createSiteDetailReadSession,
    clearSiteReads: (scope) => calls.push(["site-clear", scope]), provide: (...args) => provided.push(args) };
  const readerSetup = source.slice(source.indexOf("const employeeReader ="), source.indexOf("const displayedScheduleInstance ="));
  const cleanup = source.slice(source.indexOf("function clearCollection("), source.indexOf("function subscribeDisplayedSchedules("));
  const effect = effectScope(); let session;
  effect.run(() => { session = new Function(...Object.keys(bindings), `${readerSetup}${cleanup}; return detailReadSession;`)(...Object.values(bindings)); });
  assert.deepEqual(provided, [["fetchEmployeeComposable", reader]], "descendants receive the entire authorized reader");
  historyInstance.docs.push({ employeeId: "employee" });
  reader.scope.value = "denied"; await nextTick(); assert.equal(calls.length, 0);
  reader.canRead.value = true; reader.scope.value = "employee-allowed"; await nextTick(); assert.equal(calls.length, 0, "Site denial still prevents related reads");
  canRead.value = true; reader.scope.value = "both-allowed"; await nextTick(); assert.deepEqual(calls.shift(), ["fetch", [{ employeeId: "employee" }]]);
  for (const transition of [() => session.begin("site"), () => session.revoke(), () => session.dispose()]) {
    reader.cachedEmployees.value = { employee: { displayName: "protected" } };
    for (const instance of [historyInstance, displayedScheduleInstance, scheduleInstance]) instance.docs.push({ protected: true });
    transition();
    assert.deepEqual(reader.cachedEmployees.value, {});
    for (const instance of [historyInstance, displayedScheduleInstance, scheduleInstance]) assert.deepEqual(instance.docs, []);
    assert.deepEqual(calls.splice(0), [["site-clear", "lookup"], ["detail-stop"], ["detail-clear"], ["employee-clear"], ["history-stop"], ["displayed-stop"], ["schedule-stop"]]);
  }
  effect.stop();
});
