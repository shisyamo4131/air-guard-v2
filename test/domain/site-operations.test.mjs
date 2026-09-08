import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Customer, Site } from "../../schemas/index.js";
import { SITE_DOCUMENT_FIELDS } from "../../utils/site/siteDocumentContract.js";
import {
  SITE_CUSTOMER_PROJECTION_FIELDS,
  createSiteCustomerProjection,
} from "../../utils/site/siteCustomerProjection.js";
import {
  SITE_AGREEMENT_FIELDS,
  SITE_BASIC_FIELDS,
  SITE_CREATE_FIELDS,
  SITE_CUSTOMER_FIELDS,
  SITE_OPERATION,
  SiteOperationError,
  changedSiteFields,
  cloneSiteValue,
  conflictingSiteFields,
  getSiteOperationErrorMessage,
  prepareSiteCreate,
  prepareSiteUpdate,
  siteOperationFields,
  siteSnapshot,
  validateSiteCandidate,
} from "../../composables/domain/site/siteOperations.js";
import { siteAgreementsHaveZeroPrice } from "../../composables/domain/site/siteAgreementContract.js";

function validCustomer(overrides = {}) {
  return new Customer({
    docId: "customer-a",
    uid: "customer-actor",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    code: "C001",
    name: "合成取引先",
    branchName: null,
    abbreviation: "合成取引先",
    nameKana: "ゴウセイトリヒキサキ",
    zipcode: "1000001",
    prefCode: "13",
    city: "千代田区",
    address: "千代田1-1",
    building: null,
    location: null,
    tel: null,
    fax: null,
    contractStatus: Customer.STATUS_ACTIVE,
    cutoffDate: 0,
    paymentMonth: 1,
    paymentDate: 0,
    remarks: null,
    ...overrides,
  });
}

function validSite(overrides = {}) {
  return new Site({
    docId: "site-a",
    uid: "actor-a",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    customerId: null,
    customer: null,
    customerName: "合成仮取引先",
    code: "S001",
    name: "合成現場",
    hasAbbreviation: false,
    abbreviation: null,
    nameKana: "ゴウセイゲンバ",
    zipcode: null,
    prefCode: "13",
    city: "千代田区",
    address: "千代田1-1",
    building: null,
    securityType: "TRAFFIC",
    siteNumber: null,
    constructionPeriodStartAt: null,
    constructionPeriodEndAt: null,
    location: null,
    remarks: null,
    agreementsV2: [],
    status: Site.STATUS_ACTIVE,
    ...overrides,
  });
}

function validAgreement(overrides = {}) {
  return {
    dateAt: new Date("2026-04-01T00:00:00.000Z"),
    shiftType: "DAY",
    startTime: "08:00",
    endTime: "17:00",
    isStartNextDay: false,
    breakMinutes: 60,
    regulationWorkMinutes: 480,
    rates: Object.fromEntries(["WEEKDAY", "SATURDAY", "SUNDAY", "HOLIDAY"].map((day) => [
      day,
      {
        unitPriceBase: 1000,
        overtimeUnitPriceBase: 1000,
        unitPriceQualified: 1000,
        overtimeUnitPriceQualified: 1000,
      },
    ])),
    billingUnitType: "PER_DAY",
    includeBreakInBilling: false,
    cutoffDate: 0,
    ...overrides,
  };
}

test("Site operations own exact create, basic, Customer, and Agreement fields", () => {
  assert.deepEqual(siteOperationFields(SITE_OPERATION.CREATE), SITE_CREATE_FIELDS);
  assert.deepEqual(siteOperationFields(SITE_OPERATION.UPDATE_BASIC), SITE_BASIC_FIELDS);
  assert.deepEqual(siteOperationFields(SITE_OPERATION.UPDATE_CUSTOMER), SITE_CUSTOMER_FIELDS);
  assert.deepEqual(siteOperationFields(SITE_OPERATION.UPDATE_AGREEMENTS), SITE_AGREEMENT_FIELDS);
  assert.equal(SITE_BASIC_FIELDS.includes("status"), false);
  assert.equal(SITE_BASIC_FIELDS.includes("customerId"), false);
  assert.equal(SITE_CUSTOMER_FIELDS.includes("customerName"), false);
  assert.equal(SITE_AGREEMENT_FIELDS.includes("agreementsV2"), true);
  assert.throws(
    () => siteOperationFields("TERMINATE"),
    (error) => error instanceof SiteOperationError && error.code === "invalid-operation",
  );
});

test("Site validation enforces shared required, type, enum, length, and date boundaries", () => {
  for (const [field, value] of [
    ["name", null],
    ["name", ""],
    ["name", "現".repeat(41)],
    ["nameKana", null],
    ["nameKana", "カ".repeat(61)],
    ["prefCode", null],
    ["prefCode", "48"],
    ["city", null],
    ["city", "市".repeat(21)],
    ["address", null],
    ["address", "番".repeat(31)],
    ["building", "建".repeat(31)],
    ["code", "A".repeat(11)],
    ["siteNumber", "N".repeat(41)],
    ["hasAbbreviation", "false"],
    ["securityType", "UNKNOWN"],
    ["status", "UNKNOWN"],
    ["agreementsV2", {}],
  ]) {
    assert.throws(
      () => validateSiteCandidate(validSite({ [field]: value })),
      (error) => error instanceof SiteOperationError && error.code === "invalid-site",
      `${field}=${String(value)}`,
    );
  }
  assert.throws(
    () => validateSiteCandidate(validSite({ hasAbbreviation: true, abbreviation: null })),
    (error) => error.code === "invalid-site",
  );
  assert.throws(
    () => validateSiteCandidate(validSite({ customerId: null, customerName: null })),
    (error) => error.code === "invalid-site",
  );
  assert.throws(
    () => validateSiteCandidate(validSite({
      constructionPeriodStartAt: new Date("2026-02-02T00:00:00.000Z"),
      constructionPeriodEndAt: new Date("2026-02-01T00:00:00.000Z"),
    })),
    (error) => error.code === "invalid-site",
  );
});

test("Site validation does not invent a zipcode limit absent from the canonical schema", () => {
  const site = validSite({
    zipcode: "1".repeat(200),
    remarks: "合".repeat(200),
  });
  assert.equal(validateSiteCandidate(site), site);
});

test("Site create fixes ACTIVE, empty Agreements, generated identity, and keeps customerName", async () => {
  const now = new Date("2026-02-01T00:00:00.000Z");
  const candidate = await prepareSiteCreate({
    draft: validSite({
      docId: "spoofed",
      uid: "spoofed",
      createdAt: null,
      updatedAt: null,
      status: Site.STATUS_TERMINATED,
      agreementsV2: [{ key: "spoofed" }],
      customerName: "入力時の取引先名",
    }),
    docId: "created-site",
    actorUid: "actor-b",
    now,
  });
  assert.equal(candidate.docId, "created-site");
  assert.equal(candidate.uid, "actor-b");
  assert.equal(candidate.createdAt, now);
  assert.equal(candidate.updatedAt, now);
  assert.equal(candidate.status, Site.STATUS_ACTIVE);
  assert.deepEqual(candidate.agreementsV2, []);
  assert.equal(candidate.customerName, "入力時の取引先名");
});

test("Site basic update preserves latest Customer, status, and unrelated fields", () => {
  const baseline = validSite();
  const customer = validCustomer({ docId: "customer-b", name: "外部更新取引先" });
  const latest = validSite({
    customerId: customer.docId,
    customer,
    customerName: "入力時の取引先名",
    agreementsV2: [{ key: "agreement-external" }],
    status: Site.STATUS_TERMINATED,
  });
  const draft = validSite({ city: "港区", status: Site.STATUS_ACTIVE });
  const prepared = prepareSiteUpdate({
    operation: SITE_OPERATION.UPDATE_BASIC,
    latest,
    baseline: siteSnapshot(baseline, SITE_OPERATION.UPDATE_BASIC),
    draft,
    actorUid: "actor-b",
    now: new Date("2026-02-02T00:00:00.000Z"),
    customer,
    location: null,
  });
  assert.deepEqual(prepared.fields, ["city"]);
  assert.equal(prepared.candidate.customerId, "customer-b");
  assert.equal(prepared.candidate.customer.name, "外部更新取引先");
  assert.equal(prepared.candidate.customerName, "入力時の取引先名");
  assert.deepEqual(
    prepared.candidate.agreementsV2.map((agreement) => agreement.toObject()),
    latest.agreementsV2.map((agreement) => agreement.toObject()),
  );
  assert.equal(prepared.candidate.status, Site.STATUS_TERMINATED);
});

test("Site update rejects same-field conflicts but ignores untouched operation fields", () => {
  const baseline = validSite();
  const draft = validSite({ city: "入力中の市" });
  assert.deepEqual(conflictingSiteFields({
    operation: SITE_OPERATION.UPDATE_BASIC,
    baseline: siteSnapshot(baseline, SITE_OPERATION.UPDATE_BASIC),
    latest: validSite({ city: "外部更新の市" }),
    draft,
  }), ["city"]);
  assert.throws(
    () => prepareSiteUpdate({
      operation: SITE_OPERATION.UPDATE_BASIC,
      latest: validSite({ city: "外部更新の市" }),
      baseline: siteSnapshot(baseline, SITE_OPERATION.UPDATE_BASIC),
      draft,
      actorUid: "actor-a",
      now: new Date(),
    }),
    (error) => error instanceof SiteOperationError && error.code === "conflict",
  );
  assert.deepEqual(conflictingSiteFields({
    operation: SITE_OPERATION.UPDATE_BASIC,
    baseline: siteSnapshot(baseline, SITE_OPERATION.UPDATE_BASIC),
    latest: validSite({ customerName: "別操作の外部変更" }),
    draft,
  }), []);
});

test("Site no-op reports no changed fields and does not alter metadata", () => {
  const latest = validSite();
  const prepared = prepareSiteUpdate({
    operation: SITE_OPERATION.UPDATE_BASIC,
    latest,
    baseline: siteSnapshot(latest, SITE_OPERATION.UPDATE_BASIC),
    draft: latest.clone(),
    actorUid: "actor-b",
    now: new Date("2026-02-02T00:00:00.000Z"),
  });
  assert.deepEqual(changedSiteFields({
    operation: SITE_OPERATION.UPDATE_BASIC,
    baseline: siteSnapshot(latest, SITE_OPERATION.UPDATE_BASIC),
    draft: latest.clone(),
  }), []);
  assert.deepEqual(prepared.fields, []);
  assert.equal(prepared.candidate.uid, latest.uid);
  assert.equal(prepared.candidate.updatedAt.getTime(), latest.updatedAt.getTime());
});

test("Site Customer assignment requires the referenced snapshot and retains customerName", () => {
  const latest = validSite({ customerName: "入力時の取引先名" });
  const draft = latest.clone();
  draft.customerId = "customer-a";
  assert.throws(
    () => prepareSiteUpdate({
      operation: SITE_OPERATION.UPDATE_CUSTOMER,
      latest,
      baseline: siteSnapshot(latest, SITE_OPERATION.UPDATE_CUSTOMER),
      draft,
      actorUid: "actor-a",
      now: new Date(),
      customer: null,
    }),
    (error) => error.code === "invalid-customer",
  );
  const customer = validCustomer();
  const prepared = prepareSiteUpdate({
    operation: SITE_OPERATION.UPDATE_CUSTOMER,
    latest,
    baseline: siteSnapshot(latest, SITE_OPERATION.UPDATE_CUSTOMER),
    draft,
    actorUid: "actor-a",
    now: new Date(),
    customer,
  });
  assert.deepEqual(prepared.fields, ["customerId"]);
  assert.equal(prepared.candidate.customer, customer);
  assert.equal(prepared.candidate.customerName, "入力時の取引先名");
});

async function loadWriterHarness() {
  const source = await readFile(
    new URL("../../utils/site/siteWriter.js", import.meta.url),
    "utf8",
  );
  const calls = [];
  const snapshots = new Map();
  class GeoPoint {
    constructor(latitude, longitude) {
      this.latitude = latitude;
      this.longitude = longitude;
    }
  }
  const firestore = { name: "FIRESTORE" };
  const transaction = {
    get: async (reference) => ({
      exists: () => snapshots.has(reference.path),
      data: () => snapshots.get(reference.path),
    }),
    set: (reference, data) => calls.push({ kind: "set", path: reference.path, data }),
    update: (reference, data) => calls.push({ kind: "update", path: reference.path, data }),
  };
  Site.setAdapter({ GeoPoint });
  globalThis.__siteWriterHarness = {
    Customer,
    Site,
    SITE_ADDRESS_FIELDS: ["prefCode", "city", "address"],
    SITE_CONSTRUCTION_FIELDS: ["constructionPeriodStartAt", "constructionPeriodEndAt"],
    SITE_DISPLAY_NAME_FIELDS: ["name", "hasAbbreviation", "abbreviation"],
    SITE_CUSTOMER_PROJECTION_FIELDS,
    SITE_DOCUMENT_FIELDS,
    SITE_OPERATION,
    SITE_TOKEN_FIELDS: ["name", "nameKana"],
    SiteOperationError,
    changedSiteFields,
    createSiteCustomerProjection,
    collection: (...segments) => ({ path: segments.slice(1).join("/") }),
    doc: (parent, id) => ({ id: id ?? "reserved-site", path: `${parent.path}/${id ?? "reserved-site"}` }),
    prepareSiteUpdate,
    runTransaction: async (_firestore, callback) => callback(transaction),
    serverTimestamp: () => "SERVER_TIMESTAMP",
    setDoc: async (reference, data) => calls.push({ kind: "set", path: reference.path, data }),
  };
  const executable = source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
  const moduleSource = `
    const {
      Customer, Site, SITE_ADDRESS_FIELDS, SITE_CONSTRUCTION_FIELDS,
      SITE_CUSTOMER_PROJECTION_FIELDS,
      SITE_DISPLAY_NAME_FIELDS, SITE_DOCUMENT_FIELDS, SITE_OPERATION,
      SITE_TOKEN_FIELDS, SiteOperationError, changedSiteFields, collection,
      createSiteCustomerProjection, doc, prepareSiteUpdate, runTransaction,
      serverTimestamp, setDoc
    } = globalThis.__siteWriterHarness;
    ${executable}
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`,
  );
  return {
    calls,
    snapshots,
    writer: module.createSiteWriter({ firestore }),
    cleanup: () => {
      delete globalThis.__siteWriterHarness;
    },
  };
}

test("Site writer sends exact canonical create fields with server timestamps", async () => {
  const harness = await loadWriterHarness();
  try {
    const reference = harness.writer.reserveDocument("company-a");
    await harness.writer.create({
      documentReference: reference,
      companyId: "company-a",
      site: validSite({ docId: reference.id }),
      assertCanWrite: () => undefined,
    });
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0].kind, "set");
    assert.deepEqual(Object.keys(harness.calls[0].data).sort(), [...SITE_DOCUMENT_FIELDS].sort());
    assert.equal(harness.calls[0].data.createdAt, "SERVER_TIMESTAMP");
    assert.equal(harness.calls[0].data.updatedAt, "SERVER_TIMESTAMP");
  } finally {
    harness.cleanup();
  }
});

test("Site writer embeds the exact bounded Customer projection on create and convergence update", async () => {
  const harness = await loadWriterHarness();
  try {
    assert.deepEqual(SITE_CUSTOMER_PROJECTION_FIELDS, [
      "docId",
      "updatedAt",
      "code",
      "name",
      "abbreviation",
      "cutoffDate",
    ]);
    const customer = validCustomer({
      location: { lat: 35.681236, lng: 139.767125 },
    });
    const rawCustomer = Customer.converter().toFirestore(customer);
    rawCustomer.futureCustomerField = { version: 2 };
    rawCustomer.tokenMap = Object.fromEntries(
      Array.from({ length: 1200 }, (_, index) => [`token-${index}`, true]),
    );
    const expectedProjection = createSiteCustomerProjection(rawCustomer);
    assert.equal(Object.hasOwn(rawCustomer, "geopoint"), true);
    assert.equal(rawCustomer.branchName, null);
    harness.snapshots.set(
      "Companies/company-a/Customers/customer-a",
      rawCustomer,
    );
    const reference = harness.writer.reserveDocument("company-a");
    await harness.writer.create({
      documentReference: reference,
      companyId: "company-a",
      site: validSite({
        docId: reference.id,
        customerId: customer.docId,
        customer,
      }),
      assertCanWrite: () => undefined,
    });
    const embedded = harness.calls.find((call) => call.kind === "set")?.data.customer;
    assert.ok(embedded);
    assert.deepEqual(Object.keys(embedded), [...SITE_CUSTOMER_PROJECTION_FIELDS]);
    assert.equal(Object.hasOwn(embedded, "geopoint"), false);
    assert.equal(Object.hasOwn(embedded, "tokenMap"), false);
    assert.equal(Object.hasOwn(embedded, "futureCustomerField"), false);
    assert.deepEqual(embedded, expectedProjection);

    harness.calls.length = 0;
    const legacyCustomer = { ...rawCustomer };
    const latest = validSite({
      customerId: customer.docId,
      customer: legacyCustomer,
    });
    harness.snapshots.set(
      "Companies/company-a/Sites/site-a",
      latest.toObject(),
    );
    const draft = latest.clone();
    draft.remarks = "converge embedded Customer";
    await harness.writer.update({
      companyId: "company-a",
      operation: SITE_OPERATION.UPDATE_BASIC,
      docId: "site-a",
      baseline: siteSnapshot(latest, SITE_OPERATION.UPDATE_BASIC),
      draft,
      actorUid: "actor-b",
      assertCanWrite: () => undefined,
    });
    assert.deepEqual(harness.calls[0].data.customer, expectedProjection);
    assert.equal(Object.hasOwn(harness.calls[0].data.customer, "geopoint"), false);
    assert.equal(Object.hasOwn(harness.calls[0].data.customer, "tokenMap"), false);
    assert.equal(Object.hasOwn(harness.calls[0].data.customer, "futureCustomerField"), false);
  } finally {
    harness.cleanup();
  }
});

test("Site writer patches only owned and required derived fields and skips no-op", async () => {
  const harness = await loadWriterHarness();
  try {
    const latest = validSite();
    const path = "Companies/company-a/Sites/site-a";
    harness.snapshots.set(path, latest.toObject());
    const baseline = siteSnapshot(latest, SITE_OPERATION.UPDATE_BASIC);
    const draft = latest.clone();
    draft.name = "変更後現場";
    draft.city = "港区";
    const result = await harness.writer.update({
      companyId: "company-a",
      operation: SITE_OPERATION.UPDATE_BASIC,
      docId: "site-a",
      baseline,
      draft,
      actorUid: "actor-b",
      location: { formattedAddress: "東京都港区", lat: 35, lng: 139 },
      assertCanWrite: () => undefined,
    });
    assert.equal(result.updated, true);
    assert.deepEqual(Object.keys(harness.calls[0].data).sort(), [
      "city", "customer", "displayName", "fullAddress", "geopoint", "location",
      "name", "prefecture", "tokenMap", "uid", "updatedAt",
    ].sort());
    assert.equal(harness.calls[0].data.uid, "actor-b");
    assert.equal(harness.calls[0].data.updatedAt, "SERVER_TIMESTAMP");

    harness.calls.length = 0;
    const unchanged = await harness.writer.update({
      companyId: "company-a",
      operation: SITE_OPERATION.UPDATE_BASIC,
      docId: "site-a",
      baseline,
      draft: latest.clone(),
      actorUid: "actor-b",
      assertCanWrite: () => undefined,
    });
    assert.equal(unchanged.updated, false);
    assert.deepEqual(harness.calls, []);
  } finally {
    harness.cleanup();
  }
});

test("Site writer updates raw legacy maps without backfilling unrelated missing fields", async () => {
  const harness = await loadWriterHarness();
  try {
    const customer = Customer.converter().toFirestore(validCustomer());
    customer.futureCustomerField = { version: 2 };
    const raw = Site.converter().toFirestore(validSite({
      customerId: "customer-a",
      customer: validCustomer(),
    }));
    raw.customer = customer;
    const missingFields = [
      "hasAbbreviation", "abbreviation", "displayName", "siteNumber",
      "constructionPeriodStartAt", "constructionPeriodEndAt",
      "hasConstructionPeriodStartAt", "hasConstructionPeriodEndAt",
    ];
    for (const field of missingFields) delete raw[field];
    harness.snapshots.set("Companies/company-a/Sites/site-a", raw);
    harness.snapshots.set("Companies/company-a/Customers/customer-a", customer);
    const cases = [
      [{ remarks: "legacy remarks" }, ["remarks"]],
      [{ name: "改称現場" }, ["name", "displayName", "tokenMap"]],
      [{ hasAbbreviation: true, abbreviation: "略称" }, ["hasAbbreviation", "abbreviation", "displayName"]],
      [{ constructionPeriodStartAt: new Date("2026-09-01T00:00:00.000Z") }, [
        "constructionPeriodStartAt", "hasConstructionPeriod",
        "hasConstructionPeriodStartAt", "hasConstructionPeriodEndAt",
      ]],
      [{ siteNumber: "legacy-number" }, ["siteNumber"]],
      [{}, []],
    ];
    for (const [input, expectedFields] of cases) {
      harness.calls.length = 0;
      const latest = new Site(raw);
      const draft = latest.clone();
      for (const [field, value] of Object.entries(input)) draft[field] = value;
      const result = await harness.writer.update({
        companyId: "company-a",
        operation: SITE_OPERATION.UPDATE_BASIC,
        docId: "site-a",
        baseline: siteSnapshot(latest, SITE_OPERATION.UPDATE_BASIC),
        draft,
        actorUid: "actor-b",
        assertCanWrite: () => undefined,
      });
      if (!expectedFields.length) {
        assert.equal(result.updated, false);
        assert.deepEqual(harness.calls, []);
        continue;
      }
      assert.equal(harness.calls.length, 1);
      assert.equal(harness.calls[0].kind, "update");
      const patch = harness.calls[0].data;
      assert.deepEqual(Object.keys(patch).sort(), [
        ...expectedFields, "customer", "uid", "updatedAt",
      ].sort());
      assert.deepEqual(patch.customer, createSiteCustomerProjection(customer));
      for (const field of missingFields) assert.equal(Object.hasOwn(raw, field), false);
    }
  } finally {
    harness.cleanup();
  }
});

test("Site Agreement updates use the dedicated Callable rather than the generic writer", async () => {
  const [actions, writer] = await Promise.all([
    readFile(new URL("../../composables/application/site/useSiteActions.js", import.meta.url), "utf8"),
    readFile(new URL("../../utils/site/siteWriter.js", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /createSiteAgreementUpdateRequest\([\s\S]*?baselineAgreements:[\s\S]*?candidateAgreements:/u);
  assert.match(actions, /await siteFunctions\.updateSiteAgreements\(request\)/u);
  assert.match(actions, /fields: response\.updated \? \["agreementsV2"\] : \[\]/u);
  assert.doesNotMatch(writer, /updateAgreements/u);
});

async function loadBaseEditorHarness({ updateBasic }) {
  const source = await readFile(
    new URL("../../components/Site/Editor/Base.vue", import.meta.url),
    "utf8",
  );
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  const site = validSite();
  let watchHandler;
  const isSaving = { value: false };
  globalThis.__siteBaseEditorHarness = {
    Site,
    SITE_OPERATION,
    conflictingSiteFields,
    defineProps: () => ({ site, title: "現場基本情報の編集" }),
    getSiteOperationErrorMessage: (error, fallback) => error instanceof SiteOperationError ? error.message : fallback,
    ref: (value) => ({ value }),
    siteOperationSchema: () => [],
    siteSnapshot,
    useSiteActions: () => ({ canWrite: { value: true }, isSaving, updateBasic }),
    watch: (_source, handler) => { watchHandler = handler; },
  };
  const executable = script.replace(/^import[\s\S]*?;\r?\n/gmu, "");
  const moduleSource = `
    const {
      Site, SITE_OPERATION, conflictingSiteFields, defineProps,
      getSiteOperationErrorMessage, ref, siteOperationSchema, siteSnapshot,
      useSiteActions, watch
    } = globalThis.__siteBaseEditorHarness;
    ${executable}
    export { baseline, conflictFields, dialog, draft, errorMessage, open,
      reloadLatest, save, updateProperties };
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`,
  );
  return {
    isSaving,
    module,
    site,
    triggerWatch: () => watchHandler?.(),
    cleanup: () => delete globalThis.__siteBaseEditorHarness,
  };
}

async function loadAgreementEditorHarness({ updateAgreements }) {
  const source = await readFile(
    new URL("../../components/Site/Editor/Agreements.vue", import.meta.url),
    "utf8",
  );
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  const site = validSite({ agreementsV2: [validAgreement()] });
  const isSaving = { value: false };
  let beforeUnmount;
  globalThis.__siteAgreementEditorHarness = {
    Site,
    SITE_OPERATION,
    SiteOperationError,
    cloneSiteValue,
    conflictingSiteFields,
    defineProps: () => ({ site }),
    getSiteOperationErrorMessage,
    isSaving,
    onBeforeUnmount: (callback) => { beforeUnmount = callback; },
    ref: (value) => ({ value }),
    siteAgreementsHaveZeroPrice,
    siteSnapshot,
    updateAgreements,
    useSiteActions: () => ({ canWrite: { value: true }, isSaving, updateAgreements }),
  };
  const executable = script.replace(/^import[\s\S]*?;\r?\n/gmu, "");
  const moduleSource = `
    const {
      Site, SITE_OPERATION, SiteOperationError, cloneSiteValue,
      conflictingSiteFields, defineProps, getSiteOperationErrorMessage, ref, onBeforeUnmount,
      siteAgreementsHaveZeroPrice,
      siteSnapshot, useSiteActions
    } = globalThis.__siteAgreementEditorHarness;
    ${executable}
    export { baseline, close, confirmZeroPrices, createAgreement, deleteAgreement, dialog, draft,
      draftRevision, finishZeroPriceConfirmation, hasConflict, open, persist, refreshConflict,
      reloadLatest, updateAgreement, zeroPriceDialog };
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`,
  );
  return {
    isSaving,
    module,
    site,
    unmount: () => beforeUnmount?.(),
    cleanup: () => delete globalThis.__siteAgreementEditorHarness,
  };
}

test("Site editor keeps live model unchanged, blocks double submit, and retries a failed save", async () => {
  let calls = 0;
  let releaseFirst;
  let rejectFirst;
  const firstPending = new Promise((resolve, reject) => {
    releaseFirst = resolve;
    rejectFirst = reject;
  });
  let mounted;
  mounted = await loadBaseEditorHarness({
    updateBasic: async () => {
      calls += 1;
      mounted.isSaving.value = true;
      try {
        if (calls === 1) return await firstPending;
        return "saved";
      } finally {
        mounted.isSaving.value = false;
      }
    },
  });
  try {
    mounted.module.open();
    mounted.module.updateProperties({ city: "入力中の市" });
    assert.equal(mounted.site.city, "千代田区", "live subscribed model must remain unchanged");
    const firstSave = mounted.module.save();
    await Promise.resolve();
    await mounted.module.save();
    assert.equal(calls, 1, "a second submit while pending must not call the writer");
    rejectFirst(new Error("FirebaseError: secret/path permission denied"));
    await firstSave;
    assert.equal(mounted.module.dialog.value, true);
    assert.equal(mounted.module.draft.value.city, "入力中の市");
    assert.equal(mounted.isSaving.value, false);
    assert.doesNotMatch(mounted.module.errorMessage.value, /FirebaseError|secret\/path/u);
    await mounted.module.save();
    assert.equal(calls, 2);
    assert.equal(mounted.module.dialog.value, false);
    releaseFirst?.();
  } finally {
    mounted.cleanup();
  }
});

test("Site editor preserves its draft and requires reload after a same-field external update", async () => {
  let calls = 0;
  const mounted = await loadBaseEditorHarness({ updateBasic: async () => { calls += 1; } });
  try {
    mounted.module.open();
    mounted.module.updateProperties({ city: "入力中の市" });
    mounted.site.city = "外部更新の市";
    mounted.triggerWatch();
    assert.deepEqual(mounted.module.conflictFields.value, ["city"]);
    assert.equal(mounted.module.draft.value.city, "入力中の市");
    await mounted.module.save();
    assert.equal(calls, 0);
    mounted.module.reloadLatest();
    assert.equal(mounted.module.draft.value.city, "外部更新の市");
    assert.deepEqual(mounted.module.conflictFields.value, []);
  } finally {
    mounted.cleanup();
  }
});

test("Site Agreement editor safely preserves, retries, conflicts, and reloads only explicitly", async () => {
  let calls = 0;
  let mounted;
  mounted = await loadAgreementEditorHarness({
    updateAgreements: async ({ latest, baseline, agreements }) => {
      calls += 1;
      assert.equal(latest(), mounted.site);
      assert.deepEqual(baseline, siteSnapshot(mounted.site, SITE_OPERATION.UPDATE_AGREEMENTS));
      if (calls === 1) {
        throw new Error("FirebaseError: secret/path synthetic write failure");
      }
      return {
        updated: true,
        candidate: validSite({ agreementsV2: agreements }),
      };
    },
  });
  try {
    const liveBefore = mounted.site.toObject();
    mounted.module.open();
    assert.equal(mounted.module.dialog.value, true);
    assert.notEqual(mounted.module.draft.value, mounted.site.agreementsV2);
    assert.notEqual(mounted.module.draft.value[0], mounted.site.agreementsV2[0]);
    assert.deepEqual(
      mounted.module.baseline.value,
      siteSnapshot(mounted.site, SITE_OPERATION.UPDATE_AGREEMENTS),
    );

    const added = validAgreement({
      dateAt: new Date("2026-04-02T00:00:00.000Z"),
      cutoffDate: 5,
    });
    await assert.rejects(
      () => mounted.module.createAgreement(added),
      (error) => {
        assert.match(error.message, /取極めを保存できませんでした/u);
        assert.doesNotMatch(error.message, /FirebaseError|secret\/path/u);
        return true;
      },
    );
    assert.equal(mounted.module.dialog.value, true);
    assert.equal(mounted.module.draft.value.length, 1);
    assert.deepEqual(mounted.site.toObject(), liveBefore);

    await mounted.module.createAgreement(added);
    assert.equal(calls, 2);
    assert.equal(mounted.module.draft.value.length, 2);
    assert.deepEqual(mounted.site.toObject(), liveBefore);

    const revisionBeforeConflict = mounted.module.draftRevision.value;
    mounted.site.agreementsV2 = [validAgreement({ cutoffDate: 10 })];
    await assert.rejects(
      () => mounted.module.createAgreement(validAgreement({
        dateAt: new Date("2026-04-03T00:00:00.000Z"),
        cutoffDate: 15,
      })),
      /最新値を読み直してください/u,
    );
    assert.equal(calls, 2, "preflight conflict must not call the writer");
    assert.equal(mounted.module.hasConflict.value, true);
    assert.equal(mounted.module.draft.value.length, 2, "conflict must preserve the draft");
    assert.equal(mounted.module.draftRevision.value, revisionBeforeConflict);

    mounted.module.reloadLatest();
    assert.equal(mounted.module.hasConflict.value, false);
    assert.equal(mounted.module.draft.value.length, 1);
    assert.equal(mounted.module.draft.value[0].cutoffDate, 10);
    assert.equal(mounted.module.draftRevision.value, revisionBeforeConflict + 1);
  } finally {
    mounted.cleanup();
  }
});

test("Site Agreement zero-price confirmation is single-flight and cancel or unmount preserves the draft", async () => {
  let writes = 0;
  const mounted = await loadAgreementEditorHarness({
    updateAgreements: async ({ agreements }) => {
      writes += 1;
      return { updated: true, candidate: validSite({ agreementsV2: agreements }) };
    },
  });
  const zeroRates = Object.fromEntries(["WEEKDAY", "SATURDAY", "SUNDAY", "HOLIDAY"].map((day) => [
    day,
    {
      unitPriceBase: 0,
      overtimeUnitPriceBase: 0,
      unitPriceQualified: 0,
      overtimeUnitPriceQualified: 0,
    },
  ]));
  const zeroAgreement = (day) => validAgreement({
    dateAt: new Date(`2026-04-${day}T00:00:00.000Z`),
    rates: zeroRates,
  });
  try {
    mounted.module.open();
    const cancelled = mounted.module.createAgreement(zeroAgreement("02"));
    assert.equal(mounted.module.zeroPriceDialog.value, true);
    await assert.rejects(
      mounted.module.createAgreement(zeroAgreement("03")),
      (error) => error instanceof SiteOperationError && error.code === "operation-in-progress",
    );
    assert.equal(writes, 0);
    mounted.module.finishZeroPriceConfirmation(false);
    await assert.rejects(cancelled, (error) => error.code === "save-cancelled");
    assert.equal(mounted.module.draft.value.length, 1);

    const unmounted = mounted.module.createAgreement(zeroAgreement("04"));
    mounted.unmount();
    await assert.rejects(unmounted, (error) => error.code === "save-cancelled");
    assert.equal(writes, 0);

    const retried = mounted.module.createAgreement(zeroAgreement("05"));
    mounted.module.finishZeroPriceConfirmation(true);
    await retried;
    assert.equal(writes, 1);
    assert.equal(mounted.module.draft.value.length, 2);
  } finally {
    mounted.cleanup();
  }
});
