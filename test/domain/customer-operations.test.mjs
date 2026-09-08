import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Customer, GeocodableMixin } from "../../schemas/index.js";
import { CUSTOMER_DOCUMENT_FIELDS } from "../../utils/customer/customerDocumentContract.js";
import {
  CUSTOMER_BASIC_FIELDS,
  CUSTOMER_CREATE_FIELDS,
  CUSTOMER_OPERATION,
  CUSTOMER_PAYMENT_FIELDS,
  CustomerOperationError,
  changedCustomerFields,
  customerOperationFields,
  customerOperationSchema,
  customerSnapshot,
  customerSnapshotsEqual,
  getCustomerOperationErrorMessage,
  getCustomerWriteDecision,
  hasCustomerOperationConflict,
  prepareCustomerCreate,
  prepareCustomerUpdate,
} from "../../composables/domain/customer/customerOperations.js";

function validCustomer(overrides = {}) {
  return new Customer({
    docId: "customer-a",
    uid: "actor-a",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    code: "C001",
    name: "架空警備株式会社",
    branchName: null,
    abbreviation: "架空警備",
    nameKana: "カクウケイビ",
    zipcode: "1000001",
    prefCode: "13",
    city: "千代田区",
    address: "千代田1-1",
    building: null,
    location: null,
    tel: "03-1234-5678",
    fax: null,
    contractStatus: Customer.STATUS_ACTIVE,
    cutoffDate: 0,
    paymentMonth: 1,
    paymentDate: 0,
    remarks: null,
    ...overrides,
  });
}

function actor(overrides = {}) {
  return {
    uid: "actor-a",
    companyId: "company-a",
    isSuperUser: false,
    isSuperUserClaimValid: true,
    user: {
      companyId: "company-a",
      isTemporary: false,
      disabled: false,
      isAdmin: false,
      roles: ["manager"],
    },
    ...overrides,
  };
}

test("Customer operation contract owns separate create, basic, and payment fields", () => {
  assert.deepEqual(
    customerOperationFields(CUSTOMER_OPERATION.UPDATE_BASIC),
    CUSTOMER_BASIC_FIELDS,
  );
  assert.deepEqual(
    customerOperationFields(CUSTOMER_OPERATION.UPDATE_PAYMENT),
    CUSTOMER_PAYMENT_FIELDS,
  );
  assert.deepEqual(
    customerOperationFields(CUSTOMER_OPERATION.CREATE),
    CUSTOMER_CREATE_FIELDS,
  );
  assert.equal(CUSTOMER_BASIC_FIELDS.includes("address"), true);
  assert.equal(CUSTOMER_BASIC_FIELDS.includes("contractStatus"), true);
  assert.equal(CUSTOMER_CREATE_FIELDS.includes("contractStatus"), false);
  assert.equal(CUSTOMER_PAYMENT_FIELDS.includes("contractStatus"), false);
  assert.deepEqual(
    customerOperationSchema(CUSTOMER_OPERATION.UPDATE_BASIC).find(({ key }) => key === "contractStatus"),
    Customer.schema.find(({ key }) => key === "contractStatus"),
  );
  assert.equal(CUSTOMER_BASIC_FIELDS.includes("cutoffDate"), false);
  assert.equal(CUSTOMER_PAYMENT_FIELDS.includes("name"), false);
  assert.throws(
    () => customerOperationFields("ARCHIVE"),
    (error) =>
      error instanceof CustomerOperationError && error.code === "invalid-operation",
  );
});

test("Customer write policy allows company administrators and manager or legal presets", () => {
  assert.equal(
    getCustomerWriteDecision(
      actor({ user: { ...actor().user, isAdmin: true, roles: [] } }),
    ).allowed,
    true,
  );
  assert.equal(getCustomerWriteDecision(actor()).allowed, true);
  assert.equal(
    getCustomerWriteDecision(
      actor({ user: { ...actor().user, roles: ["legal"] } }),
    ).allowed,
    true,
  );
});

test("Customer write policy rejects read-only, fabricated, inactive, and cross-tenant actors", () => {
  const baseUser = actor().user;
  const denied = [
    actor({ user: { ...baseUser, roles: ["controller"] } }),
    actor({ user: { ...baseUser, roles: ["accountant"] } }),
    actor({ user: { ...baseUser, roles: ["human-resource"] } }),
    actor({ user: { ...baseUser, roles: ["customers:write"] } }),
    actor({ user: { ...baseUser, roles: ["unknown-role"] } }),
    actor({ isSuperUser: true, user: { ...baseUser, roles: [] } }),
    actor({ user: { ...baseUser, isTemporary: true } }),
    actor({ user: { ...baseUser, disabled: true } }),
    actor({ user: { ...baseUser, companyId: "company-b" } }),
    actor({ isSuperUserClaimValid: false }),
    actor({ uid: "" }),
  ];
  for (const input of denied) {
    assert.equal(getCustomerWriteDecision(input).allowed, false);
  }
});

test("Customer create forces ACTIVE and actor metadata while validating required address", async () => {
  const now = new Date("2026-02-01T00:00:00.000Z");
  const draft = validCustomer({
    docId: "",
    uid: "spoofed",
    createdAt: null,
    updatedAt: null,
    contractStatus: Customer.STATUS_TERMINATED,
  });
  const candidate = await prepareCustomerCreate({
    draft,
    docId: "created-customer",
    actorUid: "actor-a",
    now,
  });

  assert.equal(candidate.docId, "created-customer");
  assert.equal(candidate.uid, "actor-a");
  assert.equal(candidate.contractStatus, Customer.STATUS_ACTIVE);
  assert.equal(candidate.createdAt, now);
  assert.equal(candidate.updatedAt, now);

  await assert.rejects(
    () =>
      prepareCustomerCreate({
        draft: validCustomer({ address: null }),
        docId: "missing-address",
        actorUid: "actor-a",
        now,
      }),
    /町域名・番地/u,
  );
});

test("Customer operation schema does not invent a zipcode length limit", async () => {
  const zipcode = customerOperationSchema(CUSTOMER_OPERATION.UPDATE_BASIC)
    .find(({ key }) => key === "zipcode");

  assert.ok(zipcode);
  assert.notEqual(zipcode.max, 16);
  assert.notEqual(zipcode.maxLength, 16);

  const candidate = await prepareCustomerCreate({
    draft: validCustomer({ zipcode: "1".repeat(17) }),
    docId: "zipcode-without-custom-limit",
    actorUid: "actor-a",
    now: new Date("2026-02-01T00:00:00.000Z"),
  });
  assert.equal(candidate.zipcode, "1".repeat(17));
});

test("Customer basic update changes only requested basic fields and preserves a concurrent payment change", async () => {
  const baseline = validCustomer();
  const latest = validCustomer({ paymentMonth: 2 });
  const draft = validCustomer({ city: "港区" });
  const now = new Date("2026-02-02T00:00:00.000Z");

  assert.deepEqual(
    changedCustomerFields({
      operation: CUSTOMER_OPERATION.UPDATE_BASIC,
      baseline,
      draft,
    }),
    ["city"],
  );
  assert.equal(
    hasCustomerOperationConflict({
      operation: CUSTOMER_OPERATION.UPDATE_BASIC,
      baseline,
      latest,
    }),
    false,
  );

  const prepared = await prepareCustomerUpdate({
    operation: CUSTOMER_OPERATION.UPDATE_BASIC,
    latest,
    baseline,
    draft,
    actorUid: "actor-b",
    now,
  });
  assert.deepEqual(prepared.fields, ["city"]);
  assert.equal(prepared.candidate.city, "港区");
  assert.equal(prepared.candidate.paymentMonth, 2);
  assert.equal(prepared.candidate.uid, "actor-b");
  assert.equal(prepared.candidate.updatedAt, now);
});

test("Customer editor requires reload when an owned field changes after editing starts", async () => {
  const baseline = validCustomer();
  const latest = validCustomer({ tel: "03-9999-9999" });
  const draft = validCustomer({ city: "港区" });

  assert.equal(
    hasCustomerOperationConflict({
      operation: CUSTOMER_OPERATION.UPDATE_BASIC,
      baseline,
      latest,
    }),
    true,
  );
  await assert.rejects(
    () =>
      prepareCustomerUpdate({
        operation: CUSTOMER_OPERATION.UPDATE_BASIC,
        latest,
        baseline,
        draft,
        actorUid: "actor-a",
        now: new Date(),
      }),
    (error) =>
      error instanceof CustomerOperationError && error.code === "conflict",
  );
});

async function loadEditorHarness({ component, update }) {
  const source = await readFile(
    new URL(`../../components/Customer/Editor/${component}.vue`, import.meta.url),
    "utf8",
  );
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  const customer = validCustomer();
  let watchHandler = null;
  const actionName = component === "Base" ? "updateBasic" : "updatePayment";
  globalThis.__customerEditorHarness = {
    CUSTOMER_OPERATION,
    Customer,
    customer,
    customerOperationSchema,
    customerSnapshot,
    customerSnapshotsEqual,
    getCustomerOperationErrorMessage,
    defineProps: () => ({ customer, title: "取引先基本情報の編集" }),
    ref: (value) => ({ value }),
    useCustomerActions: () => ({
      canWrite: { value: true },
      isSaving: { value: false },
      [actionName]: update,
    }),
    watch: (_source, handler) => {
      watchHandler = handler;
    },
  };
  const executable = script.replace(/^import[\s\S]*?;\r?\n/gmu, "");
  const moduleSource = `
    const {
      CUSTOMER_OPERATION, Customer, customerOperationSchema, customerSnapshot,
      customerSnapshotsEqual, defineProps, getCustomerOperationErrorMessage,
      ref, useCustomerActions, watch
    } = globalThis.__customerEditorHarness;
    ${executable}
    export {
      dialog, draft, errorMessage, hasExternalChanges,
      isWaitingForRollback, open, save, updateProperties, reloadLatest
    };
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`,
  );
  return {
    customer,
    module,
    triggerSourceWatch: () => watchHandler?.(),
    cleanup: () => delete globalThis.__customerEditorHarness,
  };
}

for (const scenario of [
  {
    component: "Base",
    field: "contractStatus",
    draftValue: Customer.STATUS_TERMINATED,
    externalValue: Customer.STATUS_TERMINATED,
    fallback: "取引先の基本情報を更新できませんでした。",
    rawError: "FirebaseError: Missing or insufficient permissions.",
  },
  {
    component: "Base",
    field: "city",
    draftValue: "入力中の市",
    externalValue: "外部更新の市",
    fallback: "取引先の基本情報を更新できませんでした。",
    rawError: "FirebaseError: Missing or insufficient permissions.",
  },
  {
    component: "Payment",
    field: "paymentMonth",
    draftValue: 2,
    externalValue: 3,
    fallback: "請求・回収条件を更新できませんでした。",
    rawError: "FirebaseError: backend connection failed at internal-host",
  },
]) {
  test(`Customer ${scenario.component} ${scenario.field} editor ignores its own pending write reflection`, async () => {
    let releaseWrite;
    let mounted;
    const writePending = new Promise((resolve) => {
      releaseWrite = resolve;
    });
    mounted = await loadEditorHarness({
      component: scenario.component,
      update: async ({ draft }) => {
        mounted.customer[scenario.field] = draft[scenario.field];
        mounted.triggerSourceWatch();
        await writePending;
      },
    });
    try {
      mounted.module.open();
      mounted.module.updateProperties({ [scenario.field]: scenario.draftValue });
      const saving = mounted.module.save();
      await Promise.resolve();
      assert.equal(mounted.module.hasExternalChanges.value, false);
      assert.equal(mounted.module.draft.value[scenario.field], scenario.draftValue);
      releaseWrite();
      await saving;
      assert.equal(mounted.module.dialog.value, false);
    } finally {
      mounted.cleanup();
    }
  });

  test(`Customer ${scenario.component} ${scenario.field} editor keeps its draft and can retry after a write failure`, async () => {
    let calls = 0;
    let mounted;
    let originalValue;
    mounted = await loadEditorHarness({
      component: scenario.component,
      update: async ({ draft }) => {
        calls += 1;
        if (calls === 1) {
          mounted.customer[scenario.field] = draft[scenario.field];
          mounted.triggerSourceWatch();
          throw new Error(scenario.rawError);
        }
      },
    });
    try {
      mounted.module.open();
      originalValue = mounted.customer[scenario.field];
      mounted.module.updateProperties({ [scenario.field]: scenario.draftValue });
      await mounted.module.save();
      assert.equal(mounted.module.dialog.value, true);
      assert.equal(mounted.module.draft.value[scenario.field], scenario.draftValue);
      assert.equal(mounted.module.errorMessage.value, scenario.fallback);
      assert.doesNotMatch(mounted.module.errorMessage.value, /FirebaseError|internal-host|permissions/u);
      assert.equal(mounted.module.hasExternalChanges.value, false);
      assert.equal(mounted.module.isWaitingForRollback.value, true);

      await mounted.module.save();
      assert.equal(calls, 1);
      assert.equal(mounted.module.dialog.value, true);

      mounted.customer[scenario.field] = originalValue;
      mounted.triggerSourceWatch();
      assert.equal(mounted.module.isWaitingForRollback.value, false);
      await mounted.module.save();
      assert.equal(calls, 2);
      assert.equal(mounted.module.dialog.value, false);
    } finally {
      mounted.cleanup();
    }
  });

  test(`Customer ${scenario.component} ${scenario.field} editor requires reload for a genuine same-operation update`, async () => {
    let calls = 0;
    const mounted = await loadEditorHarness({
      component: scenario.component,
      update: async () => {
        calls += 1;
      },
    });
    try {
      mounted.module.open();
      mounted.module.updateProperties({ [scenario.field]: scenario.draftValue });
      mounted.customer[scenario.field] = scenario.externalValue;
      mounted.triggerSourceWatch();
      assert.equal(mounted.module.hasExternalChanges.value, true);
      await mounted.module.save();
      assert.equal(calls, 0);
      assert.equal(mounted.module.dialog.value, true);
    } finally {
      mounted.cleanup();
    }
  });
}

async function loadCustomerActionsHarness({ update }) {
  const source = await readFile(
    new URL(
      "../../composables/application/customer/useCustomerActions.js",
      import.meta.url,
    ),
    "utf8",
  );
  const recordedErrors = [];
  const loggerCalls = [];
  const auth = actor();
  globalThis.__customerActionsHarness = {
    Vue: {
      computed: (getter) => ({ get value() { return getter(); } }),
      readonly: (value) => value,
      ref: (value) => ({ value }),
    },
    CUSTOMER_OPERATION,
    CustomerOperationError,
    createCustomerWriter: () => ({
      reserveDocument: () => ({ id: "reserved-customer" }),
      create: async () => {},
      update,
    }),
    getCustomerWriteDecision,
    hasCustomerOperationConflict,
    prepareCustomerCreate,
    prepareCustomerUpdate,
    useAuthStore: () => auth,
    useErrorsStore: () => ({
      add: (error) => recordedErrors.push(error),
    }),
    useLogger: (_sender, errorsStore) => ({
      error: (payload) => {
        loggerCalls.push(payload);
        errorsStore.add(payload.error || new Error(payload.message));
      },
    }),
    useNuxtApp: () => ({ $firestore: "FIRESTORE" }),
  };
  const executable = source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
  const moduleSource = `
    const {
      Vue, CUSTOMER_OPERATION, CustomerOperationError, createCustomerWriter,
      getCustomerWriteDecision, hasCustomerOperationConflict, prepareCustomerCreate, prepareCustomerUpdate,
      useAuthStore, useErrorsStore, useLogger, useNuxtApp
    } = globalThis.__customerActionsHarness;
    ${executable}
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`,
  );
  return {
    actions: module.useCustomerActions(),
    auth,
    loggerCalls,
    recordedErrors,
    cleanup: () => delete globalThis.__customerActionsHarness,
  };
}

test("Customer update sends only a fixed message to the global error route", async () => {
  const rawMessage = "FirebaseError: Missing or insufficient permissions for secret/path";
  const rawError = new Error(rawMessage);
  const harness = await loadCustomerActionsHarness({
    update: async () => {
      throw rawError;
    },
  });
  try {
    const latest = validCustomer();
    await assert.rejects(
      () => harness.actions.updateBasic({
        latest,
        baseline: customerSnapshot(latest, CUSTOMER_OPERATION.UPDATE_BASIC),
        draft: validCustomer({ city: "港区" }),
      }),
      (error) => error === rawError,
    );
    assert.deepEqual(harness.loggerCalls, [{ message: "Customer update failed" }]);
    assert.equal(harness.recordedErrors.length, 1);
    assert.equal(harness.recordedErrors[0].message, "Customer update failed");
    assert.doesNotMatch(harness.recordedErrors[0].message, /FirebaseError|secret\/path|permissions/u);
  } finally {
    harness.cleanup();
  }
});

async function loadWriterHarness() {
  const source = await readFile(
    new URL("../../utils/customer/customerWriter.js", import.meta.url),
    "utf8",
  );
  const calls = [];
  class GeoPoint {
    constructor(latitude, longitude) {
      this.latitude = latitude;
      this.longitude = longitude;
    }
  }
  const CustomerMock = {
    converter: () => ({
      toFirestore: (customer) => ({
        ...customer,
        geopoint: customer.location
          ? new GeoPoint(customer.location.lat, customer.location.lng)
          : null,
      }),
    }),
  };
  globalThis.__customerWriterHarness = {
    CUSTOMER_DOCUMENT_FIELDS,
    CUSTOMER_ADDRESS_FIELDS: ["prefCode", "city", "address"],
    CUSTOMER_NAME_FIELDS: ["name", "nameKana"],
    CUSTOMER_OPERATION,
    Customer: CustomerMock,
    collection: (...segments) => ({ path: segments.slice(1).join("/") }),
    doc: (parent, id) => ({ id: id ?? "reserved-customer", path: `${parent.path}/${id ?? "reserved-customer"}` }),
    serverTimestamp: () => "SERVER_TIMESTAMP",
    setDoc: async (reference, data) => calls.push({ kind: "set", path: reference.path, data }),
    updateDoc: async (reference, data) => calls.push({ kind: "update", path: reference.path, data }),
  };
  const executable = source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
  const moduleSource = `
    const {
      CUSTOMER_ADDRESS_FIELDS, CUSTOMER_NAME_FIELDS, CUSTOMER_OPERATION, CUSTOMER_DOCUMENT_FIELDS,
      Customer, collection, doc, serverTimestamp, setDoc, updateDoc
    } = globalThis.__customerWriterHarness;
    ${executable}
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`,
  );
  return {
    calls,
    createWriter: () => module.createCustomerWriter({ firestore: "FIRESTORE" }),
    cleanup: () => delete globalThis.__customerWriterHarness,
  };
}

test("Customer writer sends an exact create shape and server timestamps", async () => {
  const harness = await loadWriterHarness();
  try {
    const writer = harness.createWriter();
    const reference = writer.reserveDocument("company-a");
    await writer.create({ reference, documentReference: reference, customer: validCustomer() });
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0].kind, "set");
    assert.deepEqual(Object.keys(harness.calls[0].data).sort(), [
      "abbreviation", "address", "branchName", "building", "city", "code",
      "contractStatus", "createdAt", "cutoffDate", "docId", "fax", "fullAddress",
      "geopoint", "location", "name", "nameKana", "paymentDate", "paymentMonth",
      "prefCode", "prefecture", "remarks", "tel", "tokenMap", "uid", "updatedAt",
      "zipcode",
    ].sort());
    assert.equal(harness.calls[0].data.createdAt, "SERVER_TIMESTAMP");
    assert.equal(harness.calls[0].data.updatedAt, "SERVER_TIMESTAMP");
  } finally {
    harness.cleanup();
  }
});

test("Customer writer expands only required derived fields for partial updates", async () => {
  const harness = await loadWriterHarness();
  try {
    const writer = harness.createWriter();
    const customer = validCustomer({
      location: { lat: 35.0, lng: 139.0, formattedAddress: "東京都千代田区" },
    });
    await writer.update({
      companyId: "company-a",
      operation: CUSTOMER_OPERATION.UPDATE_BASIC,
      customer,
      fields: ["name", "city"],
    });
    assert.deepEqual(Object.keys(harness.calls[0].data).sort(), [
      "city", "fullAddress", "geopoint", "location", "name", "prefecture",
      "tokenMap", "uid", "updatedAt",
    ].sort());

    harness.calls.length = 0;
    await writer.update({
      companyId: "company-a",
      operation: CUSTOMER_OPERATION.UPDATE_PAYMENT,
      customer,
      fields: ["paymentMonth"],
    });
    assert.deepEqual(Object.keys(harness.calls[0].data).sort(), [
      "paymentMonth", "uid", "updatedAt",
    ]);
  } finally {
    harness.cleanup();
  }
});

test("Customer status-only updates preserve other fields, skip geocoding, and no-op without a write", async () => {
  const harness = await loadWriterHarness();
  const originalBeforeUpdate = Customer.prototype.beforeUpdate;
  const originalGeocoder = GeocodableMixin._geocodingFunction;
  let geocodingCalls = 0;
  GeocodableMixin.setGeocodingFunction(async () => { geocodingCalls += 1; throw new Error("Unexpected geocoding"); });
  let hooks = 0;
  Customer.prototype.beforeUpdate = async function (...args) {
    hooks += 1;
    return originalBeforeUpdate.apply(this, args);
  };
  try {
    const writer = harness.createWriter();
    for (const [from, to] of [[Customer.STATUS_ACTIVE, Customer.STATUS_TERMINATED], [Customer.STATUS_TERMINATED, Customer.STATUS_ACTIVE]]) {
      const latest = validCustomer({ contractStatus: from, location: { lat: 35, lng: 139, formattedAddress: "合成住所" } });
      const prepared = await prepareCustomerUpdate({
        operation: CUSTOMER_OPERATION.UPDATE_BASIC, latest, baseline: customerSnapshot(latest, CUSTOMER_OPERATION.UPDATE_BASIC),
        draft: validCustomer({ ...latest.toObject(), contractStatus: to }), actorUid: "actor-b", now: new Date("2026-09-03T00:00:00Z"),
      });
      assert.deepEqual(prepared.fields, ["contractStatus"]);
      for (const field of CUSTOMER_DOCUMENT_FIELDS.filter((field) => !["contractStatus", "uid", "updatedAt"].includes(field))) {
        assert.deepEqual(prepared.candidate[field], latest[field], field);
      }
      await writer.update({ companyId: "company-a", operation: CUSTOMER_OPERATION.UPDATE_BASIC, customer: prepared.candidate, fields: prepared.fields });
      assert.deepEqual(harness.calls.at(-1).data, { contractStatus: to, uid: "actor-b", updatedAt: "SERVER_TIMESTAMP" });
      const unchanged = await prepareCustomerUpdate({ operation: CUSTOMER_OPERATION.UPDATE_BASIC, latest, baseline: latest, draft: latest.clone(), actorUid: "actor-b", now: new Date() });
      assert.deepEqual(unchanged.fields, []);
      const count = harness.calls.length;
      await writer.update({ companyId: "company-a", operation: CUSTOMER_OPERATION.UPDATE_BASIC, customer: unchanged.candidate, fields: unchanged.fields });
      assert.equal(harness.calls.length, count);
    }
    assert.equal(hooks, 2, "no-op must skip beforeUpdate");
    assert.equal(geocodingCalls, 0);
  } finally {
    Customer.prototype.beforeUpdate = originalBeforeUpdate;
    GeocodableMixin.setGeocodingFunction(originalGeocoder);
    harness.cleanup();
  }
});

test("Customer basic draft may change status and basic fields while a concurrent payment change survives", async () => {
  const baseline = validCustomer();
  const latest = validCustomer({ paymentMonth: 2 });
  const prepared = await prepareCustomerUpdate({ operation: CUSTOMER_OPERATION.UPDATE_BASIC, baseline, latest,
    draft: validCustomer({ remarks: "合成変更", contractStatus: Customer.STATUS_TERMINATED, paymentMonth: 3 }), actorUid: "actor-b", now: new Date() });
  assert.deepEqual([...prepared.fields].sort(), ["contractStatus", "remarks"]);
  assert.equal(prepared.candidate.paymentMonth, 2);
  assert.equal(prepared.candidate.contractStatus, Customer.STATUS_TERMINATED);
});

test("Customer status invalid values are rejected by the operation", async () => {
  for (const status of [null, "UNKNOWN", 1, true, {}, []]) {
    const latest = validCustomer();
    const draft = latest.toObject();
    draft.contractStatus = status;
    await assert.rejects(() => prepareCustomerUpdate({ operation: CUSTOMER_OPERATION.UPDATE_BASIC, latest, baseline: latest,
      draft, actorUid: "actor-a", now: new Date() }), (error) => error.code === "invalid-customer");
  }
});

test("Customer Base rollback wait yields to a genuine external update and allows explicit reload", async () => {
  let mounted;
  mounted = await loadEditorHarness({ component: "Base", update: async ({ draft }) => {
    mounted.customer.contractStatus = draft.contractStatus;
    mounted.triggerSourceWatch();
    throw new Error("synthetic denied write");
  } });
  try {
    mounted.module.open();
    mounted.module.updateProperties({ contractStatus: Customer.STATUS_TERMINATED });
    assert.equal(mounted.customer.contractStatus, Customer.STATUS_ACTIVE, "draft is independent");
    await mounted.module.save();
    assert.equal(mounted.module.isWaitingForRollback.value, true);
    mounted.customer.remarks = "別画面の確定変更";
    mounted.triggerSourceWatch();
    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.equal(mounted.module.isWaitingForRollback.value, false);
    mounted.module.reloadLatest();
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(mounted.module.draft.value.remarks, "別画面の確定変更");
  } finally { mounted.cleanup(); }
});

test("Customer Base ignores external payment updates but reloads external status", async () => {
  let calls = 0;
  const mounted = await loadEditorHarness({ component: "Base", update: async () => { calls += 1; } });
  try {
    mounted.module.open();
    mounted.module.updateProperties({ remarks: "入力保持" });
    mounted.customer.paymentMonth = 2;
    mounted.triggerSourceWatch();
    assert.equal(mounted.module.hasExternalChanges.value, false);
    mounted.customer.contractStatus = Customer.STATUS_TERMINATED;
    mounted.triggerSourceWatch();
    await mounted.module.save();
    assert.equal(calls, 0);
    assert.equal(mounted.module.draft.value.remarks, "入力保持");
    mounted.module.reloadLatest();
    assert.equal(mounted.module.draft.value.contractStatus, Customer.STATUS_TERMINATED);
    assert.equal(mounted.module.hasExternalChanges.value, false);
  } finally { mounted.cleanup(); }
});

for (const failure of ["permission", "conflict"]) {
  test(`Customer rechecks ${failure} after asynchronous beforeUpdate and before sending`, async () => {
    let writes = 0;
    const harness = await loadCustomerActionsHarness({ update: async () => { writes += 1; } });
    const original = Customer.prototype.beforeUpdate;
    const latest = validCustomer();
    Customer.prototype.beforeUpdate = async () => {
      await Promise.resolve();
      if (failure === "permission") harness.auth.user.disabled = true;
      else latest.contractStatus = Customer.STATUS_TERMINATED;
    };
    try {
      await assert.rejects(() => harness.actions.updateBasic({ latest, baseline: customerSnapshot(latest, CUSTOMER_OPERATION.UPDATE_BASIC),
        draft: validCustomer({ remarks: "合成入力" }) }), (error) => error.code === (failure === "permission" ? "permission-denied" : "conflict"));
      assert.equal(writes, 0);
      assert.equal(harness.actions.isSaving.value, false);
    } finally { Customer.prototype.beforeUpdate = original; harness.cleanup(); }
  });
}

for (const scenario of ["uid", "company", "replacement-status", "replacement-docId"]) {
  test(`Customer rejects asynchronous ${scenario} changes before writer dispatch`, async () => {
    let writes = 0;
    const harness = await loadCustomerActionsHarness({ update: async () => { writes += 1; } });
    const original = Customer.prototype.beforeUpdate;
    let latest = validCustomer();
    const baseline = customerSnapshot(latest, CUSTOMER_OPERATION.UPDATE_BASIC);
    Customer.prototype.beforeUpdate = async () => {
      await Promise.resolve();
      if (scenario === "uid") harness.auth.uid = "actor-b";
      if (scenario === "company") {
        harness.auth.companyId = "company-b";
        harness.auth.user.companyId = "company-b";
      }
      if (scenario === "replacement-status") latest = validCustomer({ contractStatus: Customer.STATUS_TERMINATED });
      if (scenario === "replacement-docId") latest = validCustomer({ docId: "different-customer" });
      assert.equal(harness.actions.canWrite.value, true, "authorization alone still allows the new actor context");
    };
    try {
      await assert.rejects(() => harness.actions.updateBasic({ latest: () => latest, baseline,
        draft: validCustomer({ remarks: "保存待ちの合成入力" }) }),
      (error) => error.code === (["uid", "company"].includes(scenario) ? "permission-denied" : "conflict"));
      assert.equal(writes, 0);
      assert.equal(harness.actions.isSaving.value, false);
    } finally { Customer.prototype.beforeUpdate = original; harness.cleanup(); }
  });
}
