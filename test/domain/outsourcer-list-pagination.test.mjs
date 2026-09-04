import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  computed,
  effectScope,
  isRef,
  nextTick,
  reactive,
  readonly,
  ref,
  watch,
} from "vue";
import {
  generateNGramTokens,
  normalizeTokenText,
} from "@shisyamo4131/air-firebase-v2/utils/tokenMap";

const paginationSource = await readFile(
  new URL(
    "../../composables/dataLayers/outsourcer/useOutsourcerListPagination.js",
    import.meta.url,
  ),
  "utf8",
);

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function documents(count, prefix = "item", status = "ACTIVE") {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    data: () => ({
      docId: `${prefix}-${String(index + 1).padStart(2, "0")}`,
      nameKana: `${prefix}-${String(index + 1).padStart(2, "0")}`,
      contractStatus: index % 2 === 0 ? status : "TERMINATED",
    }),
  }));
}

function createHarness({ companyId = "company-a", searchText = "" } = {}) {
  const auth = reactive({ companyId });
  const search = ref(searchText);
  const listeners = [];
  const trace = [];
  const errors = [];
  const documentIdSentinel = { type: "document-id" };

  function tagged(type, values) {
    const constraint = { type, values };
    trace.push(constraint);
    return constraint;
  }

  const dependencies = {
    collection(_firestore, ...segments) {
      const reference = {
        path: segments.join("/"),
        withConverter(converter) {
          return { ...reference, converter };
        },
      };
      trace.push({ type: "collection", path: reference.path });
      return reference;
    },
    documentId: () => documentIdSentinel,
    limit: (value) => tagged("limit", [value]),
    onSnapshot(builtQuery, onNext, onError) {
      const listener = {
        builtQuery,
        onNext,
        onError,
        unsubscribeCount: 0,
      };
      listeners.push(listener);
      return () => {
        listener.unsubscribeCount += 1;
      };
    },
    orderBy: (...values) => tagged("orderBy", values),
    query: (collectionReference, ...constraints) => ({
      collectionReference,
      constraints,
    }),
    startAfter: (value) => tagged("startAfter", [value]),
    where: (...values) => tagged("where", values),
    generateNGramTokens,
    normalizeTokenText,
    computed,
    isRef,
    onScopeDispose: (callback) => scope.cleanups.push(callback),
    readonly,
    ref,
    watch,
    Outsourcer: { converter: () => ({ type: "outsourcer-converter" }) },
    useLogger: () => ({ error: (entry) => errors.push(entry) }),
    useNuxtApp: () => ({ $firestore: { type: "firestore" } }),
    useAuthStore: () => auth,
  };

  const transformed = paginationSource
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace("export function useOutsourcerListPagination", "function useOutsourcerListPagination");
  const names = Object.keys(dependencies);
  const factory = new Function(
    ...names,
    `${transformed}\nreturn useOutsourcerListPagination;`,
  );
  const scope = effectScope();
  scope.cleanups = [];
  const usePagination = factory(...Object.values(dependencies));
  const pagination = scope.run(() => usePagination({ search }));

  function emit(index, docs) {
    listeners[index].onNext({ docs });
  }

  function fail(index, error = new Error("fixture failure")) {
    listeners[index].onError(error);
  }

  async function flush() {
    await nextTick();
    await Promise.resolve();
  }

  function stop() {
    for (const cleanup of scope.cleanups.splice(0)) cleanup();
    scope.stop();
  }

  return {
    auth,
    errors,
    fail,
    flush,
    listeners,
    pagination,
    search,
    stop,
    trace,
    emit,
  };
}

test("initial listener uses name ordering, document ID tie-break, and a 21-document look-ahead", async () => {
  const harness = createHarness();
  await harness.flush();
  assert.equal(harness.listeners.length, 1);
  const query = harness.listeners[0].builtQuery;

  assert.equal(query.collectionReference.path, "Companies/company-a/Outsourcers");
  assert.deepEqual(
    query.constraints.map(({ type }) => type),
    ["orderBy", "orderBy", "limit"],
  );
  assert.deepEqual(query.constraints[0].values, ["nameKana", "asc"]);
  assert.equal(query.constraints[1].values[0].type, "document-id");
  assert.equal(query.constraints[1].values[1], "asc");
  assert.deepEqual(query.constraints[2].values, [21]);

  harness.emit(0, documents(21));
  await harness.flush();
  assert.equal(harness.pagination.items.value.length, 20);
  assert.equal(harness.pagination.hasNextPage.value, true);
  assert.equal(harness.pagination.loaded.value, true);
  assert.equal(harness.pagination.loading.value, false);
  assert.deepEqual(
    new Set(harness.pagination.items.value.map((item) => item.contractStatus)),
    new Set(["ACTIVE", "TERMINATED"]),
  );

  harness.emit(0, documents(2, "live-update", "TERMINATED"));
  await harness.flush();
  assert.deepEqual(
    harness.pagination.items.value.map((item) => item.docId),
    ["live-update-01", "live-update-02"],
  );
  assert.equal(harness.listeners.length, 1);
  harness.stop();
});

test("two-character search uses only the real token generator's equality constraints", async () => {
  const harness = createHarness({ searchText: "Ab" });
  await harness.flush();
  const constraints = harness.listeners[0].builtQuery.constraints;
  const expectedTokens = generateNGramTokens(normalizeTokenText("Ab"));
  assert.equal(constraints.length, expectedTokens.length);
  assert.deepEqual(
    constraints.map(({ type }) => type),
    Array(expectedTokens.length).fill("where"),
  );
  assert.deepEqual(
    constraints.map(({ values }) => values),
    expectedTokens.map((token) => [`tokenMap.${token}`, "==", true]),
  );
  assert.equal(
    constraints.some(({ values }) =>
      values.some((value) => String(value).includes("code")),
    ),
    false,
  );
  assert.equal(
    constraints.some(({ values }) =>
      values.some((value) => String(value).includes("contractStatus")),
    ),
    false,
  );
  assert.equal(
    constraints.some(({ type }) =>
      ["orderBy", "limit", "startAfter"].includes(type),
    ),
    false,
  );

  harness.search.value = "x";
  await harness.flush();
  assert.equal(harness.listeners[0].unsubscribeCount, 1);
  assert.equal(harness.listeners.length, 1);
  assert.deepEqual(harness.pagination.items.value, []);
  assert.equal(harness.pagination.loaded.value, false);
  assert.equal(harness.pagination.currentPage.value, 1);
  harness.stop();
});

test("null, undefined, and raw empty searches use the normal list while invalid normalized lengths do not subscribe", async () => {
  for (const searchText of [null, undefined, ""]) {
    const harness = createHarness({ searchText });
    await harness.flush();
    assert.equal(harness.listeners.length, 1, String(searchText));
    assert.deepEqual(
      harness.listeners[0].builtQuery.constraints.map(({ type }) => type),
      ["orderBy", "orderBy", "limit"],
    );
    harness.stop();
  }

  for (const searchText of ["a", "   ", "a".repeat(41)]) {
    const harness = createHarness({ searchText });
    await harness.flush();
    assert.equal(harness.listeners.length, 0, JSON.stringify(searchText));
    assert.deepEqual(harness.pagination.items.value, []);
    assert.equal(harness.pagination.loaded.value, false);
    harness.stop();
  }
});

test("40 normalized characters subscribe with exactly the real token count and 41 do not", async () => {
  const fortyCharacters = "abcdefghij".repeat(4);
  const expectedTokens = generateNGramTokens(
    normalizeTokenText(fortyCharacters),
  );
  const harness = createHarness({ searchText: fortyCharacters });
  await harness.flush();
  assert.equal(harness.listeners.length, 1);
  assert.equal(
    harness.listeners[0].builtQuery.constraints.length,
    expectedTokens.length,
  );
  assert.deepEqual(
    harness.listeners[0].builtQuery.constraints.map(({ values }) => values),
    expectedTokens.map((token) => [`tokenMap.${token}`, "==", true]),
  );

  harness.search.value = `${fortyCharacters}k`;
  await harness.flush();
  assert.equal(harness.listeners[0].unsubscribeCount, 1);
  assert.equal(harness.listeners.length, 1);
  assert.equal(harness.pagination.loaded.value, false);
  harness.stop();
});

test("keyword results are fully subscribed, sorted, and paged in memory without replacing the listener", async () => {
  const harness = createHarness({ searchText: "ab" });
  await harness.flush();
  const unordered = documents(41, "match").reverse();
  harness.emit(0, unordered);
  await harness.flush();

  assert.deepEqual(
    harness.pagination.items.value.map((item) => item.docId),
    documents(20, "match").map(({ id }) => id),
  );
  assert.equal(harness.pagination.currentPage.value, 1);
  assert.equal(harness.pagination.hasNextPage.value, true);

  assert.equal(await harness.pagination.loadNext(), true);
  assert.equal(harness.listeners.length, 1);
  assert.equal(harness.pagination.currentPage.value, 2);
  assert.equal(harness.pagination.items.value[0].docId, "match-21");
  assert.equal(await harness.pagination.loadNext(), true);
  assert.equal(harness.pagination.currentPage.value, 3);
  assert.deepEqual(
    harness.pagination.items.value.map((item) => item.docId),
    ["match-41"],
  );
  assert.equal(harness.pagination.hasNextPage.value, false);
  assert.equal(await harness.pagination.loadPrevious(), true);
  assert.equal(harness.pagination.currentPage.value, 2);
  assert.equal(harness.listeners.length, 1);

  const updated = documents(2, "updated").reverse();
  harness.emit(0, updated);
  await harness.flush();
  assert.equal(harness.pagination.currentPage.value, 1);
  assert.deepEqual(
    harness.pagination.items.value.map((item) => item.docId),
    ["updated-01", "updated-02"],
  );
  harness.stop();
});

test("next and previous navigation replace listeners, preserve cursors, and suppress overlapping loads", async () => {
  const harness = createHarness();
  await harness.flush();
  const firstPage = documents(21, "first");
  harness.emit(0, firstPage);
  await harness.flush();

  const next = harness.pagination.loadNext();
  assert.equal(harness.listeners[0].unsubscribeCount, 1);
  assert.equal(harness.listeners.length, 2);
  assert.equal(await harness.pagination.loadNext(), false);
  assert.equal(harness.listeners.length, 2);
  assert.deepEqual(
    harness.listeners[1].builtQuery.constraints.at(-2),
    { type: "startAfter", values: [firstPage[19]] },
  );
  harness.emit(1, documents(3, "second"));
  assert.equal(await next, true);
  assert.equal(harness.pagination.currentPage.value, 2);
  assert.equal(harness.pagination.hasPreviousPage.value, true);

  const previous = harness.pagination.loadPrevious();
  assert.equal(harness.listeners[1].unsubscribeCount, 1);
  assert.equal(harness.listeners.length, 3);
  assert.equal(
    harness.listeners[2].builtQuery.constraints.some(
      ({ type }) => type === "startAfter",
    ),
    false,
  );
  harness.emit(2, firstPage.slice(0, 20));
  assert.equal(await previous, true);
  assert.equal(harness.pagination.currentPage.value, 1);
  assert.equal(harness.pagination.hasPreviousPage.value, false);
  harness.stop();
});

test("search and company resets unsubscribe, ignore stale callbacks, and unmount cleans up", async () => {
  const harness = createHarness();
  await harness.flush();
  harness.emit(0, documents(1, "original"));
  await harness.flush();

  harness.search.value = "new";
  await harness.flush();
  assert.equal(harness.listeners[0].unsubscribeCount, 1);
  assert.equal(harness.listeners.length, 2);
  harness.emit(0, documents(1, "stale-search"));
  await harness.flush();
  assert.deepEqual(harness.pagination.items.value, []);
  harness.emit(1, documents(1, "search-result"));
  await harness.flush();
  assert.equal(harness.pagination.items.value[0].docId, "search-result-01");

  harness.auth.companyId = "company-b";
  await harness.flush();
  assert.equal(harness.listeners[1].unsubscribeCount, 1);
  assert.equal(harness.listeners.length, 3);
  assert.equal(
    harness.listeners[2].builtQuery.collectionReference.path,
    "Companies/company-b/Outsourcers",
  );
  harness.emit(1, documents(1, "stale-company"));
  assert.deepEqual(harness.pagination.items.value, []);

  harness.stop();
  assert.equal(harness.listeners[2].unsubscribeCount, 1);
  harness.emit(2, documents(1, "stale-unmount"));
  assert.deepEqual(harness.pagination.items.value, []);
});

test("a first snapshot arriving before the reset watcher flush never commits stale list state", async () => {
  for (const change of ["search", "company"]) {
    const harness = createHarness();
    await harness.flush();
    if (change === "search") harness.search.value = "new-search";
    else harness.auth.companyId = "company-b";

    harness.emit(0, documents(21, `stale-${change}`));
    assert.deepEqual(harness.pagination.items.value, []);
    assert.equal(harness.pagination.loaded.value, false);
    assert.equal(harness.pagination.hasNextPage.value, false);
    assert.equal(harness.pagination.currentPage.value, 1);

    await harness.flush();
    assert.equal(harness.listeners.length, 2);
    harness.fail(1, new Error(`${change} replacement failed`));
    await harness.flush();
    assert.deepEqual(harness.pagination.items.value, []);
    assert.equal(harness.pagination.loaded.value, false);
    assert.equal(harness.pagination.hasNextPage.value, false);
    assert.equal(harness.pagination.currentPage.value, 1);
    harness.stop();
  }
});

test("restart and unmount invalidate a pending first snapshot synchronously", async () => {
  const restarting = createHarness();
  await restarting.flush();
  const restartPromise = restarting.pagination.restart();
  assert.equal(restarting.listeners[0].unsubscribeCount, 1);
  assert.equal(restarting.listeners.length, 2);
  restarting.emit(0, documents(21, "stale-restart"));
  assert.deepEqual(restarting.pagination.items.value, []);
  restarting.fail(1, new Error("restart listener failed"));
  assert.equal(await restartPromise, false);
  assert.equal(restarting.pagination.loaded.value, false);
  assert.equal(restarting.pagination.hasNextPage.value, false);
  restarting.stop();

  const unmounting = createHarness();
  await unmounting.flush();
  unmounting.stop();
  assert.equal(unmounting.listeners[0].unsubscribeCount, 1);
  unmounting.emit(0, documents(21, "stale-unmount-first"));
  assert.deepEqual(unmounting.pagination.items.value, []);
  assert.equal(unmounting.pagination.loaded.value, false);
  assert.equal(unmounting.pagination.hasNextPage.value, false);
});

test("a keyword listener initial failure exposes retry state without committing results", async () => {
  const harness = createHarness({ searchText: "keyword" });
  await harness.flush();
  assert.equal(
    harness.listeners[0].builtQuery.constraints.every(
      ({ type }) => type === "where",
    ),
    true,
  );

  harness.fail(0, new Error("keyword initial failure"));
  await harness.flush();
  assert.deepEqual(harness.pagination.items.value, []);
  assert.equal(harness.pagination.loaded.value, false);
  assert.equal(harness.pagination.currentPage.value, 1);
  assert.equal(harness.pagination.hasNextPage.value, false);
  assert.equal(harness.pagination.hasPreviousPage.value, false);
  assert.match(harness.pagination.errorMessage.value, /再試行/u);
  assert.equal(harness.errors.length, 1);
  harness.stop();
});

test("a keyword page-two live error is stable and retry clamps a shrunken result to page one", async () => {
  const harness = createHarness({ searchText: "keyword" });
  await harness.flush();
  harness.emit(0, documents(41, "keyword-page"));
  await harness.flush();
  assert.equal(await harness.pagination.loadNext(), true);
  assert.equal(harness.pagination.currentPage.value, 2);
  assert.equal(harness.pagination.items.value[0].docId, "keyword-page-21");
  assert.equal(harness.pagination.hasNextPage.value, true);

  harness.fail(0, new Error("keyword page two live error"));
  assert.equal(harness.pagination.currentPage.value, 2);
  assert.equal(harness.pagination.items.value[0].docId, "keyword-page-21");
  assert.equal(harness.pagination.hasPreviousPage.value, true);
  assert.equal(harness.pagination.hasNextPage.value, true);
  assert.match(harness.pagination.errorMessage.value, /再試行/u);

  const retry = harness.pagination.reload();
  assert.equal(harness.listeners.length, 2);
  assert.equal(
    harness.listeners[1].builtQuery.constraints.every(
      ({ type }) => type === "where",
    ),
    true,
  );
  harness.emit(1, documents(3, "keyword-shrunk"));
  assert.equal(await retry, true);
  assert.equal(harness.pagination.currentPage.value, 1);
  assert.deepEqual(
    harness.pagination.items.value.map((item) => item.docId),
    ["keyword-shrunk-01", "keyword-shrunk-02", "keyword-shrunk-03"],
  );
  assert.equal(harness.pagination.hasPreviousPage.value, false);
  assert.equal(harness.pagination.hasNextPage.value, false);
  assert.equal(harness.pagination.errorMessage.value, null);
  harness.stop();
});

test("clearing a valid keyword with null replaces it with the normal cursor listener", async () => {
  const harness = createHarness({ searchText: "keyword" });
  await harness.flush();
  assert.equal(
    harness.listeners[0].builtQuery.constraints.every(
      ({ type }) => type === "where",
    ),
    true,
  );
  harness.emit(0, documents(2, "keyword-result"));
  await harness.flush();

  harness.search.value = null;
  await harness.flush();
  assert.equal(harness.listeners[0].unsubscribeCount, 1);
  assert.equal(harness.listeners.length, 2);
  assert.deepEqual(
    harness.listeners[1].builtQuery.constraints.map(({ type }) => type),
    ["orderBy", "orderBy", "limit"],
  );
  assert.deepEqual(harness.listeners[1].builtQuery.constraints[0].values, [
    "nameKana",
    "asc",
  ]);
  assert.deepEqual(harness.listeners[1].builtQuery.constraints[2].values, [
    21,
  ]);
  assert.deepEqual(harness.pagination.items.value, []);
  assert.equal(harness.pagination.loaded.value, false);

  harness.emit(1, documents(21, "normal-list"));
  await harness.flush();
  assert.equal(harness.pagination.loaded.value, true);
  assert.equal(harness.pagination.items.value.length, 20);
  assert.equal(harness.pagination.hasNextPage.value, true);
  assert.equal(harness.pagination.currentPage.value, 1);
  harness.stop();
});

test("initial and subsequent listener failures keep the current page stable and retry the same cursor", async () => {
  const initialFailure = createHarness();
  await initialFailure.flush();
  initialFailure.fail(0);
  await initialFailure.flush();
  assert.equal(initialFailure.pagination.loaded.value, false);
  assert.deepEqual(initialFailure.pagination.items.value, []);
  assert.match(initialFailure.pagination.errorMessage.value, /再試行/u);
  assert.equal(initialFailure.errors.length, 1);
  initialFailure.stop();

  const harness = createHarness();
  await harness.flush();
  const page = documents(21, "stable");
  harness.emit(0, page);
  await harness.flush();
  harness.fail(0, new Error("subsequent snapshot failure"));
  assert.equal(harness.pagination.loaded.value, true);
  assert.equal(harness.pagination.currentPage.value, 1);
  assert.equal(harness.pagination.items.value[0].docId, "stable-01");
  assert.equal(harness.pagination.hasNextPage.value, true);
  assert.match(harness.pagination.errorMessage.value, /再試行/u);

  const next = harness.pagination.loadNext();
  harness.fail(1);
  assert.equal(await next, false);
  assert.equal(harness.pagination.currentPage.value, 1);
  assert.equal(harness.pagination.items.value[0].docId, "stable-01");
  assert.equal(harness.pagination.hasNextPage.value, true);
  assert.match(harness.pagination.errorMessage.value, /再試行/u);

  const retry = harness.pagination.reload();
  assert.equal(harness.listeners.length, 3);
  assert.equal(
    harness.listeners[2].builtQuery.constraints.some(
      ({ type }) => type === "startAfter",
    ),
    false,
  );
  harness.emit(2, documents(2, "retried"));
  assert.equal(await retry, true);
  assert.equal(harness.pagination.currentPage.value, 1);
  assert.equal(harness.pagination.items.value[0].docId, "retried-01");
  assert.equal(harness.pagination.errorMessage.value, null);
  harness.stop();
});

test("a page-two live-listener error retains page two and reloads from its existing cursor", async () => {
  const harness = createHarness();
  await harness.flush();
  const firstPage = documents(21, "page-one");
  harness.emit(0, firstPage);
  await harness.flush();

  const next = harness.pagination.loadNext();
  harness.emit(1, documents(21, "page-two"));
  assert.equal(await next, true);
  assert.equal(harness.pagination.currentPage.value, 2);
  harness.fail(1, new Error("page two live update failed"));
  assert.equal(harness.pagination.currentPage.value, 2);
  assert.equal(harness.pagination.items.value[0].docId, "page-two-01");

  const retry = harness.pagination.reload();
  assert.deepEqual(
    harness.listeners[2].builtQuery.constraints.at(-2),
    { type: "startAfter", values: [firstPage[19]] },
  );
  harness.emit(2, documents(2, "page-two-retried"));
  assert.equal(await retry, true);
  assert.equal(harness.pagination.currentPage.value, 2);
  assert.equal(
    harness.pagination.items.value[0].docId,
    "page-two-retried-01",
  );
  harness.stop();
});
