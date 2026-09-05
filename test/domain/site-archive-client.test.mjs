import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as Vue from "vue";

import { getSiteWriteDecision } from "../../composables/domain/site/siteAuthorization.js";
import {
  SITE_ARCHIVE_UNCERTAIN_MESSAGE,
  SiteArchiveUiError,
  createSiteArchiveOperationId,
  createSiteArchiveRequest,
  isSiteArchiveSuccess,
  normalizeSiteArchiveOperationId,
  normalizeSiteArchiveReason,
  normalizeSiteArchiveSiteId,
  siteArchiveMalformedResponseError,
  toSiteArchiveUiError,
} from "../../composables/domain/site/siteArchiveUiContract.js";
import { useOperationState } from "../../composables/useOperationState.js";

const ACTION_URL = new URL(
  "../../composables/application/site/useSiteArchiveAction.js",
  import.meta.url,
);
const SITE_ACTIONS_URL = new URL(
  "../../composables/application/site/useSiteActions.js",
  import.meta.url,
);
const TRANSPORT_URL = new URL(
  "../../composables/site/useSiteFunctions.js",
  import.meta.url,
);

function actor(overrides = {}) {
  const baseUser = {
    docId: "actor-a", companyId: "company-a", email: "actor@example.invalid",
    isAdmin: true, isTemporary: false, disabled: false, roles: [],
  };
  return {
    authenticationUid: "actor-a",
    uid: "actor-a",
    companyId: "company-a",
    isEmailVerified: true,
    isSuperUser: false,
    isSuperUserClaimValid: true,
    user: baseUser,
    ...overrides,
    ...(overrides.user ? { user: { ...baseUser, ...overrides.user } } : {}),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function codedError(code) {
  const error = new Error("raw UID=actor-a company=company-a secret@example.invalid");
  if (code) error.code = code;
  error.stack = `PRIVATE_STACK ${error.message}`;
  return error;
}

let mutexSequence = 0;

async function loadSiteWriteMutex() {
  const source = await readFile(SITE_ACTIONS_URL, "utf8");
  const start = source.indexOf("const sharedSiteWriteState");
  const end = source.indexOf("\n\nexport function useSiteActions", start);
  assert.notEqual(start, -1, "shared Site write state must exist");
  assert.notEqual(end, -1, "shared Site write mutex must precede useSiteActions");
  class HarnessAuthorizationError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const moduleSource = `
    const Vue = globalThis.__siteArchiveMutexHarness.Vue;
    const SiteAuthorizationError = globalThis.__siteArchiveMutexHarness.SiteAuthorizationError;
    ${source.slice(start, end)}
  `;
  globalThis.__siteArchiveMutexHarness = {
    Vue,
    SiteAuthorizationError: HarnessAuthorizationError,
  };
  try {
    const encoded = Buffer.from(
      `${moduleSource}\n// mutex-test:${mutexSequence += 1}`,
    ).toString("base64");
    return (await import(`data:text/javascript;base64,${encoded}`))
      .runWithSiteWriteMutex;
  } finally {
    delete globalThis.__siteArchiveMutexHarness;
  }
}

async function loadArchiveAction({
  auth = actor(),
  transport = { archiveSite: async () => ({ success: true, archived: true }) },
  operationState = useOperationState(),
  operationIds = ["00000000-0000-4000-8000-000000000001"],
  runWithSiteWriteMutex = null,
} = {}) {
  const siteWriteMutex = runWithSiteWriteMutex ?? await loadSiteWriteMutex();
  let source = await readFile(ACTION_URL, "utf8");
  source = source
    .replace('import * as Vue from "vue";',
      "const Vue = globalThis.__siteArchiveActionHarness.Vue;")
    .replace('import { useAuthStore } from "@/stores/useAuthStore";',
      "const { useAuthStore } = globalThis.__siteArchiveActionHarness;")
    .replace('import { useSiteFunctions } from "@/composables/site/useSiteFunctions";',
      "const { useSiteFunctions } = globalThis.__siteArchiveActionHarness;")
    .replace('import { useOperationState } from "@/composables/useOperationState";',
      "const { useOperationState } = globalThis.__siteArchiveActionHarness;")
    .replace('import { getSiteWriteDecision } from "@/composables/domain/site/siteAuthorization";',
      "const { getSiteWriteDecision } = globalThis.__siteArchiveActionHarness;")
    .replace('import { runWithSiteWriteMutex } from "@/composables/application/site/useSiteActions";',
      "const { runWithSiteWriteMutex } = globalThis.__siteArchiveActionHarness;")
    .replace(
      /import \{[\s\S]*?\} from "@\/composables\/domain\/site\/siteArchiveUiContract";/u,
      `const {
        SiteArchiveUiError, createSiteArchiveOperationId, createSiteArchiveRequest,
        isSiteArchiveSuccess, normalizeSiteArchiveReason, normalizeSiteArchiveSiteId,
        siteArchiveMalformedResponseError, toSiteArchiveUiError
      } = globalThis.__siteArchiveActionHarness;`,
    );
  globalThis.__siteArchiveActionHarness = {
    Vue,
    SiteArchiveUiError,
    createSiteArchiveOperationId,
    createSiteArchiveRequest,
    getSiteWriteDecision,
    isSiteArchiveSuccess,
    normalizeSiteArchiveReason,
    normalizeSiteArchiveSiteId,
    runWithSiteWriteMutex: siteWriteMutex,
    siteArchiveMalformedResponseError,
    toSiteArchiveUiError,
    useAuthStore: () => auth,
    useOperationState: () => operationState,
    useSiteFunctions: () => transport,
  };
  try {
    const encoded = Buffer.from(`${source}\n// test:${Math.random()}`).toString("base64");
    const module = await import(`data:text/javascript;base64,${encoded}`);
    let index = 0;
    return module.useSiteArchiveAction({
      auth,
      firebaseAuth: {
        currentUser: {
          uid: auth.authenticationUid,
          emailVerified: auth.isEmailVerified,
        },
      },
      transport,
      operationState,
      createOperationId: () => operationIds[index++] ?? `operation-${index}`,
    });
  } finally {
    delete globalThis.__siteArchiveActionHarness;
  }
}

test("Site archive transport invokes only archiveSite and returns result.data", async () => {
  const functions = Object.freeze({ synthetic: true });
  const calls = [];
  let source = await readFile(TRANSPORT_URL, "utf8");
  source = source.replace(
    'import { httpsCallable } from "firebase/functions";',
    "const { httpsCallable, useNuxtApp } = globalThis.__siteArchiveTransportHarness;",
  );
  globalThis.__siteArchiveTransportHarness = {
    useNuxtApp: () => ({ $functions: functions }),
    httpsCallable: (receivedFunctions, name) => {
      calls.push({ receivedFunctions, name });
      return async (data) => {
        calls.push({ data });
        return { data: { success: true, archived: true } };
      };
    },
  };
  try {
    const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`);
    const request = { siteId: "site-a", reason: "重複", operationId: "operation-a" };
    assert.deepEqual(await module.useSiteFunctions().archiveSite(request), {
      success: true, archived: true,
    });
    assert.deepEqual(calls, [
      { receivedFunctions: functions, name: "archiveSite" },
      { data: request },
    ]);
  } finally {
    delete globalThis.__siteArchiveTransportHarness;
  }
});

test("Site archive pure request, response, and safe error contracts are exact", () => {
  assert.equal(normalizeSiteArchiveSiteId("site-a"), "site-a");
  assert.equal(normalizeSiteArchiveOperationId("operation-a"), "operation-a");
  assert.equal(normalizeSiteArchiveReason("  重複  "), "重複");
  assert.deepEqual(createSiteArchiveRequest({
    siteId: "site-a", reason: " 重複 ", operationId: "operation-a",
  }), { siteId: "site-a", reason: "重複", operationId: "operation-a" });
  for (const value of ["", " site-a", "site/a", "x".repeat(129)]) {
    assert.throws(() => normalizeSiteArchiveSiteId(value), SiteArchiveUiError);
    assert.throws(() => normalizeSiteArchiveOperationId(value), SiteArchiveUiError);
  }
  for (const value of ["", " ", "x".repeat(201), null]) {
    assert.throws(() => normalizeSiteArchiveReason(value), SiteArchiveUiError);
  }
  assert.equal(createSiteArchiveOperationId(() => "operation-a"), "operation-a");
  assert.equal(isSiteArchiveSuccess({ success: true, archived: true }), true);
  assert.equal(isSiteArchiveSuccess({ success: true, archived: true, extra: true }), false);
  assert.equal(siteArchiveMalformedResponseError().message, SITE_ARCHIVE_UNCERTAIN_MESSAGE);
  const raw = codedError("functions/failed-precondition");
  const safe = toSiteArchiveUiError(raw);
  assert.equal(safe.message, "参照されている現場はアーカイブできません。");
  assert.equal(safe.message.includes("actor-a"), false);
  assert.equal(toSiteArchiveUiError(codedError()).outcomeUncertain, true);
});

test("valid Site actors can archive while denied actor state makes zero transport calls", async () => {
  for (const auth of [
    actor(),
    actor({ isSuperUser: true }),
    ...["manager", "controller", "legal"].map((role) =>
      actor({ user: { isAdmin: false, roles: [role] } })),
  ]) {
    const action = await loadArchiveAction({ auth });
    assert.equal(action.canArchive.value, true);
  }
  for (const auth of [
    actor({ isSuperUser: true, user: { isAdmin: false, roles: ["manager"] } }),
    actor({ user: { isAdmin: false, roles: ["sites:write"] } }),
    actor({ user: { isAdmin: false, roles: ["unknown-role"] } }),
    actor({ user: { isTemporary: true } }),
    actor({ user: { disabled: true } }),
    actor({ user: { companyId: "company-b" } }),
  ]) {
    let calls = 0;
    const action = await loadArchiveAction({
      auth,
      transport: { archiveSite: async () => { calls += 1; } },
    });
    assert.equal(action.canArchive.value, false);
    await assert.rejects(
      () => action.archive({ site: { docId: "site-a" }, reason: "重複" }),
      (error) => error.code === "functions/permission-denied",
    );
    assert.equal(calls, 0);
  }
});

test("same target submission shares one pending promise and one exact request", async () => {
  const gate = deferred();
  const requests = [];
  const action = await loadArchiveAction({
    operationIds: ["operation-a"],
    transport: { archiveSite: async (request) => { requests.push(request); return gate.promise; } },
  });
  const input = { site: { docId: "site-a" }, reason: "  重複  " };
  const first = action.archive(input);
  const duplicate = action.archive(input);
  assert.equal(first, duplicate);
  assert.equal(action.isPending("site-a"), true);
  await Promise.resolve();
  assert.deepEqual(requests, [{ siteId: "site-a", reason: "重複", operationId: "operation-a" }]);
  gate.resolve({ success: true, archived: true });
  assert.deepEqual(await first, { success: true, archived: true });
  assert.equal(action.attemptId.value, null);
  assert.equal(action.isPending("site-a"), false);
});

test("normal Site writes and archive exclude each other in both directions", async () => {
  const mutex = await loadSiteWriteMutex();
  const normalGate = deferred();
  const normalWrite = mutex(() => normalGate.promise);
  await Promise.resolve();

  let archiveCalls = 0;
  const archive = await loadArchiveAction({
    runWithSiteWriteMutex: mutex,
    transport: {
      archiveSite: async () => {
        archiveCalls += 1;
        return { success: true, archived: true };
      },
    },
  });
  await assert.rejects(
    () => archive.archive({ site: { docId: "site-a" }, reason: "重複" }),
    (error) => error.code === "operation-in-progress" &&
      error.outcomeUncertain === false,
  );
  assert.equal(archiveCalls, 0);
  assert.equal(archive.attemptId.value, null);
  normalGate.resolve("saved");
  assert.equal(await normalWrite, "saved");

  const archiveGate = deferred();
  const activeArchive = await loadArchiveAction({
    runWithSiteWriteMutex: mutex,
    transport: { archiveSite: async () => archiveGate.promise },
  });
  const archiveWrite = activeArchive.archive({
    site: { docId: "site-a" },
    reason: "重複",
  });
  await Promise.resolve();
  await Promise.resolve();
  let normalCalls = 0;
  await assert.rejects(
    () => mutex(() => { normalCalls += 1; }),
    (error) => error.code === "operation-in-progress",
  );
  assert.equal(normalCalls, 0);
  archiveGate.resolve({ success: true, archived: true });
  assert.deepEqual(await archiveWrite, { success: true, archived: true });
  assert.equal(await mutex(async () => "next-save"), "next-save");
});

test("distinct archive composable instances share the Site write mutex", async () => {
  const mutex = await loadSiteWriteMutex();
  const gate = deferred();
  const first = await loadArchiveAction({
    runWithSiteWriteMutex: mutex,
    transport: { archiveSite: async () => gate.promise },
  });
  let secondCalls = 0;
  const second = await loadArchiveAction({
    runWithSiteWriteMutex: mutex,
    transport: {
      archiveSite: async () => {
        secondCalls += 1;
        return { success: true, archived: true };
      },
    },
  });
  const firstWrite = first.archive({ site: { docId: "site-a" }, reason: "重複" });
  await Promise.resolve();
  await Promise.resolve();
  await assert.rejects(
    () => second.archive({ site: { docId: "site-b" }, reason: "誤登録" }),
    (error) => error.code === "operation-in-progress" &&
      error.outcomeUncertain === false,
  );
  assert.equal(secondCalls, 0);
  gate.resolve({ success: true, archived: true });
  await firstWrite;
});

test("Site write mutex releases after action throw and archive transport failure", async () => {
  const mutex = await loadSiteWriteMutex();
  const actionError = new Error("synthetic action failure");
  await assert.rejects(
    () => mutex(async () => { throw actionError; }),
    (error) => error === actionError,
  );
  assert.equal(await mutex(async () => "after-action-error"), "after-action-error");

  const archive = await loadArchiveAction({
    runWithSiteWriteMutex: mutex,
    transport: { archiveSite: async () => { throw codedError("functions/unavailable"); } },
  });
  await assert.rejects(
    () => archive.archive({ site: { docId: "site-a" }, reason: "重複" }),
    (error) => error.outcomeUncertain === true,
  );
  assert.equal(await mutex(async () => "after-transport-error"), "after-transport-error");
});

test("uncertain retry accepts a removed listener value and reuses operation ID", async () => {
  const requests = [];
  const outcomes = [
    codedError("functions/unavailable"),
    codedError("functions/unavailable"),
    codedError("functions/unavailable"),
    codedError("functions/failed-precondition"),
  ];
  const action = await loadArchiveAction({
    operationIds: ["operation-a", "operation-b"],
    transport: {
      archiveSite: async (request) => {
        requests.push(request);
        throw outcomes.shift();
      },
    },
  });
  const state = { site: { docId: "site-a" } };
  const input = {
    site: state.site,
    reason: "重複",
    getCurrentSite: () => state.site,
  };
  await assert.rejects(
    () => action.archive(input),
    (error) => error.outcomeUncertain === true,
  );
  assert.equal(action.attemptId.value, "operation-a");
  state.site = null;
  await assert.rejects(
    () => action.archive(input),
    (error) => error.outcomeUncertain === true,
  );
  state.site = undefined;
  await assert.rejects(
    () => action.archive(input),
    (error) => error.outcomeUncertain === true,
  );
  await assert.rejects(() => action.archive({ ...input, reason: "別理由" }),
    (error) => error.outcomeUncertain === false);
  assert.deepEqual(requests.map(({ operationId }) => operationId), [
    "operation-a", "operation-a", "operation-a", "operation-b",
  ]);
  assert.equal(action.attemptId.value, null);
});

test("send-time actor, target, and reason changes are rejected before transport", async () => {
  for (const { mutate, expectedCode } of [
    { mutate: ({ auth }) => { auth.user.disabled = true; }, expectedCode: "functions/permission-denied" },
    { mutate: ({ auth }) => { auth.uid = "actor-b"; }, expectedCode: "functions/permission-denied" },
    { mutate: ({ state }) => { state.site = { docId: "site-b" }; }, expectedCode: "functions/permission-denied" },
    { mutate: ({ state }) => { state.site = { docId: "" }; }, expectedCode: "functions/invalid-argument" },
    { mutate: ({ state }) => { state.reason = "別理由"; }, expectedCode: "functions/permission-denied" },
  ]) {
    const auth = actor();
    const state = { site: { docId: "site-a" }, reason: "重複" };
    let calls = 0;
    const action = await loadArchiveAction({
      auth,
      transport: { archiveSite: async () => { calls += 1; } },
    });
    const pending = action.archive({
      site: state.site,
      reason: state.reason,
      getCurrentSite: () => state.site,
      getCurrentReason: () => state.reason,
    });
    mutate({ auth, state });
    await assert.rejects(
      pending,
      (error) => error.code === expectedCode && error.outcomeUncertain === false,
    );
    assert.equal(calls, 0);
  }
});
