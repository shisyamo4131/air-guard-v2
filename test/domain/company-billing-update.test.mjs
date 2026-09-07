import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "@vue/compiler-sfc";
import {
  buildCompanyBillingUpdate,
  COMPANY_BILLING_FIELDS,
  CompanyBillingUpdateError,
  parseCompanyBillingChanges,
  updateCompanyBilling,
} from "../../functions/modules/company/updateCompanyBilling.js";

const EMPTY_BANK = Object.freeze({
  bankName: null,
  branchName: null,
  accountType: null,
  accountNumber: null,
  accountHolder: null,
});

const COMPLETE_BANK = Object.freeze({
  bankName: "架空銀行",
  branchName: "中央支店",
  accountType: "普通",
  accountNumber: "0012345",
  accountHolder: "カクウケイビ",
});

const validCompany = Object.freeze({
  fixture: "company-billing-domain-test",
  invoiceNumber: null,
  ...COMPLETE_BANK,
});

const identity = Object.freeze({
  uid: "billing-admin-a",
  companyId: "company-a",
  isSuperUser: false,
});

const admin = Object.freeze({
  companyId: "company-a",
  isTemporary: false,
  disabled: false,
  isAdmin: true,
});

function snapshot(data, exists = true) {
  return { exists, data: () => data };
}

function createFirestore({ actor = admin, company = validCompany } = {}) {
  const calls = [];
  const reads = [];
  const firestore = {
    doc: (path) => ({ path }),
    runTransaction: async (callback) =>
      callback({
        get: async (ref) => {
          reads.push(ref.path);
          return ref.path.includes("/Users/")
            ? snapshot(actor, !!actor)
            : snapshot(company, !!company);
        },
        update: (ref, value) => calls.push({ path: ref.path, value }),
      }),
  };
  return { firestore, calls, reads };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function loadBillingEditorHarness({ validate, update }) {
  const source = await readFile(
    new URL("../../components/Company/BillingEditor.vue", import.meta.url),
    "utf8",
  );
  const { descriptor, errors } = parse(source, {
    filename: "BillingEditor.vue",
  });
  assert.deepEqual(errors, []);
  const company = {
    invoiceNumber: null,
    ...COMPLETE_BANK,
    clone() {
      return { ...this };
    },
  };
  const Company = {
    billingFields: [...COMPANY_BILLING_FIELDS],
    getBillingValue(source = {}) {
      return Object.fromEntries(
        this.billingFields.map((field) => [field, source[field] ?? null]),
      );
    },
    getBillingDraftValue(source = {}) {
      return this.getBillingValue(source);
    },
    normalizeBilling(value) {
      return value;
    },
  };
  let watcher;
  const harness = {
    Company,
    defineProps: () => ({ company, title: "振込先の編集" }),
    ref: (value) => ({ value }),
    watch: (_source, callback) => {
      watcher = callback;
    },
    useCompanyBillingUpdate: () => ({ updateCompanyBilling: update }),
  };
  globalThis.__billingEditorHarness = harness;
  const setupSource = descriptor.scriptSetup.content.replace(
    /import[\s\S]*?;\s*/gu,
    "",
  );
  const moduleSource = `
    const { Company, defineProps, ref, watch, useCompanyBillingUpdate } =
      globalThis.__billingEditorHarness;
    ${setupSource}
    export {
      baseline,
      clearBilling,
      dialog,
      draft,
      errorMessage,
      form,
      hasExternalChanges,
      isSaving,
      open,
      pendingOwnSnapshot,
      reloadLatest,
      save,
      updateProperties
    };
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`
  );
  module.form.value = { validate };
  module.open();
  return {
    company,
    module,
    source,
    triggerLiveWatcher: () => watcher(Company.getBillingValue(company)),
    cleanup: () => {
      delete globalThis.__billingEditorHarness;
    },
  };
}

test("billing input is exact {changes} with a non-empty owned-field subset", () => {
  assert.deepEqual(
    parseCompanyBillingChanges({ changes: { accountNumber: "0012345" } }),
    { accountNumber: "0012345" },
  );

  for (const input of [
    null,
    [],
    {},
    { changes: null },
    { changes: [] },
    { changes: {} },
    { changes: { invoiceNumber: "1234567890123" } },
    { changes: { bankName: "銀行" }, companyId: "company-b" },
    { changes: { bankName: "銀行" }, path: "Companies/company-b" },
    { changes: { uid: "forged" } },
    { changes: { updatedAt: "client-time" } },
    { changes: { fixture: "overpost" } },
  ]) {
    assert.throws(
      () => parseCompanyBillingChanges(input),
      CompanyBillingUpdateError,
    );
  }
});

test("billing values must be either all-null or all-complete", () => {
  assert.deepEqual(
    buildCompanyBillingUpdate(
      { invoiceNumber: null, ...EMPTY_BANK },
      COMPLETE_BANK,
    ),
    COMPLETE_BANK,
  );
  assert.deepEqual(buildCompanyBillingUpdate(validCompany, EMPTY_BANK), EMPTY_BANK);

  for (let mask = 1; mask < 2 ** COMPANY_BILLING_FIELDS.length - 1; mask += 1) {
    const partial = Object.fromEntries(
      COMPANY_BILLING_FIELDS.flatMap((field, index) =>
        mask & (1 << index) ? [[field, COMPLETE_BANK[field]]] : [],
      ),
    );
    assert.throws(
      () =>
        buildCompanyBillingUpdate(
          { invoiceNumber: null, ...EMPTY_BANK },
          partial,
        ),
      CompanyBillingUpdateError,
      `partial mask ${mask.toString(2).padStart(5, "0")} must fail`,
    );
  }
});

test("partial legacy billing can only be repaired to complete or explicitly cleared", () => {
  const partialCompany = {
    invoiceNumber: null,
    ...EMPTY_BANK,
    bankName: "架空銀行",
    branchName: "中央支店",
  };
  assert.deepEqual(
    buildCompanyBillingUpdate(partialCompany, {
      accountType: "当座",
      accountNumber: "0000007",
      accountHolder: "修復名義",
    }),
    {
      accountType: "当座",
      accountNumber: "0000007",
      accountHolder: "修復名義",
    },
  );
  assert.deepEqual(buildCompanyBillingUpdate(partialCompany, EMPTY_BANK), {
    bankName: null,
    branchName: null,
  });
  assert.throws(
    () => buildCompanyBillingUpdate(partialCompany, { accountType: "普通" }),
    CompanyBillingUpdateError,
  );
});

test("legacy default-only billing remains a write-zero no-op", async () => {
  const company = {
    fixture: "legacy-default-only",
    invoiceNumber: null,
    ...EMPTY_BANK,
    accountType: "普通",
  };
  assert.deepEqual(buildCompanyBillingUpdate(company, { accountType: "普通" }), {});

  const { firestore, calls } = createFirestore({ company });
  const result = await updateCompanyBilling({
    firestore,
    identity,
    input: { changes: { accountType: "普通" } },
  });
  assert.deepEqual(result, { success: true, updated: false, updatedFields: [] });
  assert.deepEqual(calls, []);
});

test("legacy default-only unchanged input bypasses an invalid invoice context without writing metadata", async () => {
  const company = {
    fixture: "legacy-default-only-invalid-invoice",
    invoiceNumber: "invalid",
    ...EMPTY_BANK,
    accountType: "普通",
  };
  let timestampCalls = 0;
  const { firestore, calls } = createFirestore({ company });
  const result = await updateCompanyBilling({
    firestore,
    identity,
    input: { changes: { accountType: "普通" } },
    serverTimestampFactory: () => {
      timestampCalls += 1;
      return "SERVER_TIME";
    },
  });
  assert.deepEqual(result, { success: true, updated: false, updatedFields: [] });
  assert.equal(timestampCalls, 0);
  assert.deepEqual(calls, []);
});

test("billing normalization preserves leading zero and enforces trim, grapheme, control, and enum boundaries", () => {
  const padded = {
    bankName: "  架空銀行  ",
    branchName: "  中央支店  ",
    accountType: "普通",
    accountNumber: "0012345",
    accountHolder: "  カクウケイビ  ",
  };
  assert.deepEqual(
    buildCompanyBillingUpdate(
      { invoiceNumber: null, ...EMPTY_BANK },
      padded,
    ),
    COMPLETE_BANK,
  );

  const grapheme = "👨‍👩‍👧‍👦";
  assert.equal(
    buildCompanyBillingUpdate(
      { invoiceNumber: null, ...EMPTY_BANK },
      { ...COMPLETE_BANK, bankName: grapheme.repeat(100) },
    ).bankName,
    grapheme.repeat(100),
  );

  for (const changes of [
    { ...COMPLETE_BANK, bankName: grapheme.repeat(101) },
    { ...COMPLETE_BANK, accountHolder: grapheme.repeat(201) },
    { ...COMPLETE_BANK, bankName: "銀行\n支店" },
    { ...COMPLETE_BANK, branchName: "支店\r名" },
    { ...COMPLETE_BANK, accountHolder: "名義\u0000" },
    { ...COMPLETE_BANK, accountType: "貯蓄" },
    { ...COMPLETE_BANK, accountType: " 普通 " },
    { ...COMPLETE_BANK, accountNumber: "１２３" },
    { ...COMPLETE_BANK, accountNumber: "12345678" },
    { ...COMPLETE_BANK, accountNumber: 12345 },
  ]) {
    assert.throws(
      () =>
        buildCompanyBillingUpdate(
          { invoiceNumber: null, ...EMPTY_BANK },
          changes,
        ),
      CompanyBillingUpdateError,
    );
  }
});

test("only normalized changed fields and server metadata are persisted", async () => {
  const { firestore, calls, reads } = createFirestore();
  const result = await updateCompanyBilling({
    firestore,
    identity,
    input: {
      changes: {
        bankName: " 架空銀行 ",
        branchName: " 東支店 ",
        accountNumber: "0012345",
      },
    },
    serverTimestampFactory: () => "SERVER_TIME",
  });

  assert.deepEqual(reads, [
    "Companies/company-a/Users/billing-admin-a",
    "Companies/company-a",
  ]);
  assert.deepEqual(result, {
    success: true,
    updated: true,
    updatedFields: ["branchName"],
  });
  assert.deepEqual(calls, [
    {
      path: "Companies/company-a",
      value: {
        branchName: "東支店",
        updatedAt: "SERVER_TIME",
        uid: "billing-admin-a",
      },
    },
  ]);
  assert.equal("invoiceNumber" in calls[0].value, false);
  assert.equal("fixture" in calls[0].value, false);
});

test("complete same-value input is a write-zero no-op with unchanged metadata", async () => {
  let timestampCalls = 0;
  const { firestore, calls } = createFirestore();
  const result = await updateCompanyBilling({
    firestore,
    identity,
    input: { changes: { ...COMPLETE_BANK } },
    serverTimestampFactory: () => {
      timestampCalls += 1;
      return "SERVER_TIME";
    },
  });
  assert.deepEqual(result, { success: true, updated: false, updatedFields: [] });
  assert.equal(timestampCalls, 0);
  assert.deepEqual(calls, []);
});

test("invoiceNumber is validation context only and is never persisted", async () => {
  for (const invoiceNumber of ["1234567890123", " T1234567890123 "]) {
    const { firestore, calls } = createFirestore({
      company: { ...validCompany, invoiceNumber },
    });
    await updateCompanyBilling({
      firestore,
      identity,
      input: { changes: { branchName: "西支店" } },
      serverTimestampFactory: () => "SERVER_TIME",
    });
    assert.equal(calls.length, 1);
    assert.equal("invoiceNumber" in calls[0].value, false);
  }

  const { firestore, calls } = createFirestore({
    company: { ...validCompany, invoiceNumber: "invalid" },
  });
  await assert.rejects(
    () =>
      updateCompanyBilling({
        firestore,
        identity,
        input: { changes: { branchName: "西支店" } },
      }),
    CompanyBillingUpdateError,
  );
  assert.deepEqual(calls, []);
});

test("inactive, cross-tenant, non-admin, missing, and super-user actors write nothing", async () => {
  const scenarios = [
    { actor: null, currentIdentity: identity },
    { actor: { ...admin, companyId: "company-b" }, currentIdentity: identity },
    { actor: { ...admin, isTemporary: true }, currentIdentity: identity },
    { actor: { ...admin, disabled: true }, currentIdentity: identity },
    { actor: { ...admin, isAdmin: false }, currentIdentity: identity },
    {
      actor: { companyId: "company-a", disabled: false, isAdmin: true },
      currentIdentity: identity,
    },
    {
      actor: {
        companyId: "company-a",
        isTemporary: false,
        isAdmin: true,
      },
      currentIdentity: identity,
    },
    {
      actor: {
        companyId: "company-a",
        isTemporary: "false",
        disabled: false,
        isAdmin: true,
      },
      currentIdentity: identity,
    },
    {
      actor: {
        companyId: "company-a",
        isTemporary: false,
        disabled: 0,
        isAdmin: true,
      },
      currentIdentity: identity,
    },
    {
      actor: {
        companyId: "company-a",
        isTemporary: false,
        disabled: false,
        isAdmin: 1,
      },
      currentIdentity: identity,
    },
    { actor: admin, currentIdentity: { ...identity, isSuperUser: true } },
  ];

  for (const scenario of scenarios) {
    const { firestore, calls } = createFirestore({ actor: scenario.actor });
    await assert.rejects(
      () =>
        updateCompanyBilling({
          firestore,
          identity: scenario.currentIdentity,
          input: { changes: { branchName: "拒否支店" } },
        }),
      CompanyBillingUpdateError,
    );
    assert.deepEqual(calls, []);
  }
});

test("identifier injection and Company absence fail before any write", async () => {
  for (const currentIdentity of [
    { ...identity, companyId: "company-a/other" },
    { ...identity, companyId: " company-a" },
    { ...identity, uid: "admin/a" },
  ]) {
    const { firestore, calls } = createFirestore();
    await assert.rejects(
      () =>
        updateCompanyBilling({
          firestore,
          identity: currentIdentity,
          input: { changes: { branchName: "拒否支店" } },
        }),
      CompanyBillingUpdateError,
    );
    assert.deepEqual(calls, []);
  }

  const { firestore, calls } = createFirestore({ company: null });
  await assert.rejects(
    () =>
      updateCompanyBilling({
        firestore,
        identity,
        input: { changes: { branchName: "拒否支店" } },
      }),
    CompanyBillingUpdateError,
  );
  assert.deepEqual(calls, []);
});

test("Callable logging and response contract do not expose billing payload values", async () => {
  const source = await readFile(
    new URL("../../functions/apis/updateCompanyBilling.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /resolveCallableAuthIdentity\s*\(/);
  assert.match(source, /logger\.error\("Company billing update failed",\s*\{[\s\S]*errorName:[\s\S]*errorCode:/);
  assert.doesNotMatch(source, /logger\.[a-z]+\([^)]*request\.data/s);
  assert.doesNotMatch(source, /logger\.[a-z]+\([^)]*(bankName|branchName|accountNumber|accountHolder)/s);

  const { firestore } = createFirestore();
  const result = await updateCompanyBilling({
    firestore,
    identity,
    input: { changes: { branchName: "公開しない支店名" } },
    serverTimestampFactory: () => "SERVER_TIME",
  });
  assert.deepEqual(Object.keys(result).sort(), ["success", "updated", "updatedFields"]);
  assert.equal(JSON.stringify(result).includes("公開しない支店名"), false);
});

test("BillingEditor locks submission before async validation and dispatches once", async () => {
  const validation = createDeferred();
  let validationCalls = 0;
  let updateCalls = 0;
  const mounted = await loadBillingEditorHarness({
    validate: () => {
      validationCalls += 1;
      return validation.promise;
    },
    update: async () => {
      updateCalls += 1;
      return { success: true, updated: true, updatedFields: ["branchName"] };
    },
  });
  try {
    const first = mounted.module.save();
    assert.equal(mounted.module.isSaving.value, true);
    assert.equal(validationCalls, 1);
    await mounted.module.save();
    assert.equal(validationCalls, 1);
    validation.resolve({ valid: true });
    await first;
    assert.equal(updateCalls, 1);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("BillingEditor explicitly disables all editor controls while saving", async () => {
  const source = await readFile(
    new URL("../../components/Company/BillingEditor.vue", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /<air-item-input[\s\S]*?:disabled="isSaving"[\s\S]*?\/>/u,
  );
  assert.match(
    source,
    /<v-btn[\s\S]*?:disabled="isSaving"[\s\S]*?@click="reloadLatest"/u,
  );
  assert.match(source, /:disabled="isSaving \|\| hasExternalChanges"/u);
});

test("BillingEditor cannot reload latest values during a pending save", async () => {
  const pending = createDeferred();
  const mounted = await loadBillingEditorHarness({
    validate: async () => ({ valid: true }),
    update: async () => pending.promise,
  });
  try {
    mounted.module.updateProperties({ branchName: "送信中支店" });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();
    mounted.company.bankName = "別画面の銀行";
    mounted.triggerLiveWatcher();

    const draftBeforeReload = { ...mounted.module.draft.value };
    const baselineBeforeReload = { ...mounted.module.baseline.value };
    const pendingBeforeReload = { ...mounted.module.pendingOwnSnapshot.value };
    mounted.module.reloadLatest();

    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.deepEqual(mounted.module.draft.value, draftBeforeReload);
    assert.deepEqual(mounted.module.baseline.value, baselineBeforeReload);
    assert.deepEqual(mounted.module.pendingOwnSnapshot.value, pendingBeforeReload);

    pending.reject(new Error("server rejected billing update"));
    await saving;
  } finally {
    mounted.cleanup();
  }
});

test("BillingEditor rechecks live billing after validation before dispatch", async () => {
  const validation = createDeferred();
  let updateCalls = 0;
  const mounted = await loadBillingEditorHarness({
    validate: () => validation.promise,
    update: async () => {
      updateCalls += 1;
    },
  });
  try {
    const saving = mounted.module.save();
    mounted.company.branchName = "外部更新支店";
    mounted.triggerLiveWatcher();
    validation.resolve({ valid: true });
    await saving;
    assert.equal(updateCalls, 0);
    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.equal(mounted.module.isSaving.value, false);
    assert.equal(mounted.module.dialog.value, true);
  } finally {
    mounted.cleanup();
  }
});

test("BillingEditor ignores its pending save reflection and closes after success", async () => {
  const pending = createDeferred();
  let updateCalls = 0;
  let submitted;
  const mounted = await loadBillingEditorHarness({
    validate: async () => ({ valid: true }),
    update: async (payload) => {
      updateCalls += 1;
      submitted = payload;
      return pending.promise;
    },
  });
  try {
    mounted.module.updateProperties({ branchName: "保存反映支店" });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(updateCalls, 1);
    mounted.company.branchName = "保存反映支店";
    mounted.triggerLiveWatcher();
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(submitted.latest, mounted.company);
    assert.equal(submitted.draft.branchName, "保存反映支店");
    assert.equal(submitted.clearIntent, false);

    pending.resolve({
      success: true,
      updated: true,
      updatedFields: ["branchName"],
    });
    await saving;
    assert.equal(mounted.module.dialog.value, false);
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("BillingEditor keeps a real live-change warning after server failure", async () => {
  const pending = createDeferred();
  const mounted = await loadBillingEditorHarness({
    validate: async () => ({ valid: true }),
    update: async () => pending.promise,
  });
  try {
    mounted.module.updateProperties({ branchName: "送信中支店" });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();
    mounted.company.bankName = "別actor銀行";
    mounted.triggerLiveWatcher();
    pending.reject(new Error("server rejected billing update"));
    await saving;

    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.equal(mounted.module.errorMessage.value, "server rejected billing update");
    assert.equal(mounted.module.dialog.value, true);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("BillingEditor preserves reload-only conflict and explicit clear payload", async () => {
  const submissions = [];
  const mounted = await loadBillingEditorHarness({
    validate: async () => ({ valid: true }),
    update: async (payload) => {
      submissions.push(payload);
      return {
        success: true,
        updated: true,
        updatedFields: [...COMPANY_BILLING_FIELDS],
      };
    },
  });
  try {
    mounted.company.branchName = "外部確定支店";
    mounted.triggerLiveWatcher();
    assert.equal(mounted.module.hasExternalChanges.value, true);
    await mounted.module.save();
    assert.equal(submissions.length, 0);

    mounted.module.reloadLatest();
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(mounted.module.draft.value.branchName, "外部確定支店");
    mounted.module.clearBilling();
    await mounted.module.save();

    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].latest, mounted.company);
    assert.equal(submissions[0].baseline.branchName, "外部確定支店");
    assert.equal(submissions[0].clearIntent, true);
    assert.deepEqual(
      Object.fromEntries(
        COMPANY_BILLING_FIELDS.map((field) => [
          field,
          submissions[0].draft[field],
        ]),
      ),
      EMPTY_BANK,
    );
    assert.equal(mounted.module.dialog.value, false);
  } finally {
    mounted.cleanup();
  }
});
