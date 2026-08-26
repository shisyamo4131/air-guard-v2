import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import * as Vue from "vue";

import { canViewLifecycleOperationHistory } from "../../utils/auth/policies/userLifecycleUiPolicy.js";

const components = [
  "components/Employee/LifecycleActions.vue",
  "components/Users/Manager/CardMenu.vue",
  "components/Users/Manager/index.vue",
  "pages/employees/[id].vue",
];

test("client transport exposes only the UWB-07 Callables", async () => {
  const source = await readFile(
    new URL("../../composables/auth/useAuthFunctions.js", import.meta.url),
    "utf8",
  );
  for (const callable of [
    "terminateEmployee",
    "deleteStandaloneRegisteredUser",
    "getEmployeeReinstatementContext",
    "listLifecycleOperations",
    "reinstateEmployee",
  ]) {
    assert.match(source, new RegExp(`httpsCallable\\([^)]*${callable}`, "s"));
  }
});

test("Employee lifecycle UI has no direct Firestore lifecycle mutation", async () => {
  const source = await readFile(
    new URL("../../pages/employees/[id].vue", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    ".toTerminated(",
    "dateOfTermination =",
    "reasonOfTermination =",
    "toDelete",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.match(source, /EmployeeLifecycleActions/);
});

test("registered User deletion is separated from temporary User deletion", async () => {
  const source = await readFile(
    new URL("../../components/Users/Manager/index.vue", import.meta.url),
    "utf8",
  );
  assert.match(source, /deleteTemporaryUser/);
  assert.match(source, /removeStandaloneRegisteredUser/);
  assert.match(source, /canDeleteStandaloneRegisteredUser/);
  assert.match(
    source,
    /canDeleteStandaloneRegisteredUser\(\{[\s\S]*?isSuperUser:\s*auth\.isSuperUser,[\s\S]*?targetUser,[\s\S]*?\}\)/,
  );
});

test("Employee lifecycle controls pass the token super-user state", async () => {
  const url = new URL(
    "../../components/Employee/LifecycleActions.vue",
    import.meta.url,
  );
  const source = await readFile(url, "utf8");
  const matches = source.match(/isSuperUser:\s*auth\.isSuperUser/g) ?? [];
  assert.equal(matches.length, 2);
});

test("Employee lifecycle UI has one element root for inherited layout attributes", async () => {
  const url = new URL(
    "../../components/Employee/LifecycleActions.vue",
    import.meta.url,
  );
  const source = await readFile(url, "utf8");
  const { descriptor, errors } = parse(source, { filename: url.pathname });
  assert.deepEqual(errors, []);
  const rootElements = descriptor.template.ast.children.filter(
    (node) => node.type === 1,
  );
  assert.equal(rootElements.length, 1);
  assert.equal(rootElements[0].tag, "div");
});

for (const file of components) {
  test(`${file} compiles for UWB-07`, async () => {
    const url = new URL(`../../${file}`, import.meta.url);
    const source = await readFile(url, "utf8");
    const { descriptor, errors } = parse(source, { filename: url.pathname });
    assert.deepEqual(errors, []);
    compileScript(descriptor, { id: file });
    const result = compileTemplate({
      id: file,
      filename: url.pathname,
      source: descriptor.template.content,
    });
    assert.deepEqual(result.errors, []);
  });
}

const CURSOR_ONE = "20000000-0000-4000-8000-000000000001";
const CURSOR_TWO = "20000000-0000-4000-8000-000000000002";

function clientItem(index, overrides = {}) {
  return {
    operationType: "employee-retirement",
    status: "processing",
    actorDisplayName: "管理者",
    employeeId: `employee-${index}`,
    subjectDisplayName: null,
    includesUserAccountDeletion: true,
    effectiveDate: "2026-08-24",
    reason: "本人都合",
    createdAt: new Date(Date.UTC(2026, 7, 25, 0, index)).toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function clientPage(start, nextCursor = null) {
  const length = nextCursor === null ? 2 : 20;
  return {
    schemaVersion: 1,
    items: Array.from({ length }, (_, index) => clientItem(start + index)),
    nextCursor,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settle() {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await Vue.nextTick();
  }
}

async function mountHistory(auth, listLifecycleOperations) {
  const url = new URL(
    "../../composables/application/user/useLifecycleOperationHistory.js",
    import.meta.url,
  );
  let source = await readFile(url, "utf8");
  source = source
    .replace(
      'import { computed, onUnmounted, readonly, ref, watch } from "vue";',
      "const { computed, onUnmounted, readonly, ref, watch } = globalThis.__historyVue;",
    )
    .replace(
      'import { canViewLifecycleOperationHistory } from "../../../utils/auth/policies/userLifecycleUiPolicy";',
      "const { canViewLifecycleOperationHistory } = globalThis.__historyPolicy;",
    )
    .replace(
      'import { useAuthFunctions } from "../../auth/useAuthFunctions";',
      "const { useAuthFunctions } = globalThis.__historyFunctions;",
    );

  globalThis.__historyVue = Vue;
  globalThis.__historyPolicy = { canViewLifecycleOperationHistory };
  globalThis.__historyFunctions = {
    useAuthFunctions: () => ({ listLifecycleOperations }),
  };
  globalThis.useAuthStore = () => auth;
  const encoded = Buffer.from(
    `${source}\n// test-instance:${Math.random()}`,
    "utf8",
  ).toString("base64");
  const module = await import(`data:text/javascript;base64,${encoded}`);

  let history;
  const renderer = Vue.createRenderer({
    patchProp() {},
    insert(child, parent) {
      parent.children ??= [];
      parent.children.push(child);
    },
    remove() {},
    createElement() {
      return { children: [] };
    },
    createText(text) {
      return { text };
    },
    createComment(text) {
      return { text };
    },
    setText(node, text) {
      node.text = text;
    },
    setElementText(node, text) {
      node.text = text;
    },
    parentNode() {
      return null;
    },
    nextSibling() {
      return null;
    },
    querySelector() {
      return null;
    },
    setScopeId() {},
    cloneNode(node) {
      return { ...node };
    },
    insertStaticContent() {
      const node = { children: [] };
      return [node, node];
    },
  });
  const app = renderer.createApp({
    setup() {
      history = module.useLifecycleOperationHistory();
      return () => null;
    },
  });
  app.mount({ children: [] });

  delete globalThis.__historyVue;
  delete globalThis.__historyPolicy;
  delete globalThis.__historyFunctions;
  delete globalThis.useAuthStore;
  return { history, unmount: () => app.unmount() };
}

function eligibleAuth(overrides = {}) {
  return Vue.reactive({
    companyId: "company-a",
    uid: "actor-a",
    isSuperUser: false,
    user: {
      docId: "actor-a",
      companyId: "company-a",
      isTemporary: false,
      disabled: false,
      isAdmin: true,
      roles: [],
    },
    ...overrides,
  });
}

test("history composable loads, pages from cursors, and refetches previous pages", async () => {
  const calls = [];
  const responses = new Map([
    [null, clientPage(1, CURSOR_ONE)],
    [CURSOR_ONE, clientPage(21, CURSOR_TWO)],
    [CURSOR_TWO, clientPage(41)],
  ]);
  const mounted = await mountHistory(eligibleAuth(), async ({ cursor }) => {
    calls.push(cursor);
    return responses.get(cursor);
  });
  const { history } = mounted;
  await settle();

  assert.equal(history.loaded.value, true);
  assert.equal(history.loading.value, false);
  assert.equal(history.items.value[0].employeeId, "employee-1");
  assert.equal(history.hasPreviousPage.value, false);
  assert.equal(history.hasNextPage.value, true);

  assert.equal(await history.loadNext(), true);
  assert.equal(history.items.value[0].employeeId, "employee-21");
  assert.equal(await history.loadNext(), true);
  assert.equal(history.items.value[0].employeeId, "employee-41");
  assert.equal(history.hasNextPage.value, false);
  assert.equal(await history.loadPrevious(), true);
  assert.equal(history.items.value[0].employeeId, "employee-21");
  assert.equal(await history.loadPrevious(), true);
  assert.equal(history.items.value[0].employeeId, "employee-1");
  assert.deepEqual(calls, [null, CURSOR_ONE, CURSOR_TWO, CURSOR_ONE, null]);
  mounted.unmount();
});

test("history composable blocks multifetch and retains the page on safe errors", async () => {
  const nextRequest = deferred();
  const calls = [];
  let initialCalls = 0;
  const mounted = await mountHistory(eligibleAuth(), async ({ cursor }) => {
    calls.push(cursor);
    if (cursor === null) {
      initialCalls += 1;
      return clientPage(initialCalls === 1 ? 1 : 101, CURSOR_ONE);
    }
    return nextRequest.promise;
  });
  const { history } = mounted;
  await settle();
  const retainedItems = [...history.items.value];

  const firstFetch = history.loadNext();
  const secondFetch = history.loadNext();
  assert.equal(history.loading.value, true);
  assert.equal(await secondFetch, false);
  assert.deepEqual(calls, [null, CURSOR_ONE]);
  nextRequest.reject(new Error("secret@example.invalid"));
  assert.equal(await firstFetch, false);
  assert.deepEqual(history.items.value, retainedItems);
  assert.equal(
    history.errorMessage.value,
    "履歴を取得できませんでした。時間をおいて再試行してください。",
  );
  assert.equal(history.errorMessage.value.includes("secret"), false);

  assert.equal(await history.retry(), true);
  assert.equal(history.items.value[0].employeeId, "employee-101");
  assert.equal(history.errorMessage.value, null);
  assert.deepEqual(calls, [null, CURSOR_ONE, null]);
  mounted.unmount();
});

test("history composable accepts empty pages and rejects non-exact responses safely", async () => {
  const empty = await mountHistory(eligibleAuth(), async () => ({
    schemaVersion: 1,
    items: [],
    nextCursor: null,
  }));
  await settle();
  assert.equal(empty.history.loaded.value, true);
  assert.deepEqual(empty.history.items.value, []);
  assert.equal(empty.history.errorMessage.value, null);
  empty.unmount();

  for (const invalidResponse of [
    { schemaVersion: 1, items: [], nextCursor: null, total: 0 },
    { schemaVersion: 2, items: [], nextCursor: null },
    {
      schemaVersion: 1,
      items: [{ ...clientItem(1), operationId: CURSOR_ONE }],
      nextCursor: null,
    },
    {
      schemaVersion: 1,
      items: [
        clientItem(1, {
          status: "completed",
          completedAt: null,
        }),
      ],
      nextCursor: null,
    },
  ]) {
    const mounted = await mountHistory(
      eligibleAuth(),
      async () => invalidResponse,
    );
    await settle();
    assert.equal(mounted.history.loaded.value, false);
    assert.deepEqual(mounted.history.items.value, []);
    assert.equal(
      mounted.history.errorMessage.value,
      "履歴を取得できませんでした。時間をおいて再試行してください。",
    );
    mounted.unmount();
  }
});

test("history composable discards memory on identity changes, sign-out, and unmount", async () => {
  const oldRequest = deferred();
  const newRequest = deferred();
  const calls = [];
  const auth = eligibleAuth();
  const mounted = await mountHistory(auth, ({ cursor }) => {
    calls.push({ cursor, companyId: auth.companyId, uid: auth.uid });
    return auth.companyId === "company-a"
      ? oldRequest.promise
      : newRequest.promise;
  });
  const { history } = mounted;
  await settle();
  assert.equal(history.loading.value, true);

  auth.companyId = "company-b";
  auth.uid = "actor-b";
  auth.user = {
    docId: "actor-b",
    companyId: "company-b",
    isTemporary: false,
    disabled: false,
    isAdmin: true,
    roles: [],
  };
  await settle();
  assert.deepEqual(history.items.value, []);
  assert.equal(calls.length, 2);
  newRequest.resolve(clientPage(201));
  await settle();
  assert.equal(history.items.value[0].employeeId, "employee-201");
  oldRequest.resolve(clientPage(1));
  await settle();
  assert.equal(history.items.value[0].employeeId, "employee-201");

  auth.user.isAdmin = false;
  await settle();
  assert.equal(history.eligible.value, false);
  assert.deepEqual(history.items.value, []);
  assert.equal(history.loaded.value, false);

  auth.uid = null;
  auth.user = null;
  await settle();
  assert.deepEqual(history.items.value, []);
  assert.equal(history.errorMessage.value, null);

  mounted.unmount();
  assert.deepEqual(history.items.value, []);
  assert.equal(history.loaded.value, false);
  assert.equal(history.loading.value, false);
});

test("history page is minimal, responsive, and never claims account deletion completed", async () => {
  const url = new URL(
    "../../pages/settings/lifecycle-history.vue",
    import.meta.url,
  );
  const source = await readFile(url, "utf8");
  for (const expected of [
    "退職・アカウント削除履歴",
    "従業員退職",
    "単独ユーザー削除",
    "誤退職訂正",
    "処理中",
    "再処理中",
    "完了",
    "アカウント削除対象あり",
    "再試行",
    "前へ",
    "次へ",
    "d-none d-md-block",
    "d-md-none",
  ]) {
    assert.equal(source.includes(expected), true, expected);
  }
  for (const forbidden of [
    "削除済み",
    "getFirestore",
    "collection(",
    "LifecycleOperations/",
    "localStorage",
    "sessionStorage",
    "export",
    "pageSize",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }

  const { descriptor, errors } = parse(source, { filename: url.pathname });
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "lifecycle-history" });
  const template = compileTemplate({
    id: "lifecycle-history",
    filename: url.pathname,
    source: descriptor.template.content,
  });
  assert.deepEqual(template.errors, []);
});
