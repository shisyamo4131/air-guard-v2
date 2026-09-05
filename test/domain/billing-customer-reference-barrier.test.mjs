import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const COMPANY_ID = "company-a";
const ACTIVE_CUSTOMER_ID = "customer-active";
const TERMINATED_CUSTOMER_ID = "customer-terminated";
const BILLING_DATE_AT = Object.freeze({
  toDate: () => new Date("2026-09-30T00:00:00.000Z"),
});

function operationResult(overrides = {}) {
  return {
    docId: "operation-result-a",
    isBillable: true,
    customerId: ACTIVE_CUSTOMER_ID,
    siteId: "site-a",
    billingDate: "2026-09-30",
    billingDateAt: BILLING_DATE_AT,
    ...overrides,
  };
}

function billingId(doc) {
  return `${doc.customerId}_${doc.siteId}_${doc.billingDate}`;
}

function billingData(doc, operationResults = [doc]) {
  return {
    customerId: doc.customerId,
    siteId: doc.siteId,
    billingDateAt: doc.billingDateAt,
    paymentDueDateAt: new Date("2026-10-31T00:00:00.000Z"),
    status: "DRAFT",
    operationResults: operationResults.map((item) => ({ ...item })),
  };
}

function copyBilling(value) {
  if (!value) return value;
  return {
    ...value,
    operationResults: (value.operationResults ?? []).map((item) => ({
      ...item,
    })),
  };
}

function createFakeRuntime({
  billings = {},
  customers = {},
  sites = {},
  customerReadError = null,
  siteReadError = null,
  transactionCommitError = null,
  transactionAttempts = 1,
} = {}) {
  const billingStore = new Map(
    Object.entries(billings).map(([docId, value]) => [
      docId,
      copyBilling(value),
    ]),
  );
  const customerStore = new Map(Object.entries(customers));
  const siteStore = new Map(Object.entries(sites));
  const events = [];
  const logs = [];
  const removeCalls = [];

  const applyWrites = (writes) => {
    for (const write of writes) {
      if (write.kind === "delete") billingStore.delete(write.docId);
      else billingStore.set(write.docId, copyBilling(write.data));
    }
  };

  const scheduleWrite = ({ instance, kind, prefix, transaction }) => {
    const event = {
      type: `billing-${kind}`,
      path: `${prefix}Billings/${instance.docId}`,
      attempt: transaction?.attempt ?? null,
    };
    events.push(event);
    const write = {
      kind,
      docId: instance.docId,
      data: kind === "delete" ? null : copyBilling(instance),
    };
    if (transaction) transaction.writes.push(write);
    else applyWrites([write]);
  };

  class Billing {
    static STATUS = Object.freeze({ DRAFT: "DRAFT" });

    constructor() {
      this.docId = "";
      this.operationResults = [];
    }

    initialize(value = {}) {
      Object.assign(this, copyBilling(value));
    }

    async fetch({ docId, prefix, transaction } = {}) {
      events.push({
        type: "billing-read",
        path: `${prefix}Billings/${docId}`,
        attempt: transaction?.attempt ?? null,
      });
      this.docId = docId;
      const value = billingStore.get(docId);
      if (value) {
        this.initialize(value);
        this.docId = docId;
      }
      return Boolean(value);
    }

    async create({ docId, prefix, transaction } = {}) {
      this.docId = docId;
      scheduleWrite({ instance: this, kind: "create", prefix, transaction });
    }

    async update({ prefix, transaction } = {}) {
      scheduleWrite({ instance: this, kind: "update", prefix, transaction });
    }

    async delete({ prefix, transaction } = {}) {
      scheduleWrite({ instance: this, kind: "delete", prefix, transaction });
    }
  }

  class Customer {
    async fetch({ docId, prefix, transaction } = {}) {
      events.push({
        type: "customer-read",
        path: `${prefix}Customers/${docId}`,
        attempt: transaction?.attempt ?? null,
      });
      if (customerReadError) throw customerReadError;
      const value = customerStore.get(`${prefix}Customers/${docId}`);
      if (value) Object.assign(this, value);
      return Boolean(value);
    }

    getPaymentDueDateAt(value) {
      assert.equal(value instanceof Date, true);
      return new Date("2026-10-31T00:00:00.000Z");
    }
  }

  const firestore = {
    async runTransaction(callback) {
      let result;
      for (let attempt = 1; attempt <= transactionAttempts; attempt += 1) {
        const transaction = {
          attempt,
          writes: [],
          async get(reference) {
            events.push({
              type: "site-read",
              path: reference.path,
              attempt,
            });
            if (siteReadError) throw siteReadError;
            return { exists: siteStore.has(reference.path) };
          },
        };
        result = await callback(transaction);
        if (transactionCommitError) throw transactionCommitError;
        if (attempt === transactionAttempts) applyWrites(transaction.writes);
      }
      return result;
    },
    doc(path) {
      return { path };
    },
  };

  return {
    Billing,
    Customer,
    billingStore,
    events,
    firestore,
    logger: {
      info(message, metadata) {
        logs.push({ level: "info", message, metadata });
      },
      warn(message, metadata) {
        logs.push({ level: "warn", message, metadata });
      },
      error(message, metadata) {
        logs.push({ level: "error", message, metadata });
      },
    },
    logs,
    removeCalls,
    removeOperationResultFromBilling: async (args) => {
      removeCalls.push(args);
    },
  };
}

function stripImports(source) {
  return source.replace(/^import[\s\S]*?;\r?\n/gmu, "");
}

let harnessSequence = 0;

async function loadProductionBillingHarness(options = {}) {
  const runtime = createFakeRuntime(options);
  const [utilsSource, liveSiteSource, addSource, syncSource] = await Promise.all([
    readFile(new URL("../../functions/modules/billings/utils.js", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../functions/modules/sites/liveSiteReference.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../functions/modules/billings/addOperationResultToBilling.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../functions/modules/billings/syncOperationResultToBilling.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const harnessKey = `__cas03BillingHarness${harnessSequence += 1}`;
  globalThis[harnessKey] = runtime;
  const moduleSource = `
const {
  Billing,
  Customer,
  firestore,
  logger,
  removeOperationResultFromBilling,
} = globalThis[${JSON.stringify(harnessKey)}];
const getFirestore = () => firestore;
${stripImports(liveSiteSource).replaceAll(
    "CONTROL_CHARACTERS",
    "SITE_REFERENCE_CONTROL_CHARACTERS",
  )}
${stripImports(utilsSource)}
${stripImports(addSource)}
${stripImports(syncSource)}
`;
  try {
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`
    );
    return { module, runtime };
  } finally {
    delete globalThis[harnessKey];
  }
}

function customerPath(customerId, companyId = COMPANY_ID) {
  return `Companies/${companyId}/Customers/${customerId}`;
}

function sitePath(siteId, companyId = COMPANY_ID) {
  return `Companies/${companyId}/Sites/${siteId}`;
}

function writeEvents(events) {
  return events.filter((event) => event.type.startsWith("billing-") && event.type !== "billing-read");
}

const MOVE_SUCCESS_MESSAGES = new Set([
  "Deleted empty Billing",
  "Removed OperationResult from Billing",
  "Created new Billing for moved OperationResult",
  "Added OperationResult to existing Billing",
]);

function moveSuccessLogs(logs) {
  return logs.filter(
    ({ level, message }) => level === "info" && MOVE_SUCCESS_MESSAGES.has(message),
  );
}

for (const { customerId, contractStatus } of [
  { customerId: ACTIVE_CUSTOMER_ID, contractStatus: "ACTIVE" },
  { customerId: TERMINATED_CUSTOMER_ID, contractStatus: "TERMINATED" },
]) {
  test(`new Billing reads ${contractStatus} Customer and live Site in the same transaction before create`, async () => {
    const doc = operationResult({ customerId });
    const { module, runtime } = await loadProductionBillingHarness({
      customers: {
        [customerPath(customerId)]: { contractStatus },
      },
      sites: { [sitePath(doc.siteId)]: { status: "ACTIVE" } },
    });

    await module.addOperationResultToBilling({ companyId: COMPANY_ID, doc });

    assert.deepEqual(runtime.events.map(({ type }) => type), [
      "billing-read",
      "customer-read",
      "site-read",
      "billing-create",
    ]);
    assert.deepEqual(runtime.events.map(({ attempt }) => attempt), [1, 1, 1, 1]);
    assert.equal(
      runtime.events[1].path,
      `Companies/${COMPANY_ID}/Customers/${customerId}`,
    );
    assert.equal(runtime.events[2].path, sitePath(doc.siteId));
    assert.equal(runtime.billingStore.get(billingId(doc)).customerId, customerId);
  });
}

test("new Billing missing, cross-tenant-only, and Customer read failures schedule no write", async () => {
  const missingDoc = operationResult({ customerId: "customer-missing" });
  const missing = await loadProductionBillingHarness();
  await assert.rejects(() =>
    missing.module.addOperationResultToBilling({
      companyId: COMPANY_ID,
      doc: missingDoc,
    }),
  );
  assert.deepEqual(missing.runtime.events.map(({ type }) => type), [
    "billing-read",
    "customer-read",
  ]);
  assert.deepEqual(writeEvents(missing.runtime.events), []);

  const crossTenant = await loadProductionBillingHarness({
    customers: {
      [customerPath(missingDoc.customerId, "company-b")]: {
        contractStatus: "ACTIVE",
      },
    },
  });
  await assert.rejects(() =>
    crossTenant.module.addOperationResultToBilling({
      companyId: COMPANY_ID,
      doc: missingDoc,
    }),
  );
  assert.equal(
    crossTenant.runtime.events.some(({ path }) => path.includes("company-b")),
    false,
  );
  assert.deepEqual(writeEvents(crossTenant.runtime.events), []);

  const readFailure = new Error("synthetic Customer read failure");
  const failed = await loadProductionBillingHarness({
    customerReadError: readFailure,
  });
  await assert.rejects(
    () =>
      failed.module.addOperationResultToBilling({
        companyId: COMPANY_ID,
        doc: operationResult(),
      }),
    (error) => error === readFailure,
  );
  assert.deepEqual(writeEvents(failed.runtime.events), []);
});

test("new Billing missing, cross-tenant-only, and Site read failures schedule no write", async () => {
  const doc = operationResult({ siteId: "site-missing" });
  const customer = {
    [customerPath(doc.customerId)]: { contractStatus: "ACTIVE" },
  };

  const missing = await loadProductionBillingHarness({ customers: customer });
  await assert.rejects(
    () => missing.module.addOperationResultToBilling({ companyId: COMPANY_ID, doc }),
    /Site not found: site-missing/u,
  );
  assert.deepEqual(missing.runtime.events.map(({ type }) => type), [
    "billing-read",
    "customer-read",
    "site-read",
  ]);
  assert.deepEqual(writeEvents(missing.runtime.events), []);

  const crossTenant = await loadProductionBillingHarness({
    customers: customer,
    sites: { [sitePath(doc.siteId, "company-b")]: { status: "ACTIVE" } },
  });
  await assert.rejects(
    () => crossTenant.module.addOperationResultToBilling({
      companyId: COMPANY_ID,
      doc,
    }),
    /Site not found: site-missing/u,
  );
  assert.equal(
    crossTenant.runtime.events.some(({ path }) => path?.includes("company-b")),
    false,
  );
  assert.deepEqual(writeEvents(crossTenant.runtime.events), []);

  const readFailure = new Error("synthetic Site read failure");
  const failed = await loadProductionBillingHarness({
    customers: customer,
    siteReadError: readFailure,
  });
  await assert.rejects(
    () => failed.module.addOperationResultToBilling({
      companyId: COMPANY_ID,
      doc,
    }),
    (error) => error === readFailure,
  );
  assert.deepEqual(writeEvents(failed.runtime.events), []);
});

test("all Billing path inputs reject unsafe values before either writer starts a transaction", async () => {
  const unsafeValues = [
    123,
    "x".repeat(129),
    "trailing-space ",
    "nul\u0000character",
    "line\nbreak",
    "one/slash",
    "nested/collection/document",
  ];
  for (const field of ["companyId", "customerId", "siteId", "billingDate"]) {
    const fieldUnsafeValues = field === "billingDate"
      ? [...unsafeValues, "2026-9-30"]
      : unsafeValues;
    for (const unsafeValue of fieldUnsafeValues) {
      const companyId = field === "companyId" ? unsafeValue : COMPANY_ID;
      const doc = operationResult(
        field === "companyId" ? {} : { [field]: unsafeValue },
      );
      const before = operationResult({
        docId: "operation-before-path-validation",
        billingDate: "2026-08-31",
      });
      const after = {
        ...doc,
        docId: before.docId,
      };
      const { module, runtime } = await loadProductionBillingHarness();

      if (field === "companyId") {
        assert.throws(() =>
          module.assertPathSafeIdentifier(unsafeValue, field),
        );
      } else {
        assert.throws(() => module.getBillingKey(doc));
      }
      await assert.rejects(() =>
        module.addOperationResultToBilling({ companyId, doc }),
      );
      await assert.rejects(() =>
        module.syncOperationResultToBilling({ companyId, before, after }),
      );
      assert.deepEqual(runtime.events, []);
      assert.equal(runtime.billingStore.size, 0);
    }
  }
});

test("maximum safe identifiers and canonical YYYY-MM-DD produce one Billing path segment", async () => {
  const { module, runtime } = await loadProductionBillingHarness();
  const maximumIdentifier = "x".repeat(128);
  assert.doesNotThrow(() =>
    module.assertPathSafeIdentifier(maximumIdentifier, "companyId"),
  );
  for (const field of ["customerId", "siteId"]) {
    const key = module.getBillingKey(
      operationResult({ [field]: maximumIdentifier }),
    );
    assert.equal(key.includes("/"), false);
  }
  assert.equal(
    module.getBillingKey(operationResult()),
    `${ACTIVE_CUSTOMER_ID}_site-a_2026-09-30`,
  );
  assert.deepEqual(runtime.events, []);
});

test("transaction retries repeat Billing and Customer reads before scheduling create", async () => {
  const doc = operationResult();
  const { module, runtime } = await loadProductionBillingHarness({
    customers: {
      [customerPath(doc.customerId)]: { contractStatus: "ACTIVE" },
    },
    sites: { [sitePath(doc.siteId)]: { status: "ACTIVE" } },
    transactionAttempts: 2,
  });

  await module.addOperationResultToBilling({ companyId: COMPANY_ID, doc });

  assert.deepEqual(
    runtime.events.map(({ type, attempt }) => `${attempt}:${type}`),
    [
      "1:billing-read",
      "1:customer-read",
      "1:site-read",
      "1:billing-create",
      "2:billing-read",
      "2:customer-read",
      "2:site-read",
      "2:billing-create",
    ],
  );
  assert.equal(runtime.billingStore.has(billingId(doc)), true);
});

test("existing Billing add and same-document update do not extend the barrier to an unchanged orphan", async () => {
  const original = operationResult({ docId: "operation-original" });
  const added = operationResult({ docId: "operation-added" });
  const id = billingId(original);
  const addHarness = await loadProductionBillingHarness({
    billings: { [id]: billingData(original) },
  });

  await addHarness.module.addOperationResultToBilling({
    companyId: COMPANY_ID,
    doc: added,
  });
  assert.deepEqual(addHarness.runtime.events.map(({ type }) => type), [
    "billing-read",
    "billing-update",
  ]);
  assert.equal(
    addHarness.runtime.events.some(({ type }) => type === "customer-read"),
    false,
  );
  assert.deepEqual(
    addHarness.runtime.billingStore
      .get(id)
      .operationResults.map(({ docId }) => docId),
    [original.docId, added.docId],
  );

  const after = operationResult({
    docId: original.docId,
    marker: "updated-in-place",
  });
  const updateHarness = await loadProductionBillingHarness({
    billings: { [id]: billingData(original) },
  });
  await updateHarness.module.syncOperationResultToBilling({
    companyId: COMPANY_ID,
    before: original,
    after,
  });
  assert.deepEqual(updateHarness.runtime.events.map(({ type }) => type), [
    "billing-read",
    "billing-update",
  ]);
  assert.equal(
    updateHarness.runtime.events.some(({ type }) => type === "customer-read"),
    false,
  );
  assert.equal(
    updateHarness.runtime.billingStore.get(id).operationResults[0].marker,
    "updated-in-place",
  );
});

for (const { customerId, contractStatus } of [
  { customerId: ACTIVE_CUSTOMER_ID, contractStatus: "ACTIVE" },
  { customerId: TERMINATED_CUSTOMER_ID, contractStatus: "TERMINATED" },
]) {
  test(`move to absent Billing reads both Billings, ${contractStatus} Customer, and live Site before atomic writes`, async () => {
    const before = operationResult({
      docId: "operation-moving",
      customerId: "customer-source",
      billingDate: "2026-08-31",
      billingDateAt: Object.freeze({
        toDate: () => new Date("2026-08-31T00:00:00.000Z"),
      }),
    });
    const after = operationResult({
      docId: before.docId,
      customerId,
      siteId: "site-destination",
    });
    const { module, runtime } = await loadProductionBillingHarness({
      billings: { [billingId(before)]: billingData(before) },
      customers: {
        [customerPath(customerId)]: { contractStatus },
      },
      sites: { [sitePath(after.siteId)]: { status: "ACTIVE" } },
    });

    await module.syncOperationResultToBilling({
      companyId: COMPANY_ID,
      before,
      after,
    });

    assert.deepEqual(runtime.events.map(({ type }) => type), [
      "billing-read",
      "billing-read",
      "customer-read",
      "site-read",
      "billing-delete",
      "billing-create",
    ]);
    assert.equal(runtime.billingStore.has(billingId(before)), false);
    assert.equal(
      runtime.billingStore.get(billingId(after)).operationResults[0].docId,
      after.docId,
    );
  });
}

test("absent-destination move retry rereads Customer and live Site before each write attempt", async () => {
  const before = operationResult({
    docId: "operation-moving-retry",
    customerId: "customer-source",
    billingDate: "2026-08-31",
  });
  const after = operationResult({
    docId: before.docId,
    customerId: ACTIVE_CUSTOMER_ID,
    siteId: "site-retry-destination",
  });
  const sourceId = billingId(before);
  const destinationId = billingId(after);
  const { module, runtime } = await loadProductionBillingHarness({
    billings: { [sourceId]: billingData(before) },
    customers: {
      [customerPath(after.customerId)]: { contractStatus: "ACTIVE" },
    },
    sites: { [sitePath(after.siteId)]: { status: "ACTIVE" } },
    transactionAttempts: 2,
  });

  await module.syncOperationResultToBilling({
    companyId: COMPANY_ID,
    before,
    after,
  });

  assert.deepEqual(
    runtime.events.map(({ type, attempt }) => `${attempt}:${type}`),
    [
      "1:billing-read",
      "1:billing-read",
      "1:customer-read",
      "1:site-read",
      "1:billing-delete",
      "1:billing-create",
      "2:billing-read",
      "2:billing-read",
      "2:customer-read",
      "2:site-read",
      "2:billing-delete",
      "2:billing-create",
    ],
  );
  assert.equal(runtime.billingStore.has(sourceId), false);
  assert.deepEqual(
    runtime.billingStore
      .get(destinationId)
      .operationResults.map(({ docId }) => docId),
    [after.docId],
  );
  assert.deepEqual(moveSuccessLogs(runtime.logs), [
    {
      level: "info",
      message: "Deleted empty Billing",
      metadata: { docId: sourceId, billingDate: before.billingDate },
    },
    {
      level: "info",
      message: "Created new Billing for moved OperationResult",
      metadata: { docId: destinationId, billingDate: after.billingDate },
    },
  ]);
});

test("rejected absent-destination transaction commits no move and emits no success log", async () => {
  const before = operationResult({
    docId: "operation-moving-rejected-transaction",
    customerId: "customer-source",
    billingDate: "2026-08-31",
  });
  const after = operationResult({
    docId: before.docId,
    customerId: ACTIVE_CUSTOMER_ID,
    siteId: "site-rejected-destination",
  });
  const sourceId = billingId(before);
  const destinationId = billingId(after);
  const commitError = new Error("synthetic transaction rejection");
  const { module, runtime } = await loadProductionBillingHarness({
    billings: { [sourceId]: billingData(before) },
    customers: {
      [customerPath(after.customerId)]: { contractStatus: "ACTIVE" },
    },
    sites: { [sitePath(after.siteId)]: { status: "ACTIVE" } },
    transactionCommitError: commitError,
  });

  await assert.rejects(
    () =>
      module.syncOperationResultToBilling({
        companyId: COMPANY_ID,
        before,
        after,
      }),
    (error) => error === commitError,
  );

  assert.equal(runtime.billingStore.has(sourceId), true);
  assert.equal(runtime.billingStore.has(destinationId), false);
  assert.deepEqual(moveSuccessLogs(runtime.logs), []);
});

test("move to absent Billing with missing Customer schedules neither source nor destination write", async () => {
  const before = operationResult({
    docId: "operation-moving-missing",
    customerId: "customer-source",
    billingDate: "2026-08-31",
  });
  const after = operationResult({
    docId: before.docId,
    customerId: "customer-missing",
    siteId: "site-destination",
  });
  const beforeId = billingId(before);
  const { module, runtime } = await loadProductionBillingHarness({
    billings: { [beforeId]: billingData(before) },
  });

  await assert.rejects(() =>
    module.syncOperationResultToBilling({
      companyId: COMPANY_ID,
      before,
      after,
    }),
  );

  assert.deepEqual(runtime.events.map(({ type }) => type), [
    "billing-read",
    "billing-read",
    "customer-read",
  ]);
  assert.deepEqual(writeEvents(runtime.events), []);
  assert.equal(runtime.billingStore.has(beforeId), true);
  assert.equal(runtime.billingStore.has(billingId(after)), false);
});

test("move to existing orphan destination skips Customer barrier and commits both sides atomically", async () => {
  const moving = operationResult({
    docId: "operation-moving-existing",
    customerId: "customer-source",
    billingDate: "2026-08-31",
  });
  const retained = operationResult({
    docId: "operation-retained-source",
    customerId: moving.customerId,
    billingDate: moving.billingDate,
  });
  const destinationExisting = operationResult({
    docId: "operation-existing-destination",
    customerId: "customer-orphan",
    siteId: "site-destination",
  });
  const after = operationResult({
    docId: moving.docId,
    customerId: destinationExisting.customerId,
    siteId: destinationExisting.siteId,
  });
  const sourceId = billingId(moving);
  const destinationId = billingId(destinationExisting);
  const { module, runtime } = await loadProductionBillingHarness({
    billings: {
      [sourceId]: billingData(moving, [moving, retained]),
      [destinationId]: billingData(destinationExisting),
    },
  });

  await module.syncOperationResultToBilling({
    companyId: COMPANY_ID,
    before: moving,
    after,
  });

  assert.deepEqual(runtime.events.map(({ type }) => type), [
    "billing-read",
    "billing-read",
    "billing-update",
    "billing-update",
  ]);
  assert.equal(
    runtime.events.some(({ type }) => type === "customer-read"),
    false,
  );
  assert.deepEqual(
    runtime.billingStore
      .get(sourceId)
      .operationResults.map(({ docId }) => docId),
    [retained.docId],
  );
  assert.deepEqual(
    runtime.billingStore
      .get(destinationId)
      .operationResults.map(({ docId }) => docId),
    [destinationExisting.docId, after.docId],
  );
});

test("non-billable, no-op, and remove-only paths do not invoke the new-reference barrier", async () => {
  const addHarness = await loadProductionBillingHarness();
  await addHarness.module.addOperationResultToBilling({
    companyId: "path/is-not-evaluated-for-no-op",
    doc: operationResult({ isBillable: false }),
  });
  assert.deepEqual(addHarness.runtime.events, []);

  const noOpHarness = await loadProductionBillingHarness();
  await noOpHarness.module.syncOperationResultToBilling({
    companyId: COMPANY_ID,
    before: operationResult({ isBillable: false }),
    after: operationResult({ isBillable: false }),
  });
  assert.deepEqual(noOpHarness.runtime.events, []);
  assert.deepEqual(noOpHarness.runtime.removeCalls, []);

  const removeHarness = await loadProductionBillingHarness();
  const before = operationResult();
  const after = operationResult({ isBillable: false });
  await removeHarness.module.syncOperationResultToBilling({
    companyId: COMPANY_ID,
    before,
    after,
  });
  assert.deepEqual(removeHarness.runtime.events, []);
  assert.deepEqual(removeHarness.runtime.removeCalls, [
    { companyId: COMPANY_ID, operationResult: before },
  ]);
});
