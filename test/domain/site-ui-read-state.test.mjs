import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  computed,
  effectScope,
  nextTick,
  onScopeDispose,
  reactive,
  readonly,
  ref,
  watch,
} from "vue";
import { sortSitesActiveFirst } from "../../composables/domain/site/siteUiPresentation.js";

const source = await readFile(
  new URL("../../composables/dataLayers/site/useSiteUiReads.js", import.meta.url),
  "utf8",
);
const autocompleteSfc = await readFile(
  new URL("../../components/Site/Autocomplete.vue", import.meta.url),
  "utf8",
);
const autocompleteScript = autocompleteSfc.match(
  /<script setup>([\s\S]*?)<\/script>/u,
)?.[1];
assert.ok(autocompleteScript, "Site Autocomplete script setup is required");
const autocompleteExecutable = autocompleteScript.replace(
  /^import[\s\S]*?;\r?\n/gmu,
  "",
);
const terminatedPageSfc = await readFile(
  new URL("../../pages/sites/terminated.vue", import.meta.url),
  "utf8",
);
const terminatedPageScript = terminatedPageSfc.match(
  /<script setup>([\s\S]*?)<\/script>/u,
)?.[1];
assert.ok(terminatedPageScript, "terminated Site page script setup is required");
const terminatedPageExecutable = terminatedPageScript.replace(
  /^import[\s\S]*?;\r?\n/gmu,
  "",
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function createHarness({ fetchDocs, fetchDoc } = {}) {
  const cleanups = [];
  const queries = [];
  const lookups = [];
  class Site {
    static STATUS_TERMINATED = "TERMINATED";

    fetchDocs(options) {
      queries.push(options);
      return fetchDocs?.(options) ?? [];
    }

    fetchDoc(options) {
      lookups.push(options);
      return fetchDoc?.(options) ?? null;
    }
  }
  const Vue = {
    computed,
    onBeforeUnmount: (callback) => cleanups.push(callback),
    reactive,
    ref,
  };
  const transformed = source
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace(/\bexport\s+/gu, "");
  const factory = new Function(
    "Vue",
    "Site",
    "sortSitesActiveFirst",
    `${transformed}\nreturn { PAGE_SIZE, useSiteUiReads };`,
  );
  const module = factory(Vue, Site, sortSitesActiveFirst);
  return {
    ...module,
    cleanups,
    lookups,
    queries,
    reads: module.useSiteUiReads(),
  };
}

function createActiveReadHarness({ companyId = "company-a", onItem } = {}) {
  const auth = reactive({ companyId });
  const listeners = [];
  const collectionCalls = [];
  const loggerErrors = [];
  const converter = Object.freeze({ name: "Site.converter" });
  const Site = class {
    static STATUS_ACTIVE = "ACTIVE";

    static converter() {
      return converter;
    }
  };
  const collection = (firestore, ...segments) => {
    const call = { firestore, segments, converter: null };
    collectionCalls.push(call);
    return {
      withConverter(value) {
        call.converter = value;
        return { collection: call };
      },
    };
  };
  const where = (field, operator, value) => ({ field, operator, value });
  const query = (collectionReference, ...constraints) => ({
    collectionReference,
    constraints,
  });
  const onSnapshot = (siteQuery, next, error) => {
    const listener = {
      error,
      next,
      query: siteQuery,
      unsubscribeCalls: 0,
    };
    listeners.push(listener);
    return () => { listener.unsubscribeCalls += 1; };
  };
  const Vue = { onScopeDispose, readonly, ref, watch };
  const transformed = source
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace(/\bexport\s+/gu, "");
  const factory = new Function(
    "Vue",
    "collection",
    "onSnapshot",
    "query",
    "where",
    "Site",
    "sortSitesActiveFirst",
    "useAuthStore",
    "useLogger",
    "useNuxtApp",
    `${transformed}\nreturn { useActiveSiteLiveRead };`,
  );
  const module = factory(
    Vue,
    collection,
    onSnapshot,
    query,
    where,
    Site,
    sortSitesActiveFirst,
    () => auth,
    () => ({ error: (value) => loggerErrors.push(value) }),
    () => ({ $firestore: "FIRESTORE" }),
  );
  const scope = effectScope();
  const reads = scope.run(() => module.useActiveSiteLiveRead({ onItem }));
  return {
    auth,
    collectionCalls,
    converter,
    listeners,
    loggerErrors,
    reads,
    stop: () => scope.stop(),
  };
}

function emitSiteSnapshot(listener, items) {
  listener.next({
    docs: items.map((item) => ({ data: () => item })),
  });
}

async function flushAsyncWatchers() {
  await nextTick();
  await Promise.resolve();
  await Promise.resolve();
}

function createAutocompleteHarness({ modelValue = "original", lookupSite } = {}) {
  const props = reactive({
    creatable: false,
    itemTitle: "name",
    itemValue: "docId",
    label: "現場",
    modelValue,
    returnObject: false,
  });
  const emissions = [];
  const cleanups = [];
  const clears = [];
  const reads = {
    clear: (channel) => clears.push(channel),
    errorMessage: ref(""),
    isEmpty: ref(false),
    isLoading: ref(false),
    lookupSite: lookupSite ?? (async () => null),
    notFound: ref(false),
    searchAutocompleteSites: async () => [],
  };
  const factory = new Function(
    "defineOptions",
    "defineProps",
    "useDefaults",
    "defineEmits",
    "useSlots",
    "useSiteUiReads",
    "useAuthStore",
    "useSiteActions",
    "ref",
    "computed",
    "onBeforeUnmount",
    `${autocompleteExecutable}\nreturn { cancelTerminatedSelection, confirmDialog, confirmTerminatedSelection, onSelection, pendingSite };`,
  );
  const state = factory(
    () => {},
    () => props,
    (value) => value,
    () => (event, value) => emissions.push({ event, value }),
    () => ({}),
    () => reads,
    () => ({ companyId: "company-a" }),
    () => ({ canWrite: ref(true), isSaving: ref(false) }),
    ref,
    computed,
    (callback) => cleanups.push(callback),
  );
  return { ...state, cleanups, clears, emissions, props };
}

test("Site UI read contract fixes the client page size at 20", () => {
  const harness = createHarness();
  assert.equal(harness.PAGE_SIZE, 20);
  assert.equal(harness.reads.PAGE_SIZE, 20);
});

test("latest terminated search owns results and loading even while an older request is pending", async () => {
  const oldRequest = deferred();
  const newRequest = deferred();
  const requests = new Map([
    ["old", oldRequest],
    ["new", newRequest],
  ]);
  const harness = createHarness({
    fetchDocs: ({ constraints }) => requests.get(constraints).promise,
  });

  const oldResult = harness.reads.searchTerminatedSites(" old ");
  const newResult = harness.reads.searchTerminatedSites("new");
  assert.equal(harness.reads.isLoading.value, true);

  const expected = [{ docId: "latest", status: "TERMINATED" }];
  newRequest.resolve(expected);
  assert.deepEqual(await newResult, expected);
  assert.equal(
    harness.reads.isLoading.value,
    false,
    "a superseded request must not keep the current search in a loading state",
  );
  assert.equal(harness.reads.errorMessage.value, "");
  assert.equal(harness.reads.isEmpty.value, false);

  oldRequest.resolve([{ docId: "stale", status: "TERMINATED" }]);
  assert.deepEqual(await oldResult, expected);
  assert.equal(harness.reads.isLoading.value, false);
  assert.deepEqual(
    harness.queries.map(({ constraints, options }) => ({ constraints, options })),
    [
      {
        constraints: "old",
        options: [["where", "status", "==", "TERMINATED"]],
      },
      {
        constraints: "new",
        options: [["where", "status", "==", "TERMINATED"]],
      },
    ],
  );
});

test("a stale failure cannot replace the latest autocomplete result or error state", async () => {
  const stale = deferred();
  const latest = deferred();
  const requests = new Map([
    ["stale", stale],
    ["latest", latest],
  ]);
  const harness = createHarness({
    fetchDocs: ({ constraints }) => requests.get(constraints).promise,
  });

  const staleResult = harness.reads.searchAutocompleteSites("stale");
  const latestResult = harness.reads.searchAutocompleteSites("latest");
  latest.resolve([
    { docId: "terminated", status: "TERMINATED" },
    { docId: "active-a", status: "ACTIVE" },
    { docId: "active-b", status: "ACTIVE" },
  ]);
  const expected = ["active-a", "active-b", "terminated"];
  assert.deepEqual(
    (await latestResult).map(({ docId }) => docId),
    expected,
  );
  stale.reject(new Error("old request failed"));
  assert.deepEqual(
    (await staleResult).map(({ docId }) => docId),
    expected,
  );
  assert.deepEqual(harness.queries, [
    { constraints: "stale" },
    { constraints: "latest" },
  ]);
  assert.equal(harness.reads.errorMessage.value, "");
  assert.equal(harness.reads.isLoading.value, false);
});

test("latest Site search failure exposes a safe retryable state without a false zero result", async () => {
  const failure = new Error("private synthetic search detail");
  let shouldFail = true;
  const harness = createHarness({
    fetchDocs: () => shouldFail
      ? Promise.reject(failure)
      : [{ docId: "retried", status: "TERMINATED" }],
  });
  await assert.rejects(
    () => harness.reads.searchTerminatedSites("failure"),
    failure,
  );
  assert.equal(harness.reads.isLoading.value, false);
  assert.equal(harness.reads.isEmpty.value, false);
  assert.equal(harness.reads.notFound.value, false);
  assert.match(harness.reads.errorMessage.value, /現場情報を取得できませんでした/u);
  assert.doesNotMatch(harness.reads.errorMessage.value, /private synthetic/u);

  shouldFail = false;
  assert.deepEqual(await harness.reads.searchTerminatedSites("failure"), [
    { docId: "retried", status: "TERMINATED" },
  ]);
  assert.equal(harness.reads.errorMessage.value, "");
});

test("empty search and clear invalidate pending work and reset empty/error/not-found state", async () => {
  const pending = deferred();
  const harness = createHarness({ fetchDocs: () => pending.promise });
  const request = harness.reads.searchTerminatedSites("pending");
  assert.equal(harness.reads.isLoading.value, true);

  assert.deepEqual(await harness.reads.searchTerminatedSites("   "), []);
  assert.equal(harness.reads.errorMessage.value, "");
  assert.equal(harness.reads.isEmpty.value, false);
  assert.equal(harness.reads.notFound.value, false);
  assert.equal(harness.reads.isLoading.value, false);

  pending.reject(new Error("cleared request failed"));
  assert.deepEqual(await request, []);
  assert.equal(harness.reads.errorMessage.value, "");
});

test("terminated page integration keeps docs empty when an old query resolves after input is cleared", async () => {
  const pending = deferred();
  const readsHarness = createHarness({ fetchDocs: () => pending.promise });
  const scope = effectScope();
  const state = scope.run(() => {
    const factory = new Function(
      "ref",
      "watch",
      "useRouter",
      "PAGE_SIZE",
      "useSiteUiReads",
      "useSiteActions",
      `${terminatedPageExecutable}\nreturn { docs, page, search };`,
    );
    return factory(
      ref,
      watch,
      () => ({ push: () => undefined }),
      readsHarness.PAGE_SIZE,
      () => readsHarness.reads,
      () => ({ canWrite: ref(true) }),
    );
  });

  await flushAsyncWatchers();
  state.search.value = "pending";
  await flushAsyncWatchers();
  assert.equal(readsHarness.queries.length, 1);
  state.search.value = "";
  await flushAsyncWatchers();
  assert.deepEqual(state.docs.value, []);

  pending.resolve([{ docId: "stale-terminated", status: "TERMINATED" }]);
  await flushAsyncWatchers();
  assert.deepEqual(
    state.docs.value,
    [],
    "the page must not restore results belonging to the cleared search",
  );
  scope.stop();
});

test("ACTIVE Site live read uses the exact tenant-scoped ACTIVE query and distinguishes first nonempty and empty success", () => {
  const seen = [];
  const harness = createActiveReadHarness({ onItem: (item) => seen.push(item) });
  assert.equal(harness.listeners.length, 1);
  assert.deepEqual(harness.collectionCalls, [{
    firestore: "FIRESTORE",
    segments: ["Companies", "company-a", "Sites"],
    converter: harness.converter,
  }]);
  assert.deepEqual(harness.listeners[0].query.constraints, [{
    field: "status",
    operator: "==",
    value: "ACTIVE",
  }]);
  assert.equal(harness.reads.isLoading.value, true);
  assert.equal(harness.reads.isLoaded.value, false);

  const sites = [{ docId: "active-a" }, { docId: "active-b" }];
  emitSiteSnapshot(harness.listeners[0], sites);
  assert.deepEqual(harness.reads.items.value, sites);
  assert.deepEqual(seen, sites);
  assert.equal(harness.reads.isLoading.value, false);
  assert.equal(harness.reads.isLoaded.value, true);
  assert.equal(harness.reads.errorMessage.value, "");

  emitSiteSnapshot(harness.listeners[0], []);
  assert.deepEqual(harness.reads.items.value, []);
  assert.equal(harness.reads.isLoaded.value, true);
  assert.equal(harness.reads.errorMessage.value, "");
  harness.stop();
});

test("ACTIVE Site live read clears stale data on listener error without exposing private details", () => {
  const harness = createActiveReadHarness();
  emitSiteSnapshot(harness.listeners[0], [{ docId: "previous" }]);
  harness.listeners[0].error(new Error("private synthetic listener detail"));

  assert.deepEqual(harness.reads.items.value, []);
  assert.equal(harness.reads.isLoading.value, false);
  assert.equal(harness.reads.isLoaded.value, true);
  assert.match(harness.reads.errorMessage.value, /現場情報を取得できませんでした/u);
  assert.doesNotMatch(harness.reads.errorMessage.value, /private synthetic/u);
  assert.equal(harness.loggerErrors.length, 1);
  harness.stop();
});

test("ACTIVE Site live read replaces tenant generations and unsubscribes on tenant switch and unmount", async () => {
  const harness = createActiveReadHarness();
  const companyAListener = harness.listeners[0];
  harness.auth.companyId = "company-b";
  await nextTick();

  assert.equal(companyAListener.unsubscribeCalls, 1);
  assert.equal(harness.listeners.length, 2);
  assert.deepEqual(harness.collectionCalls[1].segments, ["Companies", "company-b", "Sites"]);
  emitSiteSnapshot(companyAListener, [{ docId: "stale-company-a" }]);
  assert.deepEqual(harness.reads.items.value, []);

  const companyBListener = harness.listeners[1];
  emitSiteSnapshot(companyBListener, [{ docId: "company-b-site" }]);
  assert.deepEqual(harness.reads.items.value, [{ docId: "company-b-site" }]);
  harness.stop();
  assert.equal(companyBListener.unsubscribeCalls, 1);
  assert.deepEqual(harness.reads.items.value, []);
  assert.equal(harness.reads.isLoaded.value, false);
  assert.equal(harness.reads.isLoading.value, false);

  emitSiteSnapshot(companyBListener, [{ docId: "after-unmount" }]);
  assert.deepEqual(harness.reads.items.value, []);
});

test("lookup distinguishes not-found from failure and clears stale detail state", async () => {
  const failure = new Error("synthetic lookup failure");
  const harness = createHarness({
    fetchDoc: ({ docId }) => {
      if (docId === "missing") return null;
      if (docId === "failure") throw failure;
      return { docId };
    },
  });

  assert.equal(await harness.reads.lookupSite("missing"), null);
  assert.equal(harness.reads.notFound.value, true);
  assert.equal(harness.reads.errorMessage.value, "");

  assert.deepEqual(await harness.reads.lookupSite("found"), { docId: "found" });
  assert.equal(harness.reads.notFound.value, false);
  await assert.rejects(() => harness.reads.lookupSite("failure"), failure);
  assert.equal(harness.reads.notFound.value, false);
  assert.match(harness.reads.errorMessage.value, /現場情報を取得できませんでした/u);

  assert.equal(await harness.reads.lookupSite(""), null);
  assert.equal(harness.reads.notFound.value, false);
  assert.equal(harness.reads.errorMessage.value, "");
  assert.deepEqual(harness.lookups, [
    { docId: "missing" },
    { docId: "found" },
    { docId: "failure" },
  ]);
});

test("unmount cleanup invalidates an outstanding lookup without surfacing its result", async () => {
  const pending = deferred();
  const harness = createHarness({ fetchDoc: () => pending.promise });
  const request = harness.reads.lookupSite("site-a");
  assert.equal(harness.cleanups.length, 1);
  harness.cleanups[0]();
  assert.equal(harness.reads.isLoading.value, false);
  pending.resolve({ docId: "site-a" });
  assert.equal(await request, null);
  assert.equal(harness.reads.notFound.value, false);
  assert.equal(harness.reads.errorMessage.value, "");
});

test("terminated Site cancellation restores the previously confirmed model while confirmation emits the candidate", async () => {
  const terminated = { docId: "terminated-a", status: "TERMINATED" };
  const cancelled = createAutocompleteHarness({ modelValue: "active-original" });
  await cancelled.onSelection(terminated);
  assert.equal(cancelled.confirmDialog.value, true);
  assert.deepEqual(cancelled.emissions, []);
  cancelled.cancelTerminatedSelection();
  assert.deepEqual(cancelled.emissions, [
    { event: "site-selection-confirmed", value: null },
    { event: "update:model-value", value: "active-original" },
  ]);

  const confirmed = createAutocompleteHarness({ modelValue: "active-original" });
  await confirmed.onSelection(terminated);
  confirmed.confirmTerminatedSelection();
  assert.deepEqual(confirmed.emissions, [
    {
      event: "site-selection-confirmed",
      value: {
        companyId: "company-a",
        siteId: "terminated-a",
        status: "TERMINATED",
      },
    },
    { event: "update:model-value", value: terminated },
  ]);
});

test("Autocomplete ignores stale lookup completion, restores not-found selection, and invalidates on unmount", async () => {
  const first = deferred();
  const second = deferred();
  const pending = new Map([
    ["first", first],
    ["second", second],
  ]);
  const harness = createAutocompleteHarness({
    lookupSite: (id) => pending.get(id)?.promise ?? null,
  });

  const firstSelection = harness.onSelection("first");
  const secondSelection = harness.onSelection("second");
  second.resolve({ docId: "second", status: "ACTIVE" });
  await secondSelection;
  assert.deepEqual(harness.emissions, [
    { event: "site-selection-confirmed", value: null },
    { event: "update:model-value", value: "second" },
  ]);
  first.resolve({ docId: "first", status: "TERMINATED" });
  await firstSelection;
  assert.equal(harness.confirmDialog.value, false);
  assert.equal(harness.emissions.length, 2);

  await harness.onSelection("missing");
  assert.deepEqual(harness.emissions.at(-1), {
    event: "update:model-value",
    value: "original",
  });

  const afterUnmount = deferred();
  const unmounted = createAutocompleteHarness({
    lookupSite: () => afterUnmount.promise,
  });
  const selection = unmounted.onSelection("pending");
  unmounted.cleanups[0]();
  afterUnmount.resolve({ docId: "pending", status: "ACTIVE" });
  await selection;
  assert.deepEqual(unmounted.emissions, []);
  assert.deepEqual(unmounted.clears, ["lookup", undefined]);
});
