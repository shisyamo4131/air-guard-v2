import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as Vue from "vue";

import { getCustomerWriteDecision } from "../../composables/domain/customer/customerOperations.js";
import {
  CUSTOMER_ARCHIVE_UNCERTAIN_MESSAGE,
  CustomerArchiveUiError,
  createCustomerArchiveOperationId,
  createCustomerArchiveRequest,
  customerArchiveMalformedResponseError,
  isCustomerArchiveSuccess,
  normalizeCustomerArchiveCustomerId,
  normalizeCustomerArchiveOperationId,
  normalizeCustomerArchiveReason,
  toCustomerArchiveUiError,
} from "../../composables/domain/customer/customerArchiveUiContract.js";
import { useOperationState } from "../../composables/useOperationState.js";

const ACTION_URL = new URL(
  "../../composables/application/customer/useCustomerArchiveAction.js",
  import.meta.url,
);
const TRANSPORT_URL = new URL(
  "../../composables/customer/useCustomerFunctions.js",
  import.meta.url,
);
const ARCHIVE_DIALOG_URL = new URL(
  "../../components/Customer/ArchiveDialog.vue",
  import.meta.url,
);

function actor(overrides = {}) {
  const baseUser = {
    docId: "actor-a",
    companyId: "company-a",
    email: "actor@example.invalid",
    isAdmin: true,
    isTemporary: false,
    disabled: false,
    roles: [],
  };
  return {
    uid: "actor-a",
    companyId: "company-a",
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
  const error = new Error(
    "raw reason=private UID=actor-a companyId=company-a secret@example.invalid",
  );
  if (code) error.code = code;
  error.stack = `PRIVATE_STACK ${error.message}`;
  return error;
}

async function loadArchiveAction({
  auth = actor(),
  transport = { archiveCustomer: async () => ({ success: true, archived: true }) },
  operationState = useOperationState(),
  operationIds = ["00000000-0000-4000-8000-000000000001"],
  createOperationId,
} = {}) {
  let source = await readFile(ACTION_URL, "utf8");
  source = source
    .replace(
      'import * as Vue from "vue";',
      "const Vue = globalThis.__customerArchiveActionHarness.Vue;",
    )
    .replace(
      'import { useAuthStore } from "@/stores/useAuthStore";',
      "const { useAuthStore } = globalThis.__customerArchiveActionHarness;",
    )
    .replace(
      'import { useCustomerFunctions } from "@/composables/customer/useCustomerFunctions";',
      "const { useCustomerFunctions } = globalThis.__customerArchiveActionHarness;",
    )
    .replace(
      'import { useOperationState } from "@/composables/useOperationState";',
      "const { useOperationState } = globalThis.__customerArchiveActionHarness;",
    )
    .replace(
      'import { getCustomerWriteDecision } from "@/composables/domain/customer/customerOperations";',
      "const { getCustomerWriteDecision } = globalThis.__customerArchiveActionHarness;",
    )
    .replace(
      /import \{[\s\S]*?\} from "@\/composables\/domain\/customer\/customerArchiveUiContract";/u,
      `const {
        CustomerArchiveUiError, createCustomerArchiveOperationId,
        createCustomerArchiveRequest, customerArchiveMalformedResponseError,
        isCustomerArchiveSuccess, normalizeCustomerArchiveCustomerId,
        normalizeCustomerArchiveReason, toCustomerArchiveUiError
      } = globalThis.__customerArchiveActionHarness;`,
    );

  globalThis.__customerArchiveActionHarness = {
    Vue,
    CustomerArchiveUiError,
    createCustomerArchiveOperationId,
    createCustomerArchiveRequest,
    customerArchiveMalformedResponseError,
    getCustomerWriteDecision,
    isCustomerArchiveSuccess,
    normalizeCustomerArchiveCustomerId,
    normalizeCustomerArchiveReason,
    toCustomerArchiveUiError,
    useAuthStore: () => auth,
    useCustomerFunctions: () => transport,
    useOperationState: () => operationState,
  };
  try {
    const encoded = Buffer.from(
      `${source}\n// test-instance:${Math.random()}`,
      "utf8",
    ).toString("base64");
    const module = await import(`data:text/javascript;base64,${encoded}`);
    let index = 0;
    return module.useCustomerArchiveAction({
      auth,
      transport,
      operationState,
      createOperationId:
        createOperationId ??
        (() => operationIds[index++] ?? `generated-operation-${index}`),
    });
  } finally {
    delete globalThis.__customerArchiveActionHarness;
  }
}

async function loadArchiveDialog({ archive }) {
  const componentSource = await readFile(ARCHIVE_DIALOG_URL, "utf8");
  let script = componentSource.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script, "ArchiveDialog script setup must exist");
  script = script
    .replace(
      'import { useMessagesStore } from "@/stores/useMessagesStore";',
      "",
    )
    .replace(
      'import { useCustomerArchiveAction } from "@/composables/application/customer/useCustomerArchiveAction";',
      "",
    )
    .replace(
      'import { toCustomerArchiveUiError } from "@/composables/domain/customer/customerArchiveUiContract";',
      "",
    );

  const messages = [];
  const emitted = [];
  let resetAttempts = 0;
  globalThis.__customerArchiveDialogHarness = {
    computed: Vue.computed,
    defineEmits: () => (...args) => emitted.push(args),
    defineProps: () => ({
      customer: { docId: "customer-a", code: "C001", name: "架空取引先" },
    }),
    ref: Vue.ref,
    toCustomerArchiveUiError,
    useCustomerArchiveAction: () => ({
      archive,
      canArchive: Vue.ref(true),
      isPending: () => false,
      resetAttempt: () => {
        resetAttempts += 1;
      },
    }),
    useMessagesStore: () => ({ add: (message) => messages.push(message) }),
    watch: () => () => {},
  };
  try {
    const executable = `
      const {
        computed, defineEmits, defineProps, ref, toCustomerArchiveUiError,
        useCustomerArchiveAction, useMessagesStore, watch
      } = globalThis.__customerArchiveDialogHarness;
      ${script}
      export {
        archiveBusy, archivePending, archiveSubmitting, closeDialog, dialog,
        failureMessage, form, handleArchive, openDialog, reason, target
      };
    `;
    const encoded = Buffer.from(executable, "utf8").toString("base64");
    const module = await import(
      `data:text/javascript;base64,${encoded}#${Math.random()}`
    );
    return {
      emitted,
      messages,
      module,
      resetAttempts: () => resetAttempts,
    };
  } finally {
    delete globalThis.__customerArchiveDialogHarness;
  }
}

test("Customer archive transport invokes only archiveCustomer and returns result.data", async () => {
  const functions = Object.freeze({ name: "synthetic-functions" });
  const calls = [];
  let source = await readFile(TRANSPORT_URL, "utf8");
  source = source.replace(
    'import { httpsCallable } from "firebase/functions";',
    "const { httpsCallable, useNuxtApp } = globalThis.__customerArchiveTransportHarness;",
  );
  globalThis.__customerArchiveTransportHarness = {
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
    const encoded = Buffer.from(source, "utf8").toString("base64");
    const { useCustomerFunctions } = await import(
      `data:text/javascript;base64,${encoded}#${Math.random()}`
    );
    const request = {
      customerId: "customer-a",
      reason: "重複登録",
      operationId: "00000000-0000-4000-8000-000000000001",
    };
    assert.deepEqual(
      await useCustomerFunctions().archiveCustomer(request),
      { success: true, archived: true },
    );
    assert.deepEqual(calls, [
      { receivedFunctions: functions, name: "archiveCustomer" },
      { data: request },
    ]);
    assert.deepEqual(Object.keys(calls[1].data).sort(), [
      "customerId",
      "operationId",
      "reason",
    ]);
  } finally {
    delete globalThis.__customerArchiveTransportHarness;
  }
});

test("Customer archive pure contract enforces path-safe identifiers and normalized reason bounds", () => {
  assert.equal(normalizeCustomerArchiveCustomerId("a"), "a");
  assert.equal(normalizeCustomerArchiveCustomerId("a".repeat(128)), "a".repeat(128));
  assert.equal(normalizeCustomerArchiveOperationId("operation-a"), "operation-a");
  for (const value of ["", "a".repeat(129), " customer", "customer ", "a/b", "a\u0000b", 7, null]) {
    assert.throws(
      () => normalizeCustomerArchiveCustomerId(value),
      (error) =>
        error instanceof CustomerArchiveUiError &&
        error.code === "functions/invalid-argument" &&
        error.outcomeUncertain === false,
    );
  }
  for (const value of ["", "a".repeat(129), " operation", "a/b", "a\u001fb", undefined]) {
    assert.throws(() => normalizeCustomerArchiveOperationId(value), CustomerArchiveUiError);
  }
  assert.equal(normalizeCustomerArchiveReason("  重複登録  "), "重複登録");
  assert.equal(normalizeCustomerArchiveReason("a".repeat(200)), "a".repeat(200));
  for (const value of ["", "   ", "a".repeat(201), null, 1]) {
    assert.throws(
      () => normalizeCustomerArchiveReason(value),
      (error) =>
        error instanceof CustomerArchiveUiError &&
        error.code === "functions/invalid-argument" &&
        error.outcomeUncertain === false,
    );
  }
  assert.deepEqual(
    createCustomerArchiveRequest({
      customerId: "customer-a",
      reason: "  重複登録  ",
      operationId: "operation-a",
      companyId: "must-not-pass",
    }),
    {
      customerId: "customer-a",
      reason: "重複登録",
      operationId: "operation-a",
    },
  );
});

test("operation ID generation failures are definite and prevent transport calls", async () => {
  for (const createOperationId of [
    () => createCustomerArchiveOperationId(null),
    () => createCustomerArchiveOperationId(() => "invalid/id"),
  ]) {
    let calls = 0;
    const action = await loadArchiveAction({
      createOperationId,
      transport: {
        archiveCustomer: async () => {
          calls += 1;
          return { success: true, archived: true };
        },
      },
    });
    await assert.rejects(
      action.archive({ customer: { docId: "customer-a" }, reason: "重複" }),
      (error) =>
        error instanceof CustomerArchiveUiError &&
        error.code === "functions/invalid-argument" &&
        error.outcomeUncertain === false,
    );
    assert.equal(calls, 0);
    assert.equal(action.attemptId.value, null);
  }
});

test("Customer archive response and error contracts are exact and redact raw failures", () => {
  assert.equal(isCustomerArchiveSuccess({ success: true, archived: true }), true);
  for (const value of [
    null,
    [],
    { success: true },
    { success: true, archived: false },
    { success: true, archived: true, operationId: "secret" },
    Object.assign(Object.create({ inherited: true }), {
      success: true,
      archived: true,
    }),
  ]) {
    assert.equal(isCustomerArchiveSuccess(value), false);
  }

  const definite = new Map([
    ["functions/invalid-argument", "入力内容を確認してください。"],
    ["functions/permission-denied", "取引先をアーカイブする権限がありません。"],
    ["functions/unauthenticated", "認証状態を確認してください。"],
    ["functions/not-found", "取引先が見つかりません。"],
    ["functions/failed-precondition", "参照されている取引先はアーカイブできません。"],
    ["functions/aborted", "取引先のアーカイブ状態が競合しています。最新情報を確認してください。"],
  ]);
  for (const [code, message] of definite) {
    const mapped = toCustomerArchiveUiError(codedError(code));
    assert.equal(mapped.code, code);
    assert.equal(mapped.message, message);
    assert.equal(mapped.outcomeUncertain, false);
    assert.doesNotMatch(mapped.message, /private|UID|companyId|secret|STACK|raw/u);
  }
  for (const code of [
    null,
    "functions/internal",
    "functions/unavailable",
    "functions/deadline-exceeded",
    "functions/unknown",
  ]) {
    const mapped = toCustomerArchiveUiError(codedError(code));
    assert.equal(mapped.code, "outcome-uncertain");
    assert.equal(mapped.message, CUSTOMER_ARCHIVE_UNCERTAIN_MESSAGE);
    assert.equal(mapped.outcomeUncertain, true);
    assert.doesNotMatch(mapped.message, /private|UID|companyId|secret|STACK|raw/u);
  }
});

test("archive action uses the actual Customer write policy for allowed and denied actors", async () => {
  const allowed = [
    actor(),
    actor({ user: { isAdmin: false, roles: ["manager"] } }),
    actor({ user: { isAdmin: false, roles: ["legal"] } }),
  ];
  for (const auth of allowed) {
    const action = await loadArchiveAction({ auth });
    assert.equal(action.canArchive.value, true);
  }

  const denied = [
    actor({ user: { isAdmin: false, roles: ["controller"] } }),
    actor({ user: { isAdmin: false, roles: ["customers:write"] } }),
    actor({ user: { isAdmin: false, roles: ["unknown-role"] } }),
    actor({ isSuperUser: true, user: { isAdmin: false, roles: [] } }),
    actor({ user: { isTemporary: true } }),
    actor({ user: { disabled: true } }),
    actor({ user: { companyId: "company-b" } }),
  ];
  for (const auth of denied) {
    let calls = 0;
    const action = await loadArchiveAction({
      auth,
      transport: {
        archiveCustomer: async () => {
          calls += 1;
          return { success: true, archived: true };
        },
      },
    });
    assert.equal(action.canArchive.value, false);
    await assert.rejects(
      action.archive({ customer: { docId: "customer-a" }, reason: "重複" }),
      (error) => error.code === "functions/permission-denied",
    );
    assert.equal(calls, 0);
  }
});

test("archive action sends one exact normalized request and shares a same-target pending promise", async () => {
  const gate = deferred();
  const requests = [];
  const action = await loadArchiveAction({
    operationIds: ["operation-a"],
    transport: {
      archiveCustomer: async (request) => {
        requests.push(request);
        return gate.promise;
      },
    },
  });
  const input = { customer: { docId: "customer-a" }, reason: "  重複登録  " };
  const first = action.archive(input);
  const duplicate = action.archive(input);
  assert.equal(first, duplicate);
  assert.equal(action.isPending("customer-a"), true);
  await Promise.resolve();
  assert.deepEqual(requests, [
    {
      customerId: "customer-a",
      reason: "重複登録",
      operationId: "operation-a",
    },
  ]);
  gate.resolve({ success: true, archived: true });
  assert.deepEqual(await first, { success: true, archived: true });
  assert.equal(action.isPending("customer-a"), false);
  assert.equal(action.attemptId.value, null);
});

test("pre-call permission, identity, company, target, and reason changes fail with write zero", async () => {
  const cases = [
    { name: "permission", mutate: ({ auth }) => { auth.user.disabled = true; } },
    { name: "identity", mutate: ({ auth }) => { auth.uid = "actor-b"; } },
    { name: "company", mutate: ({ auth }) => { auth.companyId = "company-b"; } },
    { name: "target", mutate: ({ state }) => { state.customer = { docId: "customer-b" }; } },
    { name: "reason", mutate: ({ state }) => { state.reason = "別の理由"; } },
  ];
  for (const scenario of cases) {
    const auth = actor();
    const state = {
      customer: { docId: "customer-a" },
      reason: "重複登録",
    };
    let calls = 0;
    const action = await loadArchiveAction({
      auth,
      transport: {
        archiveCustomer: async () => {
          calls += 1;
          return { success: true, archived: true };
        },
      },
    });
    const pending = action.archive({
      customer: state.customer,
      reason: state.reason,
      getCurrentCustomer: () => state.customer,
      getCurrentReason: () => state.reason,
    });
    scenario.mutate({ auth, state });
    await assert.rejects(
      pending,
      (error) => error.code === "functions/permission-denied",
      scenario.name,
    );
    assert.equal(calls, 0, scenario.name);
    assert.equal(action.attemptId.value, null, scenario.name);
  }
});

for (const code of [
  null,
  "functions/internal",
  "functions/unavailable",
  "functions/deadline-exceeded",
  "functions/unknown",
]) {
  test(`outcome-uncertain ${code ?? "no-code"} requires explicit retry and reuses its operation ID`, async () => {
    const requests = [];
    const action = await loadArchiveAction({
      operationIds: ["operation-a", "operation-b"],
      transport: {
        archiveCustomer: async (request) => {
          requests.push(request);
          throw codedError(code);
        },
      },
    });
    const input = { customer: { docId: "customer-a" }, reason: "重複" };
    await assert.rejects(action.archive(input), (error) => error.outcomeUncertain === true);
    assert.equal(requests.length, 1);
    assert.equal(action.attemptId.value, "operation-a");
    await Promise.resolve();
    assert.equal(requests.length, 1, "must not retry automatically");
    await assert.rejects(action.archive(input), (error) => error.outcomeUncertain === true);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].operationId, "operation-a");
    assert.equal(requests[1].operationId, "operation-a");
  });
}

test("a malformed success response is outcome-uncertain and reuses its operation ID", async () => {
  const requests = [];
  const action = await loadArchiveAction({
    operationIds: ["operation-a", "operation-b"],
    transport: {
      archiveCustomer: async (request) => {
        requests.push(request);
        return { success: true, archived: true, extra: "not-exact" };
      },
    },
  });
  const input = { customer: { docId: "customer-a" }, reason: "重複" };
  await assert.rejects(action.archive(input), (error) => error.outcomeUncertain === true);
  await assert.rejects(action.archive(input), (error) => error.outcomeUncertain === true);
  assert.deepEqual(requests.map(({ operationId }) => operationId), [
    "operation-a",
    "operation-a",
  ]);
});

for (const code of [
  "functions/invalid-argument",
  "functions/permission-denied",
  "functions/unauthenticated",
  "functions/not-found",
  "functions/failed-precondition",
  "functions/aborted",
]) {
  test(`definite ${code} clears the attempt before an explicit retry`, async () => {
    const requests = [];
    const action = await loadArchiveAction({
      operationIds: ["operation-a", "operation-b"],
      transport: {
        archiveCustomer: async (request) => {
          requests.push(request);
          throw codedError(code);
        },
      },
    });
    const input = { customer: { docId: "customer-a" }, reason: "重複" };
    await assert.rejects(action.archive(input), (error) => error.outcomeUncertain === false);
    assert.equal(action.attemptId.value, null);
    await assert.rejects(action.archive(input), (error) => error.outcomeUncertain === false);
    assert.deepEqual(requests.map(({ operationId }) => operationId), [
      "operation-a",
      "operation-b",
    ]);
  });
}

test("reason or target change and reset create new IDs, while success clears the attempt", async () => {
  const outcomes = [
    codedError("functions/unavailable"),
    codedError("functions/unavailable"),
    codedError("functions/unavailable"),
    { success: true, archived: true },
  ];
  const requests = [];
  const action = await loadArchiveAction({
    operationIds: ["operation-a", "operation-b", "operation-c", "operation-d"],
    transport: {
      archiveCustomer: async (request) => {
        requests.push(request);
        const outcome = outcomes.shift();
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
    },
  });
  await assert.rejects(
    action.archive({ customer: { docId: "customer-a" }, reason: "理由A" }),
  );
  await assert.rejects(
    action.archive({ customer: { docId: "customer-a" }, reason: "理由B" }),
  );
  await assert.rejects(
    action.archive({ customer: { docId: "customer-b" }, reason: "理由B" }),
  );
  action.resetAttempt();
  assert.deepEqual(
    await action.archive({ customer: { docId: "customer-b" }, reason: "理由B" }),
    { success: true, archived: true },
  );
  assert.deepEqual(requests.map(({ operationId }) => operationId), [
    "operation-a",
    "operation-b",
    "operation-c",
    "operation-d",
  ]);
  assert.equal(action.attemptId.value, null);
});

test("ArchiveDialog sets its local busy guard before validation and collapses duplicate submit side effects", async () => {
  const validation = deferred();
  let validationCalls = 0;
  let archiveCalls = 0;
  const mounted = await loadArchiveDialog({
    archive: async () => {
      archiveCalls += 1;
      return { success: true, archived: true };
    },
  });
  mounted.module.openDialog();
  mounted.module.reason.value = "重複登録";
  mounted.module.form.value = {
    resetValidation() {},
    validate() {
      validationCalls += 1;
      return validation.promise;
    },
  };

  const first = mounted.module.handleArchive();
  assert.equal(mounted.module.archiveSubmitting.value, true);
  assert.equal(mounted.module.archiveBusy.value, true);
  assert.equal(validationCalls, 1);
  const duplicate = mounted.module.handleArchive();
  assert.equal(validationCalls, 1);
  assert.equal(archiveCalls, 0);

  validation.resolve({ valid: true });
  await Promise.all([first, duplicate]);
  assert.equal(archiveCalls, 1);
  assert.deepEqual(mounted.messages, ["取引先をアーカイブしました。"]);
  assert.deepEqual(mounted.emitted, [["archived"]]);
  assert.equal(mounted.module.archiveBusy.value, false);
  assert.equal(mounted.module.archiveSubmitting.value, false);
});

test("ArchiveDialog releases its local guard after invalid validation and accepts a later valid submit", async () => {
  const validation = deferred();
  let archiveCalls = 0;
  const mounted = await loadArchiveDialog({
    archive: async () => {
      archiveCalls += 1;
      return { success: true, archived: true };
    },
  });
  mounted.module.openDialog();
  mounted.module.reason.value = "重複登録";
  mounted.module.form.value = {
    resetValidation() {},
    validate: () => validation.promise,
  };
  const invalid = mounted.module.handleArchive();
  assert.equal(mounted.module.archiveBusy.value, true);
  validation.resolve({ valid: false });
  await invalid;
  assert.equal(mounted.module.archiveBusy.value, false);
  assert.equal(archiveCalls, 0);
  assert.deepEqual(mounted.messages, []);
  assert.deepEqual(mounted.emitted, []);

  mounted.module.form.value.validate = async () => ({ valid: true });
  await mounted.module.handleArchive();
  assert.equal(archiveCalls, 1);
  assert.deepEqual(mounted.messages, ["取引先をアーカイブしました。"]);
  assert.deepEqual(mounted.emitted, [["archived"]]);
  assert.equal(mounted.module.archiveBusy.value, false);
});

test("ArchiveDialog releases its local guard after archive failure without success side effects", async () => {
  let archiveCalls = 0;
  const mounted = await loadArchiveDialog({
    archive: async () => {
      archiveCalls += 1;
      throw codedError("functions/failed-precondition");
    },
  });
  mounted.module.openDialog();
  mounted.module.reason.value = "重複登録";
  mounted.module.form.value = {
    resetValidation() {},
    validate: async () => ({ valid: true }),
  };
  await mounted.module.handleArchive();
  assert.equal(archiveCalls, 1);
  assert.equal(mounted.module.archiveBusy.value, false);
  assert.equal(mounted.module.archiveSubmitting.value, false);
  assert.equal(
    mounted.module.failureMessage.value,
    "参照されている取引先はアーカイブできません。",
  );
  assert.deepEqual(mounted.messages, []);
  assert.deepEqual(mounted.emitted, []);
  assert.equal(mounted.module.dialog.value, true);
});
