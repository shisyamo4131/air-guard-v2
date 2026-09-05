import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { computed, effectScope, onScopeDispose, reactive, ref, toValue, watch } from "vue";
import { createSiteDetailReadSession } from "../../composables/domain/site/siteDetailAccessSession.js";

const paths = [
  "composables/dataLayers/site/useSiteOperationRead.js",
  "composables/useSetRegularTime.js",
  "components/SiteOperationSchedule/CustomInput/index.vue",
  "components/OperationResult/CustomInput/index.vue",
];
const [readerSource, regularSource, scheduleSource, resultSource] = await Promise.all(
  paths.map((path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8")),
);
function executable(source) {
  return (source.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1] ?? source)
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace(/\bexport\s+/gu, "");
}
function evaluate(source, dependencies, returns) {
  return new Function(...Object.keys(dependencies), `${executable(source)}\nreturn ${returns};`)(
    ...Object.values(dependencies),
  );
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function settle() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}
const agreement = Object.freeze({
  startTime: "08:00", endTime: "17:00", isStartNextDay: false,
  breakMinutes: 60, regulationWorkMinutes: 480,
});
function site(docId = "site-a", overrides = {}) {
  return { docId, securityType: "TRAFFIC", getValidAgreement: async () => agreement, ...overrides };
}
function snapshot(value) {
  return { exists: () => value !== null, data: () => value };
}
function createHarness({ fetch, component, access = true } = {}) {
  const scope = effectScope();
  const auth = reactive({ companyId: "company-a", uid: "actor-a" });
  const canRead = ref(access);
  const item = reactive({
    siteId: "site-a", date: "2026-09-06", shiftType: "DAY", securityType: "UNSET",
    startTime: "09:00", endTime: "18:00", isStartNextDay: false,
    breakMinutes: 0, regulationWorkMinutes: 540,
  });
  const messages = [];
  const requests = [];
  const callbacks = [];
  const updates = [];
  const props = reactive({ item, disabled: false, componentAttrs: {}, updateProperties(fields) {
    updates.push(fields);
    Object.assign(item, fields);
  } });
  const dependencies = {
    computed, onScopeDispose, watch, toValue, createSiteDetailReadSession,
    useNuxtApp: () => ({ $firestore: "synthetic-firestore" }),
    useAuthStore: () => auth,
    useSiteDetailAccessGuard: () => ({ canRead }),
    Site: { converter: () => "site-converter" },
    doc: (firestore, ...segments) => ({ withConverter: (converter) => ({ firestore, segments, converter }) }),
    getDoc: async (reference) => {
      requests.push(reference);
      return snapshot(await (fetch?.(reference) ?? site(reference.segments.at(-1))));
    },
    useMessagesStore: () => ({ add: (message) => messages.push(message) }),
  };
  dependencies.useSiteOperationRead = evaluate(readerSource, dependencies, "useSiteOperationRead");
  dependencies.useSetRegularTime = evaluate(regularSource, dependencies, "useSetRegularTime");
  let regular;
  scope.run(() => {
    if (component) {
      regular = evaluate(component === "schedule" ? scheduleSource : resultSource, {
        ...dependencies,
        defineProps: () => props,
        useDefaults: (value) => value,
        Operation: class {},
        onBeforeUnmount: onScopeDispose,
        attachSiteScheduleConfirmation: () => {},
        clearSiteScheduleConfirmation: () => {},
        useFetch: () => ({ fetchSiteComposable: { cachedSites: ref({}) } }),
      }, "({ set })");
    } else {
      regular = dependencies.useSetRegularTime({
        siteId: () => item.siteId,
        date: () => item.date,
        shiftType: () => item.shiftType,
        draftValues: () => [item.startTime, item.endTime, item.breakMinutes],
      }, (value) => callbacks.push(value));
    }
  });
  return { auth, callbacks, canRead, item, messages, props, regular, requests, scope, updates };
}

test("regular time loads the explicit company Site with no display cache or provider", async () => {
  const options = [];
  const harness = createHarness({ fetch: () => site("site-a", {
    getValidAgreement: async (input) => { options.push(input); return agreement; },
  }) });
  try {
    await harness.regular.set();
    assert.deepEqual(harness.requests, [{
      firestore: "synthetic-firestore", segments: ["Companies", "company-a", "Sites", "site-a"],
      converter: "site-converter",
    }]);
    assert.deepEqual(options, [{ date: "2026-09-06", shiftType: "DAY" }]);
    assert.deepEqual(harness.callbacks, [agreement]);
    assert.deepEqual(harness.messages, []);
  } finally { harness.scope.stop(); }
});

test("regular time validates inputs, handles missing Sites and Agreements, and retries read failures safely", async () => {
  for (const [field, text] of [["siteId", "現場"], ["date", "日付"], ["shiftType", "勤務区分"]]) {
    const harness = createHarness();
    try {
      harness.item[field] = null;
      await harness.regular.set();
      assert.equal(harness.requests.length, 0);
      assert.match(harness.messages[0].text, new RegExp(text));
    } finally { harness.scope.stop(); }
  }
  for (const value of [null, site("wrong-id"), site("site-a", { getValidAgreement: async () => null })]) {
    const harness = createHarness({ fetch: async () => value });
    try {
      await harness.regular.set();
      assert.equal(harness.callbacks.length, 0);
      assert.equal(harness.messages.length, 1);
    } finally { harness.scope.stop(); }
  }
  let failed = true;
  const harness = createHarness({ fetch: () => {
    if (failed) throw new Error("secret/path token synthetic failure");
    return site();
  } });
  try {
    await harness.regular.set();
    assert.equal(harness.callbacks.length, 0);
    assert.doesNotMatch(harness.messages[0].text, /secret|token|path/u);
    failed = false;
    await harness.regular.set();
    assert.deepEqual(harness.callbacks, [agreement]);
  } finally { harness.scope.stop(); }
});

const staleChanges = {
  site: (h) => { h.item.siteId = "site-b"; },
  date: (h) => { h.item.date = "2026-09-07"; },
  shift: (h) => { h.item.shiftType = "NIGHT"; },
  tenant: (h) => { h.auth.companyId = "company-b"; },
  actor: (h) => { h.auth.uid = "actor-b"; },
  access: (h) => { h.canRead.value = false; },
  unmount: (h) => h.scope.stop(),
  manualTime: (h) => { h.item.startTime = "11:00"; },
  siteRoundTrip: (h) => { h.item.siteId = "site-b"; h.item.siteId = "site-a"; },
  tenantRoundTrip: (h) => { h.auth.companyId = "company-b"; h.auth.companyId = "company-a"; },
  accessRoundTrip: (h) => { h.canRead.value = false; h.canRead.value = true; },
};
for (const [label, change] of Object.entries(staleChanges)) {
  test(`regular time discards stale Site and Agreement responses after ${label}`, async () => {
    for (const stage of ["site", "agreement"]) {
      const pending = deferred();
      const harness = createHarness({ fetch: () => stage === "site" ? pending.promise : site("site-a", {
        getValidAgreement: () => pending.promise,
      }) });
      try {
        const request = harness.regular.set();
        await settle();
        change(harness);
        pending.resolve(stage === "site" ? site() : agreement);
        await request;
        assert.deepEqual(harness.callbacks, []);
        assert.deepEqual(harness.messages, []);
      } finally { harness.scope.stop(); }
    }
  });
}

test("regular time discards stale failures and older concurrent clicks", async () => {
  const first = deferred();
  let reads = 0;
  const harness = createHarness({ fetch: () => ++reads === 1 ? first.promise : site() });
  try {
    const old = harness.regular.set();
    await harness.regular.set();
    first.reject(new Error("stale failure"));
    await old;
    assert.deepEqual(harness.callbacks, [agreement]);
    assert.deepEqual(harness.messages, []);
  } finally { harness.scope.stop(); }
});

test("operation readers wait for verified access and become usable after it arrives", async () => {
  for (const component of [undefined, "schedule"]) {
    const harness = createHarness({ component, access: false });
    try {
      await harness.regular.set();
      assert.deepEqual(harness.requests, []);
      harness.canRead.value = true;
      await settle();
      await harness.regular.set();
      if (component) assert.equal(harness.item.securityType, "TRAFFIC");
      else assert.deepEqual(harness.callbacks, [agreement]);
    } finally { harness.scope.stop(); }
  }
});

test("schedule keeps manual security type edits made before access verification completes", async () => {
  const harness = createHarness({ component: "schedule", access: false });
  try {
    harness.item.securityType = "FACILITY";
    harness.canRead.value = true;
    await settle();
    assert.deepEqual(harness.requests, []);
    assert.deepEqual(harness.updates, []);
    assert.equal(harness.item.securityType, "FACILITY");
  } finally { harness.scope.stop(); }
});

test("schedule preset Site security type awaits the explicit read without a provider", async () => {
  const pending = deferred();
  const harness = createHarness({ component: "schedule", fetch: () => pending.promise });
  try {
    assert.equal(harness.item.securityType, "UNSET");
    assert.equal(harness.requests.length, 1);
    pending.resolve(site());
    await settle();
    assert.equal(harness.item.securityType, "TRAFFIC");
    assert.deepEqual(harness.updates, [{ securityType: "TRAFFIC" }]);
  } finally { harness.scope.stop(); }
});

for (const [label, change] of Object.entries({
  manualType: (h) => { h.item.securityType = "FACILITY"; },
  ...Object.fromEntries(Object.entries(staleChanges).filter(([key]) => ["site", "tenant", "actor", "access", "unmount", "siteRoundTrip"].includes(key))),
})) {
  test(`schedule security type ignores stale responses after ${label}`, async () => {
    const pending = deferred();
    const unresolved = deferred();
    let reads = 0;
    const harness = createHarness({ component: "schedule", fetch: () => ++reads === 1 ? pending.promise : unresolved.promise });
    try {
      change(harness);
      pending.resolve(site());
      await settle();
      assert.deepEqual(harness.updates, []);
      assert.deepEqual(harness.messages, []);
    } finally { harness.scope.stop(); }
  });
}

test("schedule read failure preserves inputs and allows a later selection retry", async () => {
  let failed = true;
  const harness = createHarness({ component: "schedule", fetch: (reference) => {
    if (failed) throw new Error("private synthetic error");
    return site(reference.segments.at(-1));
  } });
  try {
    await settle();
    assert.equal(harness.item.securityType, "UNSET");
    assert.equal(harness.messages.length, 1);
    assert.doesNotMatch(harness.messages[0].text, /private/u);
    failed = false;
    harness.item.siteId = "site-b";
    await settle();
    assert.equal(harness.item.securityType, "TRAFFIC");
  } finally { harness.scope.stop(); }
});

for (const component of ["schedule", "result"]) {
  test(`${component} keeps the existing regular-time callback and protects all time draft fields`, async () => {
    const harness = createHarness({ component });
    try {
      await settle();
      harness.updates.length = 0;
      await harness.regular.set();
      assert.deepEqual(harness.updates, [agreement]);
      assert.equal(harness.messages.at(-1).color, "success");
    } finally { harness.scope.stop(); }
    for (const [field, value] of Object.entries({
      startTime: "10:00", endTime: "19:00", isStartNextDay: true,
      breakMinutes: 30, regulationWorkMinutes: 450,
    })) {
      const pending = deferred();
      const h = createHarness({ component, fetch: () => site("site-a", { getValidAgreement: () => pending.promise }) });
      try {
        await settle();
        h.updates.length = 0;
        const request = h.regular.set();
        await settle();
        h.item[field] = value;
        pending.resolve(agreement);
        await request;
        assert.deepEqual(h.updates, [], field);
        assert.equal(h.item[field], value);
        assert.deepEqual(h.messages, []);
      } finally { h.scope.stop(); }
    }
  });
}
