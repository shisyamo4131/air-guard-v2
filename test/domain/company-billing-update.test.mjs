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
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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
  const harness = {
    Company,
    defineProps: () => ({ company, title: "振込先の編集" }),
    ref: (value) => ({ value }),
    watch: () => {},
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
    export { form, hasExternalChanges, isSaving, open, save };
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`
  );
  module.form.value = { validate };
  module.open();
  return {
    company,
    module,
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
    validation.resolve({ valid: true });
    await saving;
    assert.equal(updateCalls, 0);
    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});
