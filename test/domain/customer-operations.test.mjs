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
  customerOperationFields,
  customerOperationSchema,
  getCustomerOperationErrorMessage,
  getCustomerWriteDecision,
  prepareCustomerCreate,
  prepareCustomerUpdate,
} from "../../composables/domain/customer/customerOperations.js";
import {
  captureCustomerCreationScope,
  deliverCommittedCustomer,
  initializeCommittedCustomerDraft,
} from "../../composables/application/customer/customerCreationBridge.js";

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

test("Customer update validates and returns the complete edited document", async () => {
  const latest = validCustomer({ paymentMonth: 2 });
  const draft = validCustomer({
    city: "港区",
    paymentMonth: 1,
    remarks: "編集開始時の全体値",
  });
  const now = new Date("2026-02-02T00:00:00.000Z");
  const prepared = await prepareCustomerUpdate({
    latest,
    draft,
    actorUid: "actor-b",
    now,
  });

  assert.equal(prepared.candidate.city, "港区");
  assert.equal(prepared.candidate.paymentMonth, 1);
  assert.equal(prepared.candidate.remarks, "編集開始時の全体値");
  assert.equal(prepared.candidate.docId, latest.docId);
  assert.deepEqual(prepared.candidate.createdAt, latest.createdAt);
  assert.equal(prepared.candidate.uid, "actor-b");
  assert.equal(prepared.candidate.updatedAt, now);
});

test("Customer update does not merge a later unrelated listener field into the edited document", async () => {
  const latest = validCustomer({ paymentMonth: 2 });
  const editedSnapshot = validCustomer({ city: "港区", paymentMonth: 1 });
  const prepared = await prepareCustomerUpdate({
    latest,
    draft: editedSnapshot,
    actorUid: "actor-b",
    now: new Date("2026-02-02T00:00:00.000Z"),
  });

  assert.equal(prepared.candidate.city, "港区");
  assert.equal(prepared.candidate.paymentMonth, 1);
});

test("Customer update anchors immutable identity fields to the latest document", async () => {
  const createdAt = new Date("2025-12-01T00:00:00.000Z");
  const latest = validCustomer({ docId: "canonical-id", createdAt });
  const draft = validCustomer({
    docId: "spoofed-id",
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    uid: "spoofed-actor",
    remarks: "変更",
  });
  const prepared = await prepareCustomerUpdate({
    latest,
    draft,
    actorUid: "actor-b",
    now: new Date("2026-02-02T00:00:00.000Z"),
  });

  assert.equal(prepared.candidate.docId, "canonical-id");
  assert.deepEqual(prepared.candidate.createdAt, createdAt);
  assert.equal(prepared.candidate.uid, "actor-b");
});

async function loadCustomerActionsHarness({ create = async () => {}, update }) {
  const source = await readFile(
    new URL(
      "../../composables/application/customer/useCustomerActions.js",
      import.meta.url,
    ),
    "utf8",
  );
  const recordedErrors = [];
  const loggerCalls = [];
  const consoleErrors = [];
  const auth = actor();
  const writerCalls = { create: 0, reserve: 0 };
  globalThis.__customerActionsHarness = {
    console: {
      error: (...args) => consoleErrors.push(args),
    },
    Vue: {
      computed: (getter) => ({ get value() { return getter(); } }),
      readonly: (value) => value,
      ref: (value) => ({ value }),
    },
    CUSTOMER_OPERATION,
    CustomerOperationError,
    createCustomerWriter: () => ({
      reserveDocument: () => {
        writerCalls.reserve += 1;
        return { id: "reserved-customer" };
      },
      create: async (args) => {
        writerCalls.create += 1;
        return await create(args);
      },
      update,
    }),
    getCustomerWriteDecision,
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
      Vue, console, CUSTOMER_OPERATION, CustomerOperationError, createCustomerWriter,
      getCustomerWriteDecision, prepareCustomerCreate, prepareCustomerUpdate,
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
    consoleErrors,
    loggerCalls,
    recordedErrors,
    writerCalls,
    cleanup: () => delete globalThis.__customerActionsHarness,
  };
}

test("Customer create returns the generated document ID from one reservation and one write", async () => {
  let written = null;
  const harness = await loadCustomerActionsHarness({
    create: async (args) => {
      written = args;
    },
    update: async () => {},
  });
  try {
    const created = await harness.actions.createCustomer(
      validCustomer({ docId: "client-supplied-id" }),
    );
    assert.equal(harness.writerCalls.reserve, 1);
    assert.equal(harness.writerCalls.create, 1);
    assert.equal(created.docId, "reserved-customer");
    assert.equal(written.documentReference.id, "reserved-customer");
    assert.equal(written.customer, created);
  } finally {
    harness.cleanup();
  }
});

test("Customer creation bridge initializes once and delivers cache before selection", () => {
  const created = validCustomer({ docId: "generated-customer" });
  const initialized = [];
  const draft = {
    initialize: (raw) => initialized.push(raw),
  };
  assert.equal(initializeCommittedCustomerDraft(draft, created), true);
  assert.equal(initialized.length, 1);
  assert.equal(initialized[0].docId, "generated-customer");

  const order = [];
  const scope = captureCustomerCreationScope({
    companyId: "company-a",
    uid: "actor-a",
  });
  assert.equal(
    deliverCommittedCustomer({
      created,
      creationScope: scope,
      currentScope: captureCustomerCreationScope({
        companyId: "company-a",
        uid: "actor-a",
      }),
      pushCustomer: (customer) => order.push(["cache", customer]),
      selectCustomer: (customer) => order.push(["selection", customer]),
    }),
    true,
  );
  assert.deepEqual(order, [
    ["cache", created],
    ["selection", created],
  ]);
});

test("Customer creation bridge discards failures and stale tenant or auth completions", () => {
  const created = validCustomer({ docId: "generated-customer" });
  const creationScope = captureCustomerCreationScope({
    companyId: "company-a",
    uid: "actor-a",
  });
  for (const [candidate, currentScope] of [
    [null, creationScope],
    [validCustomer({ docId: "" }), creationScope],
    [
      created,
      captureCustomerCreationScope({ companyId: "company-b", uid: "actor-a" }),
    ],
    [
      created,
      captureCustomerCreationScope({ companyId: "company-a", uid: "actor-b" }),
    ],
  ]) {
    let cacheWrites = 0;
    let selections = 0;
    assert.equal(
      deliverCommittedCustomer({
        created: candidate,
        creationScope,
        currentScope,
        pushCustomer: () => {
          cacheWrites += 1;
        },
        selectCustomer: () => {
          selections += 1;
        },
      }),
      false,
    );
    assert.equal(cacheWrites, 0);
    assert.equal(selections, 0);
  }
});

test("Customer create converts an unknown writer failure to one safe typed error", async () => {
  const rawError = new Error(
    "FirebaseError: Missing or insufficient permissions for secret/path",
  );
  const harness = await loadCustomerActionsHarness({
    create: async () => {
      throw rawError;
    },
    update: async () => {},
  });
  try {
    await assert.rejects(
      () => harness.actions.createCustomer(validCustomer({ docId: "" })),
      (error) => {
        assert.equal(error instanceof CustomerOperationError, true);
        assert.equal(error.code, "create-failed");
        assert.equal(error.message, "取引先を登録できませんでした。");
        assert.doesNotMatch(error.message, /FirebaseError|secret\/path|permissions/u);
        return true;
      },
    );
    assert.deepEqual(harness.consoleErrors, [
      ["[useCustomerActions] CUSTOMER_CREATE_FAILED"],
    ]);
    assert.doesNotMatch(
      JSON.stringify(harness.consoleErrors),
      /FirebaseError|secret\/path|permissions/u,
    );
    assert.deepEqual(harness.loggerCalls, []);
    assert.deepEqual(harness.recordedErrors, []);
  } finally {
    harness.cleanup();
  }
});

test("Customer create passes typed operation failures through without duplicate reporting", async () => {
  const typedError = new CustomerOperationError(
    "permission-denied",
    "取引先を変更する権限がありません。",
  );
  const harness = await loadCustomerActionsHarness({
    create: async () => {
      throw typedError;
    },
    update: async () => {},
  });
  try {
    await assert.rejects(
      () => harness.actions.createCustomer(validCustomer({ docId: "" })),
      (error) => error === typedError,
    );
    assert.deepEqual(harness.consoleErrors, []);
    assert.deepEqual(harness.loggerCalls, []);
    assert.deepEqual(harness.recordedErrors, []);
  } finally {
    harness.cleanup();
  }
});

test("Customer update converts an unknown writer failure to one safe error", async () => {
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
      () => harness.actions.updateCustomer({
        latest,
        draft: validCustomer({ city: "港区" }),
      }),
      (error) => {
        assert.equal(error instanceof CustomerOperationError, true);
        assert.equal(error.code, "update-failed");
        assert.equal(error.message, "取引先情報を更新できませんでした。");
        assert.doesNotMatch(error.message, /FirebaseError|secret\/path|permissions/u);
        return true;
      },
    );
    assert.ok(harness.consoleErrors.length <= 1);
    if (harness.consoleErrors.length === 1) {
      assert.deepEqual(harness.consoleErrors[0], [
        "[useCustomerActions] CUSTOMER_UPDATE_FAILED",
      ]);
    }
    assert.doesNotMatch(
      JSON.stringify(harness.consoleErrors),
      /FirebaseError|secret\/path|permissions/u,
    );
    assert.equal(
      harness.consoleErrors.flat().includes(rawError),
      false,
    );
    assert.deepEqual(harness.loggerCalls, []);
    assert.deepEqual(harness.recordedErrors, []);
  } finally {
    harness.cleanup();
  }
});

test("Customer update passes typed operation failures through without duplicate reporting", async () => {
  const typedError = new CustomerOperationError(
    "permission-denied",
    "取引先を変更する権限がありません。",
  );
  const harness = await loadCustomerActionsHarness({
    update: async () => {
      throw typedError;
    },
  });
  try {
    const latest = validCustomer();
    await assert.rejects(
      () => harness.actions.updateCustomer({
        latest,
        draft: validCustomer({ city: "港区" }),
      }),
      (error) => error === typedError,
    );
    assert.deepEqual(harness.consoleErrors, []);
    assert.deepEqual(harness.loggerCalls, []);
    assert.deepEqual(harness.recordedErrors, []);
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
    setDoc: async (reference, data, options) => calls.push({
      kind: "set",
      path: reference.path,
      data,
      options,
    }),
  };
  const executable = source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
  const moduleSource = `
    const {
      CUSTOMER_ADDRESS_FIELDS, CUSTOMER_NAME_FIELDS, CUSTOMER_OPERATION, CUSTOMER_DOCUMENT_FIELDS,
      Customer, collection, doc, serverTimestamp, setDoc
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

test("Real Customer converter exactly matches the persisted field contract", () => {
  let previousAdapter = null;
  try {
    previousAdapter = Customer.getAdapter();
  } catch {
    // The test installs only the minimal adapter needed by the real converter.
  }
  class GeoPoint {
    constructor(latitude, longitude) {
      this.latitude = latitude;
      this.longitude = longitude;
    }
  }
  Customer.setAdapter({ GeoPoint });
  try {
    const customer = validCustomer({
      location: {
        formattedAddress: "東京都千代田区千代田1-1",
        lat: 35.685,
        lng: 139.752,
      },
    });
    const persisted = Customer.converter().toFirestore(customer);

    assert.deepEqual(
      Object.keys(persisted).sort(),
      [...CUSTOMER_DOCUMENT_FIELDS].sort(),
    );
    assert.equal(persisted.docId, customer.docId);
    assert.deepEqual(persisted.createdAt, customer.createdAt);
    assert.equal(persisted.uid, customer.uid);
    assert.deepEqual(persisted.updatedAt, customer.updatedAt);
    assert.deepEqual(persisted.tokenMap, customer.tokenMap);
    assert.equal(persisted.fullAddress, customer.fullAddress);
    assert.equal(persisted.prefecture, customer.prefecture);
    assert.equal(persisted.geopoint instanceof GeoPoint, true);
    assert.equal(persisted.geopoint.latitude, customer.location.lat);
    assert.equal(persisted.geopoint.longitude, customer.location.lng);
  } finally {
    Customer.setAdapter(previousAdapter);
  }
});

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

test("Customer writer replaces the exact complete document without merge", async () => {
  const harness = await loadWriterHarness();
  try {
    const writer = harness.createWriter();
    const customer = validCustomer({
      location: { lat: 35.0, lng: 139.0, formattedAddress: "東京都千代田区" },
    });
    const result = await writer.update({ companyId: "company-a", customer });

    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0].kind, "set");
    assert.equal(harness.calls[0].path, "Companies/company-a/Customers/customer-a");
    assert.equal(harness.calls[0].options, undefined);
    assert.deepEqual(
      Object.keys(harness.calls[0].data).sort(),
      [...CUSTOMER_DOCUMENT_FIELDS].sort(),
    );
    assert.equal(harness.calls[0].data.updatedAt, "SERVER_TIMESTAMP");
    assert.deepEqual(result, {
      updated: true,
      fields: [...CUSTOMER_DOCUMENT_FIELDS],
    });
  } finally {
    harness.cleanup();
  }
});

test("Later Customer whole-document saves overwrite unrelated fields", async () => {
  const harness = await loadWriterHarness();
  try {
    const writer = harness.createWriter();
    await writer.update({
      companyId: "company-a",
      customer: validCustomer({ city: "港区", paymentMonth: 1 }),
    });
    await writer.update({
      companyId: "company-a",
      customer: validCustomer({ city: "千代田区", paymentMonth: 2 }),
    });

    assert.equal(harness.calls.length, 2);
    assert.equal(harness.calls[0].data.city, "港区");
    assert.equal(harness.calls[1].data.city, "千代田区");
    assert.equal(harness.calls[1].data.paymentMonth, 2);
  } finally {
    harness.cleanup();
  }
});

test("Customer update runs beforeUpdate and complete schema validation", async () => {
  const original = Customer.prototype.beforeUpdate;
  const originalGeocoder = GeocodableMixin._geocodingFunction;
  let hooks = 0;
  GeocodableMixin.setGeocodingFunction(async () => ({
    formattedAddress: "東京都港区芝1-1",
    lat: 35.65,
    lng: 139.75,
  }));
  Customer.prototype.beforeUpdate = async function (...args) {
    hooks += 1;
    return original.apply(this, args);
  };
  try {
    const latest = validCustomer();
    const prepared = await prepareCustomerUpdate({
      latest,
      draft: validCustomer({
        name: "更新後取引先",
        city: "港区",
        address: "芝1-1",
      }),
      actorUid: "actor-b",
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    assert.equal(hooks, 1);
    assert.equal(prepared.candidate.name, "更新後取引先");
    assert.equal(prepared.candidate.fullAddress.includes("港区"), true);
    assert.deepEqual(prepared.candidate.location, {
      formattedAddress: "東京都港区芝1-1",
      lat: 35.65,
      lng: 139.75,
    });
    assert.notDeepEqual(prepared.candidate.tokenMap, latest.tokenMap);

    await assert.rejects(
      () => prepareCustomerUpdate({
        latest,
        draft: validCustomer({ paymentMonth: 99 }),
        actorUid: "actor-b",
        now: new Date(),
      }),
      (error) => error.code === "invalid-customer",
    );
  } finally {
    Customer.prototype.beforeUpdate = original;
    GeocodableMixin.setGeocodingFunction(originalGeocoder);
  }
});

test("Customer status invalid values are rejected by the complete update", async () => {
  for (const status of [null, "UNKNOWN", 1, true, {}, []]) {
    const latest = validCustomer();
    const draft = latest.toObject();
    draft.contractStatus = status;
    await assert.rejects(
      () => prepareCustomerUpdate({
        latest,
        draft,
        actorUid: "actor-a",
        now: new Date(),
      }),
      (error) => error.code === "invalid-customer",
    );
  }
});

test("Customer action dispatches the complete prepared document", async () => {
  let written = null;
  const harness = await loadCustomerActionsHarness({
    update: async (args) => {
      written = args;
      return { updated: true, fields: [...CUSTOMER_DOCUMENT_FIELDS] };
    },
  });
  try {
    const latest = validCustomer({ paymentMonth: 2 });
    const draft = validCustomer({ city: "港区", paymentMonth: 1 });
    await harness.actions.updateCustomer({ latest, draft });
    assert.equal(written.companyId, "company-a");
    assert.equal(written.customer.city, "港区");
    assert.equal(written.customer.paymentMonth, 1);
    assert.equal(written.customer.docId, latest.docId);
  } finally {
    harness.cleanup();
  }
});

test("Customer listener changes do not cause a conflict or reload rejection", async () => {
  let writes = 0;
  const harness = await loadCustomerActionsHarness({
    update: async () => {
      writes += 1;
      return { updated: true, fields: [...CUSTOMER_DOCUMENT_FIELDS] };
    },
  });
  const original = Customer.prototype.beforeUpdate;
  const latest = validCustomer();
  Customer.prototype.beforeUpdate = async () => {
    await Promise.resolve();
    latest.city = "外部更新の市";
    latest.paymentMonth = 2;
  };
  try {
    await harness.actions.updateCustomer({
      latest: () => latest,
      draft: validCustomer({ city: "入力中の市", paymentMonth: 1 }),
    });
    assert.equal(writes, 1);
    assert.equal(harness.actions.isSaving.value, false);
  } finally {
    Customer.prototype.beforeUpdate = original;
    harness.cleanup();
  }
});

for (const scenario of ["uid", "company"]) {
  test(`Customer rejects asynchronous ${scenario} changes before writer dispatch`, async () => {
    let writes = 0;
    const harness = await loadCustomerActionsHarness({
      update: async () => {
        writes += 1;
      },
    });
    const original = Customer.prototype.beforeUpdate;
    const latest = validCustomer();
    Customer.prototype.beforeUpdate = async () => {
      await Promise.resolve();
      if (scenario === "uid") harness.auth.uid = "actor-b";
      if (scenario === "company") {
        harness.auth.companyId = "company-b";
        harness.auth.user.companyId = "company-b";
      }
    };
    try {
      await assert.rejects(
        () => harness.actions.updateCustomer({
          latest,
          draft: validCustomer({ remarks: "保存待ちの合成入力" }),
        }),
        (error) => error.code === "permission-denied",
      );
      assert.equal(writes, 0);
      assert.equal(harness.actions.isSaving.value, false);
    } finally {
      Customer.prototype.beforeUpdate = original;
      harness.cleanup();
    }
  });
}

for (const scenario of ["missing", "different-doc-id"]) {
  test(`Customer rejects a latest document that becomes ${scenario} before writer dispatch`, async () => {
    let writes = 0;
    const harness = await loadCustomerActionsHarness({
      update: async () => {
        writes += 1;
      },
    });
    const original = Customer.prototype.beforeUpdate;
    let latest = validCustomer();
    Customer.prototype.beforeUpdate = async () => {
      await Promise.resolve();
      latest = scenario === "missing"
        ? null
        : validCustomer({ docId: "different-customer" });
    };
    try {
      await assert.rejects(
        () => harness.actions.updateCustomer({
          latest: () => latest,
          draft: validCustomer({ remarks: "保存待ちの合成入力" }),
        }),
        (error) =>
          error instanceof CustomerOperationError &&
          error.code === "invalid-customer",
      );
      assert.equal(writes, 0);
      assert.equal(harness.actions.isSaving.value, false);
    } finally {
      Customer.prototype.beforeUpdate = original;
      harness.cleanup();
    }
  });
}
