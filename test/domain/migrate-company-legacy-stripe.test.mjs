import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CODEX_STRIPE_MIGRATION_TARGET,
  applyCompanyLegacyStripeMigration,
  assertCodexStripeMigrationTarget,
  canonicalizeFirestoreValue,
  createCompanyLegacyStripeBackup,
  inspectStripeMigrationRepositoryPreconditions,
  parseCompanyLegacyStripeArgs,
  planCompanyLegacyStripeMigration,
  readCompanyLegacyStripeBackup,
  readCompanyLegacyStripeState,
  restoreCompanyLegacyStripeMigration,
  summarizeCompanyLegacyStripePlan,
  verifyCompanyLegacyStripePostState,
} from "../../scripts/migrate-company-legacy-stripe.mjs";

class TestTimestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toMillis() {
    return this.seconds * 1000 + this.nanoseconds / 1_000_000;
  }
}

function company(id = "COMPANY_SECRET_A", overrides = {}) {
  return {
    path: `Companies/${id}`,
    updateTime: new TestTimestamp(100, 1),
    data: {
      companyName: "Synthetic company",
      nested: { enabled: true },
      ...overrides,
    },
  };
}

function stripeData(id = "SESSION_SECRET_A", overrides = {}) {
  return {
    path: `Companies/COMPANY_SECRET_A/StripeData/${id}`,
    updateTime: new TestTimestamp(101, 2),
    data: {
      price: "price_sensitive_value",
      success_url: "https://sensitive.invalid/success",
      cancel_url: "https://sensitive.invalid/cancel",
      createdAt: new TestTimestamp(99, 3),
      ...overrides,
    },
  };
}

function legacyState(overrides = {}) {
  return {
    companies: [
      company("COMPANY_SECRET_A", {
        stripeCustomerId: "cus_sensitive_value",
        subscription: {
          id: "sub_sensitive_value",
          status: "trialing",
          currentPeriodEnd: new TestTimestamp(200, 4),
          employeeLimit: 10,
        },
      }),
    ],
    stripeData: [stripeData()],
    stripeDescendants: [],
    ...overrides,
  };
}

test("planner is deterministic and limits writes to the two legacy fields and direct StripeData", () => {
  const source = legacyState();
  const first = planCompanyLegacyStripeMigration(source);
  const second = planCompanyLegacyStripeMigration(source);
  assert.deepEqual(first.findings, []);
  assert.equal(first.planDigest, second.planDigest);
  assert.match(first.planDigest, /^[a-f0-9]{64}$/u);
  assert.deepEqual(first.rootDeletes, [
    {
      path: "Companies/COMPANY_SECRET_A",
      fields: ["stripeCustomerId", "subscription"],
    },
  ]);
  assert.deepEqual(first.stripeDeletes, [
    { path: "Companies/COMPANY_SECRET_A/StripeData/SESSION_SECRET_A" },
  ]);
  assert.equal(first.writeCount, 2);
  assert.equal(source.companies[0].data.companyName, "Synthetic company");
});

test("clean state produces no operations and a changed non-target field changes the digest", () => {
  const clean = planCompanyLegacyStripeMigration({ companies: [company()] });
  const changed = planCompanyLegacyStripeMigration({
    companies: [company("COMPANY_SECRET_A", { companyName: "Changed" })],
  });
  assert.deepEqual(clean.findings, []);
  assert.equal(clean.writeCount, 0);
  assert.equal(summarizeCompanyLegacyStripePlan(clean).status, "clean");
  assert.notEqual(clean.planDigest, changed.planDigest);
  assert.notEqual(clean.nonTargetDigest, changed.nonTargetDigest);
});

test("legacy Company field shapes fail closed", () => {
  const cases = [
    {
      code: "stripe-customer-id-shape-invalid",
      data: { stripeCustomerId: 123 },
    },
    { code: "subscription-shape-invalid", data: { subscription: "active" } },
    {
      code: "subscription-shape-invalid",
      data: { subscription: { id: null, unknown: true } },
    },
    {
      code: "subscription-shape-invalid",
      data: {
        subscription: { id: null, status: null, currentPeriodEnd: null },
      },
    },
    {
      code: "subscription-shape-invalid",
      data: { subscription: { currentPeriodEnd: new Date() } },
    },
    {
      code: "subscription-shape-invalid",
      data: { subscription: { employeeLimit: null } },
    },
  ];
  for (const candidate of cases) {
    const plan = planCompanyLegacyStripeMigration({
      companies: [company("COMPANY_SECRET_A", candidate.data)],
    });
    assert.equal(
      plan.findings.some(({ code }) => code === candidate.code),
      true,
      candidate.code,
    );
  }
});

test("only the three historical exact StripeData shapes are accepted", () => {
  const base = stripeData();
  const success = stripeData("SUCCESS", {
    error: null,
    sessionUrl: "https://synthetic.invalid/session",
    customerId: "cus_synthetic",
  });
  const failure = stripeData("FAILURE", {
    error: { message: "synthetic failure" },
    sessionUrl: null,
  });
  for (const record of [base, success, failure]) {
    const plan = planCompanyLegacyStripeMigration({
      companies: [company()],
      stripeData: [record],
    });
    assert.deepEqual(plan.findings, []);
  }
  for (const record of [
    stripeData("PARTIAL_SUCCESS", { error: null, sessionUrl: "url" }),
    stripeData("OPTIONAL_ONLY", { customerId: "cus" }),
  ]) {
    const plan = planCompanyLegacyStripeMigration({
      companies: [company()],
      stripeData: [record],
    });
    assert.equal(
      plan.findings.some(({ code }) => code === "stripe-data-shape-invalid"),
      true,
    );
  }
});

test("StripeData empty, unknown keys, invalid values, orphan documents, and descendants block", () => {
  const cases = [
    stripeData("EMPTY", { price: undefined }),
    stripeData("UNKNOWN", { unexpected: true }),
    stripeData("BAD_CREATED", { createdAt: "not-a-timestamp" }),
    stripeData("BAD_PRICE", { price: null }),
    stripeData("BAD_ERROR", { error: { message: "x", stack: "secret" } }),
    stripeData("UNSUPPORTED", { error: new Map() }),
  ];
  cases[0].data = {};
  for (const record of cases) {
    const plan = planCompanyLegacyStripeMigration({
      companies: [company()],
      stripeData: [record],
    });
    assert.equal(
      plan.findings.some(({ code }) => code === "stripe-data-shape-invalid"),
      true,
    );
  }

  const orphan = planCompanyLegacyStripeMigration({ stripeData: [stripeData()] });
  assert.equal(
    orphan.findings.some(({ code }) => code === "stripe-data-orphan"),
    true,
  );
  const nested = planCompanyLegacyStripeMigration({
    companies: [company()],
    stripeData: [stripeData()],
    stripeDescendants: [
      "Companies/COMPANY_SECRET_A/StripeData/SESSION_SECRET_A/Nested/CHILD_SECRET",
    ],
  });
  assert.equal(
    nested.findings.some(
      ({ code }) => code === "stripe-data-descendant-present",
    ),
    true,
  );
});

test("canonical Firestore values preserve Timestamp precision and reject unsupported classes", () => {
  assert.deepEqual(canonicalizeFirestoreValue(new TestTimestamp(12, 34)), {
    __firestoreType: "timestamp",
    value: [12, 34],
  });
  assert.deepEqual(canonicalizeFirestoreValue(Buffer.from([1, 2])), {
    __firestoreType: "bytes",
    value: "AQI=",
  });
  assert.throws(() => canonicalizeFirestoreValue(new Map()), ({ code }) =>
    code === "unsupported-firestore-type",
  );
});

test("summary is value-redacted and exposes only anonymous subjects and counts", () => {
  const plan = planCompanyLegacyStripeMigration({
    ...legacyState(),
    stripeDescendants: [
      "Companies/COMPANY_SECRET_A/StripeData/SESSION_SECRET_A/Nested/CHILD_SECRET",
    ],
  });
  const serialized = JSON.stringify(summarizeCompanyLegacyStripePlan(plan));
  for (const secret of [
    "COMPANY_SECRET_A",
    "SESSION_SECRET_A",
    "cus_sensitive_value",
    "sub_sensitive_value",
    "price_sensitive_value",
    "sensitive.invalid",
    "Companies/",
  ]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test("target and argument guards expose no user-local, Dev, Prod, or remote path", () => {
  assert.deepEqual(
    assertCodexStripeMigrationTarget({
      GCLOUD_PROJECT: "demo-air-guard-v2-codex",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080",
    }),
    CODEX_STRIPE_MIGRATION_TARGET,
  );
  for (const env of [
    {},
    {
      GCLOUD_PROJECT: "air-guard-v2-dev",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080",
    },
    {
      GCLOUD_PROJECT: "demo-air-guard-v2-codex",
      FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com:443",
    },
  ]) {
    assert.throws(
      () => assertCodexStripeMigrationTarget(env),
      ({ exitCode }) => exitCode === 78,
    );
  }
  assert.deepEqual(parseCompanyLegacyStripeArgs(["--target", "codex-local"]), {
    mode: "dry-run",
    target: "codex-local",
    planDigest: null,
    backupPath: null,
    backupReceipt: null,
  });
  for (const target of ["user-local", "dev", "prod"]) {
    assert.throws(
      () => parseCompanyLegacyStripeArgs(["--target", target]),
      ({ exitCode }) => exitCode === 64,
    );
  }
});

test("backup is exclusive, restricted to .codex-test, and receipt-bound", async () => {
  const plan = planCompanyLegacyStripeMigration(legacyState());
  let stored = null;
  const options = {
    repositoryRoot: "C:\\synthetic-repository",
    mkdirImpl: async () => {},
    writeFileImpl: async (_path, value, flags) => {
      assert.equal(flags.flag, "wx");
      stored = value;
    },
  };
  const { receiptHash } = await createCompanyLegacyStripeBackup(
    plan,
    ".codex-test/runtime/stripe-backup.json",
    options,
  );
  assert.match(receiptHash, /^[a-f0-9]{64}$/u);
  const backup = await readCompanyLegacyStripeBackup(
    ".codex-test/runtime/stripe-backup.json",
    receiptHash,
    {
      repositoryRoot: options.repositoryRoot,
      readFileImpl: async () => stored,
    },
  );
  assert.equal(backup.payload.planDigest, plan.planDigest);
  assert.equal(JSON.stringify(backup.payload).includes("cus_sensitive_value"), true);
  assert.equal(JSON.stringify(backup.payload).includes("Synthetic company"), false);
  await assert.rejects(
    () =>
      createCompanyLegacyStripeBackup(plan, "outside.json", {
        ...options,
      }),
    ({ code }) => code === "backup-path-invalid",
  );
  await assert.rejects(
    () =>
      createCompanyLegacyStripeBackup(
        plan,
        ".codex-test/runtime/existing.json",
        {
          ...options,
          writeFileImpl: async () => {
            throw new Error("exists");
          },
        },
      ),
    ({ code }) => code === "backup-write-failed",
  );
  await assert.rejects(
    () =>
      readCompanyLegacyStripeBackup(
        ".codex-test/runtime/stripe-backup.json",
        receiptHash,
        {
          repositoryRoot: options.repositoryRoot,
          readFileImpl: async () => `${stored}tampered`,
        },
      ),
    ({ code }) => code === "backup-receipt-mismatch",
  );

  const assertForgedRejected = async (mutate, expectedCode = "backup-format-invalid") => {
    const forgedPayload = JSON.parse(stored);
    mutate(forgedPayload);
    const forged = `${JSON.stringify(forgedPayload)}\n`;
    const forgedReceipt = createHash("sha256").update(forged, "utf8").digest("hex");
    await assert.rejects(
      () =>
        readCompanyLegacyStripeBackup(
          ".codex-test/runtime/stripe-backup.json",
          forgedReceipt,
          {
            repositoryRoot: options.repositoryRoot,
            readFileImpl: async () => forged,
          },
        ),
      ({ code }) => code === expectedCode,
    );
  };
  await assertForgedRejected((payload) => {
    payload.companies[0].path = "Outside/COMPANY_SECRET_A";
  });
  await assertForgedRejected((payload) => {
    payload.stripeData[0].data.price = null;
  });
  await assertForgedRejected((payload) => {
    payload.stripeData[0].data.createdAt.value = [1, 1_000_000_000];
  });
  await assertForgedRejected(
    (payload) => {
      payload.targetContentDigest = "0".repeat(64);
    },
    "backup-target-digest-mismatch",
  );
  await assertForgedRejected((payload) => {
    payload.companies.push(structuredClone(payload.companies[0]));
    payload.companyCount += 1;
  });
  await assertForgedRejected((payload) => {
    payload.stripeData[0].path =
      "Companies/UNLISTED_COMPANY/StripeData/SESSION_SECRET_A";
  });
  await assertForgedRejected((payload) => {
    payload.extra = true;
  });
});

function validRepositoryInputs() {
  const version = "3.0.0-dev.1";
  const resolved = "https://registry.invalid/schema.tgz";
  const integrity = "sha512-synthetic";
  const manifest = { dependencies: { "@shisyamo4131/air-guard-v2-schemas": version } };
  const lock = {
    packages: {
      "node_modules/@shisyamo4131/air-guard-v2-schemas": {
        version,
        resolved,
        integrity,
      },
    },
  };
  return {
    rulesSource: `match /Companies/{companyId}/StripeData/{document=**} {
      allow read, write: if false;
    }
    match /Companies/{companyId}/{collection}/{document=**} {
      allow read, write: if collection != "StripeData";
    }`,
    rootManifest: manifest,
    rootLock: lock,
    functionsManifest: structuredClone(manifest),
    functionsLock: structuredClone(lock),
  };
}

test("Rules and root/Functions schema identity must agree before apply", () => {
  const valid = validRepositoryInputs();
  assert.deepEqual(inspectStripeMigrationRepositoryPreconditions(valid), []);
  assert.deepEqual(
    inspectStripeMigrationRepositoryPreconditions({
      ...valid,
      rulesSource: "allow read, write: if true;",
    }),
    ["rules-fallback-exclusion-missing", "rules-stripe-deny-missing"],
  );
  const mismatched = structuredClone(valid);
  mismatched.functionsLock.packages[
    "node_modules/@shisyamo4131/air-guard-v2-schemas"
  ].integrity = "sha512-different";
  assert.deepEqual(inspectStripeMigrationRepositoryPreconditions(mismatched), [
    "schema-identity-mismatch",
  ]);
  const commentOnly = {
    ...valid,
    rulesSource: `// match /Companies/{companyId}/StripeData/{document=**} {
      // allow read, write: if false;
      // }
      // collection != "StripeData"`,
  };
  assert.deepEqual(inspectStripeMigrationRepositoryPreconditions(commentOnly), [
    "rules-fallback-exclusion-missing",
    "rules-stripe-deny-missing",
  ]);
  const duplicateAllow = {
    ...valid,
    rulesSource: `${valid.rulesSource}
      match /Companies/{companyId}/StripeData/{document=**} {
        allow read: if true;
      }`,
  };
  assert.deepEqual(inspectStripeMigrationRepositoryPreconditions(duplicateAllow), [
    "rules-stripe-deny-missing",
  ]);
});

const DELETE_FIELD = Symbol("delete-field");

function createFirestoreFake(initialRecords, { failCommit = false } = {}) {
  const documents = new Map(
    initialRecords.map((record, index) => [
      record.path,
      { data: record.data, version: index + 1 },
    ]),
  );
  const calls = [];
  const makeDocumentRef = (path) => ({
    path,
    id: path.split("/").at(-1),
    collection(name) {
      return makeCollectionRef(`${path}/${name}`);
    },
    async get() {
      return documentSnapshot(path);
    },
    async listCollections() {
      const prefix = `${path}/`;
      const depth = path.split("/").length;
      const names = new Set();
      for (const candidate of documents.keys()) {
        const parts = candidate.split("/");
        if (candidate.startsWith(prefix) && parts.length > depth + 1) {
          names.add(parts[depth]);
        }
      }
      return [...names].sort().map((name) => makeCollectionRef(`${path}/${name}`));
    },
  });
  const documentSnapshot = (path) => {
    const entry = documents.get(path);
    return {
      exists: entry !== undefined,
      ref: makeDocumentRef(path),
      data: () => entry?.data,
      updateTime: entry ? new TestTimestamp(entry.version, 0) : null,
    };
  };
  const makeCollectionRef = (path) => {
    const query = {
      kind: "collection",
      name: path.split("/").at(-1),
      path,
      async get() {
        return querySnapshot(query);
      },
      async listDocuments() {
        const prefix = `${path}/`;
        const depth = path.split("/").length;
        const childPaths = new Set();
        for (const candidate of documents.keys()) {
          const parts = candidate.split("/");
          if (candidate.startsWith(prefix) && parts.length > depth) {
            childPaths.add(`${path}/${parts[depth]}`);
          }
        }
        return [...childPaths].sort().map(makeDocumentRef);
      },
      limit() {
        return query;
      },
    };
    return query;
  };
  const querySnapshot = (query) => {
    const docs = [];
    for (const [path, entry] of documents) {
      const parts = path.split("/");
      const include =
        query.kind === "collection"
          ? path.startsWith(`${query.path}/`) &&
            parts.length === query.path.split("/").length + 1
          : parts.length >= 2 && parts[parts.length - 2] === query.name;
      if (!include) continue;
      docs.push(documentSnapshot(path));
    }
    docs.sort((a, b) => a.ref.path.localeCompare(b.ref.path));
    return { docs };
  };
  const firestore = {
    collection(name) {
      return makeCollectionRef(name);
    },
    collectionGroup(name) {
      const query = { kind: "collectionGroup", name };
      query.get = async () => querySnapshot(query);
      return query;
    },
    doc(path) {
      return makeDocumentRef(path);
    },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        async get(query) {
          calls.push({ type: "get", name: query.name });
          return querySnapshot(query);
        },
        update(reference, patch) {
          calls.push({ type: "update", path: reference.path });
          writes.push({ type: "update", path: reference.path, patch });
        },
        delete(reference) {
          calls.push({ type: "delete", path: reference.path });
          writes.push({ type: "delete", path: reference.path });
        },
        create(reference, data) {
          calls.push({ type: "create", path: reference.path });
          writes.push({ type: "create", path: reference.path, data });
        },
      };
      await callback(transaction);
      if (failCommit) throw new Error("synthetic transaction failure");
      for (const write of writes) {
        if (write.type === "delete") {
          documents.delete(write.path);
          continue;
        }
        if (write.type === "create") {
          if (documents.has(write.path)) throw new Error("already exists");
          documents.set(write.path, { data: write.data, version: 100 });
          continue;
        }
        const current = documents.get(write.path);
        if (!current) throw new Error("missing update target");
        const next = { ...current.data };
        for (const [field, value] of Object.entries(write.patch)) {
          if (value === DELETE_FIELD) delete next[field];
          else next[field] = value;
        }
        documents.set(write.path, { data: next, version: current.version + 1 });
      }
    },
  };
  return { firestore, documents, calls };
}

async function memoryBackup(plan) {
  let serialized;
  const repositoryRoot = "C:\\synthetic-repository";
  const path = ".codex-test/runtime/backup.json";
  const receipt = await createCompanyLegacyStripeBackup(plan, path, {
    repositoryRoot,
    mkdirImpl: async () => {},
    writeFileImpl: async (_path, value) => {
      serialized = value;
    },
  });
  return (
    await readCompanyLegacyStripeBackup(path, receipt.receiptHash, {
      repositoryRoot,
      readFileImpl: async () => serialized,
    })
  ).payload;
}

test("inventory finds descendants behind missing StripeData and Company parents", async () => {
  const fake = createFirestoreFake([
    company(),
    {
      path: "Companies/COMPANY_SECRET_A/StripeData/MISSING_PARENT/Nested/CHILD_A",
      data: { fixture: true },
    },
    {
      path: "Companies/MISSING_COMPANY/StripeData/MISSING_PARENT/Nested/CHILD_B",
      data: { fixture: true },
    },
  ]);
  const state = await readCompanyLegacyStripeState(fake.firestore);
  const plan = planCompanyLegacyStripeMigration(state);
  assert.equal(
    plan.findings.filter(
      ({ code }) => code === "stripe-data-descendant-present",
    ).length,
    2,
  );
  assert.equal(
    plan.findings.some(({ code }) => code === "stripe-data-orphan"),
    true,
  );
  assert.notEqual(summarizeCompanyLegacyStripePlan(plan).status, "clean");
});

test("a missing-parent descendant added after backup blocks apply with write zero", async () => {
  const fake = createFirestoreFake([company("COMPANY_SECRET_A", {
    stripeCustomerId: "cus_sensitive_value",
    subscription: {
      id: null,
      status: null,
      currentPeriodEnd: null,
      employeeLimit: 10,
    },
  }), stripeData()]);
  const cleanPlan = planCompanyLegacyStripeMigration(
    await readCompanyLegacyStripeState(fake.firestore),
  );
  const backup = await memoryBackup(cleanPlan);
  fake.documents.set(
    "Companies/COMPANY_SECRET_A/StripeData/MISSING_PARENT/Nested/CHILD",
    { data: { fixture: true }, version: 200 },
  );
  await assert.rejects(
    () =>
      applyCompanyLegacyStripeMigration({
        firestore: fake.firestore,
        expectedPlanDigest: cleanPlan.planDigest,
        backup,
        deleteFieldValue: () => DELETE_FIELD,
      }),
    ({ code }) => code === "plan-blocked",
  );
  assert.equal(fake.calls.some(({ type }) => type !== "get"), false);
  assert.equal(
    "stripeCustomerId" in fake.documents.get("Companies/COMPANY_SECRET_A").data,
    true,
  );
  assert.equal(
    fake.documents.has("Companies/COMPANY_SECRET_A/StripeData/SESSION_SECRET_A"),
    true,
  );
});

test("apply re-reads all targets before writes and is idempotent", async () => {
  const initial = legacyState();
  const fake = createFirestoreFake([...initial.companies, ...initial.stripeData]);
  const freshState = {
    ...initial,
    companies: initial.companies.map((record, index) => ({
      ...record,
      updateTime: new TestTimestamp(index + 1, 0),
    })),
    stripeData: initial.stripeData.map((record, index) => ({
      ...record,
      updateTime: new TestTimestamp(initial.companies.length + index + 1, 0),
    })),
  };
  const plan = planCompanyLegacyStripeMigration(freshState);
  const backup = await memoryBackup(plan);
  await applyCompanyLegacyStripeMigration({
    firestore: fake.firestore,
    expectedPlanDigest: plan.planDigest,
    backup,
    deleteFieldValue: () => DELETE_FIELD,
  });
  const firstWrite = fake.calls.findIndex(({ type }) => type !== "get");
  assert.equal(firstWrite, 2);
  assert.equal(fake.calls.slice(firstWrite).some(({ type }) => type === "get"), false);
  assert.deepEqual(fake.documents.get("Companies/COMPANY_SECRET_A").data, {
    companyName: "Synthetic company",
    nested: { enabled: true },
  });
  assert.equal(
    fake.documents.has("Companies/COMPANY_SECRET_A/StripeData/SESSION_SECRET_A"),
    false,
  );
  const post = await verifyCompanyLegacyStripePostState(fake.firestore, plan);
  assert.equal(post.writeCount, 0);
});

test("state drift and transaction failure leave every document unchanged", async () => {
  const initial = legacyState();
  const baselineFake = createFirestoreFake([...initial.companies, ...initial.stripeData]);
  const planState = {
    ...initial,
    companies: initial.companies.map((record, index) => ({
      ...record,
      updateTime: new TestTimestamp(index + 1, 0),
    })),
    stripeData: initial.stripeData.map((record, index) => ({
      ...record,
      updateTime: new TestTimestamp(initial.companies.length + index + 1, 0),
    })),
  };
  const plan = planCompanyLegacyStripeMigration(planState);
  const backup = await memoryBackup(plan);
  baselineFake.documents.get("Companies/COMPANY_SECRET_A").data.companyName = "drift";
  await assert.rejects(
    () =>
      applyCompanyLegacyStripeMigration({
        firestore: baselineFake.firestore,
        expectedPlanDigest: plan.planDigest,
        backup,
        deleteFieldValue: () => DELETE_FIELD,
      }),
    ({ code }) => code === "plan-digest-mismatch",
  );
  assert.equal(
    baselineFake.calls.some(({ type }) => type !== "get"),
    false,
  );

  const failure = createFirestoreFake(
    [...initial.companies, ...initial.stripeData],
    { failCommit: true },
  );
  await assert.rejects(() =>
    applyCompanyLegacyStripeMigration({
      firestore: failure.firestore,
      expectedPlanDigest: plan.planDigest,
      backup,
      deleteFieldValue: () => DELETE_FIELD,
    }),
  );
  assert.equal(
    failure.documents.has("Companies/COMPANY_SECRET_A/StripeData/SESSION_SECRET_A"),
    true,
  );
  assert.equal(
    "stripeCustomerId" in failure.documents.get("Companies/COMPANY_SECRET_A").data,
    true,
  );
});

test("restore reinstates only backed-up fields and StripeData and blocks conflicts", async () => {
  const initial = legacyState();
  const sourceFake = createFirestoreFake([...initial.companies, ...initial.stripeData]);
  const planState = {
    ...initial,
    companies: initial.companies.map((record, index) => ({
      ...record,
      updateTime: new TestTimestamp(index + 1, 0),
    })),
    stripeData: initial.stripeData.map((record, index) => ({
      ...record,
      updateTime: new TestTimestamp(initial.companies.length + index + 1, 0),
    })),
  };
  const plan = planCompanyLegacyStripeMigration(planState);
  const backup = await memoryBackup(plan);
  await assert.rejects(
    () =>
      restoreCompanyLegacyStripeMigration({
        firestore: sourceFake.firestore,
        backup: structuredClone(backup),
      }),
    ({ code }) => code === "backup-not-validated",
  );
  await applyCompanyLegacyStripeMigration({
    firestore: sourceFake.firestore,
    expectedPlanDigest: plan.planDigest,
    backup,
    deleteFieldValue: () => DELETE_FIELD,
  });
  await restoreCompanyLegacyStripeMigration({
    firestore: sourceFake.firestore,
    backup,
    valueFactories: {
      timestamp: (seconds, nanoseconds) => new TestTimestamp(seconds, nanoseconds),
    },
  });
  const restoredCompany = sourceFake.documents.get(
    "Companies/COMPANY_SECRET_A",
  ).data;
  assert.equal(restoredCompany.companyName, "Synthetic company");
  assert.equal(restoredCompany.stripeCustomerId, "cus_sensitive_value");
  assert.equal(
    sourceFake.documents.has(
      "Companies/COMPANY_SECRET_A/StripeData/SESSION_SECRET_A",
    ),
    true,
  );

  const conflict = createFirestoreFake([
    company("COMPANY_SECRET_A", { companyName: "changed after migration" }),
  ]);
  await assert.rejects(
    () =>
      restoreCompanyLegacyStripeMigration({
        firestore: conflict.firestore,
        backup,
        valueFactories: {
          timestamp: (seconds, nanoseconds) =>
            new TestTimestamp(seconds, nanoseconds),
        },
      }),
    ({ code }) => code === "restore-conflict",
  );
  assert.equal(conflict.calls.some(({ type }) => type !== "get"), false);
});

test("CLI failures never echo arguments, paths, values, email, or a stack", () => {
  const secret = "person@example.invalid/cus_secret/Companies/SECRET";
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../../scripts/migrate-company-legacy-stripe.mjs", import.meta.url),
      ),
      "--target",
      "codex-local",
      "--unknown",
      secret,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 64);
  assert.match(result.stderr, /"code":"usage-invalid"/u);
  assert.equal(result.stderr.includes(secret), false);
  assert.equal(result.stderr.includes("at "), false);
  assert.equal(result.stderr.includes("migrate-company-legacy-stripe.mjs:"), false);
});
