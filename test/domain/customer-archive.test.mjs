import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

import { CUSTOMER_DOCUMENT_FIELDS } from "../../utils/customer/customerDocumentContract.js";
import {
  archiveCustomer,
  CUSTOMER_ARCHIVE_ERROR_CODES,
  CustomerArchiveError,
  parseCustomerArchiveInput,
} from "../../functions/modules/customer/archiveCustomer.js";
import {
  buildCustomerArchiveEnvelope,
  CUSTOMER_ARCHIVE_CUSTOMER_FIELDS,
  isServerTimestampSentinel,
  isValidCustomerArchiveEnvelope,
  isValidCustomerArchiveSnapshot,
} from "../../functions/modules/customer/customerArchiveDocumentContract.js";

const requireFromFunctions = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { FieldValue, GeoPoint, Timestamp } = requireFromFunctions(
  "firebase-admin/firestore",
);

const identity = Object.freeze({
  uid: "actor-a",
  email: "actor@example.test",
  companyId: "company-a",
  isSuperUser: false,
});

const admin = Object.freeze({
  companyId: "company-a",
  isTemporary: false,
  disabled: false,
  isAdmin: true,
  roles: [],
});

function validCustomer(overrides = {}) {
  const location = {
    formattedAddress: "東京都千代田区千代田1-1",
    lat: 35.681236,
    lng: 139.767125,
  };
  return {
    docId: "customer-a",
    uid: "creator-a",
    createdAt: Timestamp.fromMillis(1_700_000_000_000),
    updatedAt: Timestamp.fromMillis(1_700_000_100_000),
    code: "C001",
    name: "取引先",
    branchName: null,
    abbreviation: "取引先",
    nameKana: "トリヒキサキ",
    zipcode: "1000001",
    prefCode: "13",
    city: "千代田区",
    address: "千代田1-1",
    building: null,
    location,
    geopoint: new GeoPoint(location.lat, location.lng),
    tel: "03-1234-5678",
    fax: null,
    contractStatus: "ACTIVE",
    cutoffDate: 25,
    paymentMonth: 1,
    paymentDate: 25,
    remarks: null,
    fullAddress: "東京都千代田区千代田1-1",
    prefecture: "東京都",
    tokenMap: { 取: true, 引: true },
    ...overrides,
  };
}

function validInput(overrides = {}) {
  return {
    customerId: "customer-a",
    reason: "重複登録のため",
    operationId: "operation-a",
    ...overrides,
  };
}

function documentSnapshot(data) {
  return data === null
    ? { exists: false, data: () => undefined }
    : { exists: true, data: () => data };
}

function createFirestore({
  actor = admin,
  active = validCustomer(),
  archive = null,
  references = {},
  readErrorPath = null,
  archiveDataError = false,
} = {}) {
  const calls = [];
  const writes = [];

  const firestore = {
    doc(path) {
      calls.push({ method: "firestore.doc", path });
      return { kind: "document", path };
    },
    collection(path) {
      calls.push({ method: "firestore.collection", path });
      return {
        where(field, operator, value) {
          calls.push({
            method: "query.where",
            path,
            field,
            operator,
            value,
          });
          return {
            limit(count) {
              calls.push({ method: "query.limit", path, count });
              return {
                kind: "query",
                path,
                field,
                operator,
                value,
                count,
              };
            },
          };
        },
      };
    },
    async runTransaction(callback) {
      calls.push({ method: "firestore.runTransaction" });
      return callback({
        async get(target) {
          calls.push({ method: "transaction.get", path: target.path });
          if (target.path === readErrorPath) {
            throw new Error("synthetic read failure");
          }
          if (target.kind === "query") {
            const collectionName = target.path.split("/").at(-1);
            return { size: references[collectionName] ? 1 : 0 };
          }
          if (target.path.includes("/Users/")) return documentSnapshot(actor);
          if (target.path.includes("/Customers_archive/")) {
            if (archiveDataError) {
              return {
                exists: true,
                data() {
                  throw new Error("synthetic archive data failure");
                },
              };
            }
            return documentSnapshot(archive);
          }
          return documentSnapshot(active);
        },
        create(ref, value) {
          const call = { method: "transaction.create", path: ref.path, value };
          calls.push(call);
          writes.push(call);
        },
        delete(ref) {
          const call = { method: "transaction.delete", path: ref.path };
          calls.push(call);
          writes.push(call);
        },
        set(ref, value) {
          const call = { method: "transaction.set", path: ref.path, value };
          calls.push(call);
          writes.push(call);
        },
        update(ref, value) {
          const call = { method: "transaction.update", path: ref.path, value };
          calls.push(call);
          writes.push(call);
        },
      });
    },
  };
  return { calls, firestore, writes };
}

async function rejectsCode(operation, expectedCode) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof CustomerArchiveError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("archive input accepts exact fields, trims values, and preserves opaque operation IDs", () => {
  assert.deepEqual(
    parseCustomerArchiveInput({
      reason: "  重複登録  ",
      operationId: "  opaque/value:#?\u0001  ",
      customerId: "  customer-a  ",
    }),
    {
      customerId: "customer-a",
      reason: "重複登録",
      operationId: "opaque/value:#?\u0001",
    },
  );

  for (const input of [
    validInput({ customerId: "x" }),
    validInput({ customerId: "x".repeat(128) }),
    validInput({ operationId: "x" }),
    validInput({ operationId: "x".repeat(128) }),
    validInput({ reason: "x" }),
    validInput({ reason: "x".repeat(200) }),
  ]) {
    assert.doesNotThrow(() => parseCustomerArchiveInput(input));
  }
});

test("archive input rejects unsafe IDs, invalid bounds, missing or unknown keys, and non-plain objects", () => {
  class Input {
    constructor() {
      Object.assign(this, validInput());
    }
  }
  const symbolInput = validInput();
  symbolInput[Symbol("extra")] = true;
  for (const input of [
    {},
    [],
    new Input(),
    { ...validInput(), extra: true },
    { customerId: "customer-a", reason: "reason" },
    validInput({ customerId: " " }),
    validInput({ customerId: "x".repeat(129) }),
    validInput({ customerId: "unsafe/id" }),
    validInput({ customerId: "unsafe\u0000id" }),
    validInput({ operationId: " " }),
    validInput({ operationId: "x".repeat(129) }),
    validInput({ reason: " " }),
    validInput({ reason: "x".repeat(201) }),
    validInput({ reason: 1 }),
    symbolInput,
  ]) {
    assert.throws(
      () => parseCustomerArchiveInput(input),
      (error) =>
        error instanceof CustomerArchiveError &&
        error.code === CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_INPUT,
    );
  }
});

test("invalid Firestore and identity dependencies fail before a transaction", async () => {
  const scenarios = [
    { firestore: null, currentIdentity: identity },
    { firestore: { doc() {}, collection() {} }, currentIdentity: identity },
    { firestore: createFirestore().firestore, currentIdentity: null },
    {
      firestore: createFirestore().firestore,
      currentIdentity: { ...identity, uid: " actor-a" },
    },
    {
      firestore: createFirestore().firestore,
      currentIdentity: { ...identity, uid: "actor/a" },
    },
    {
      firestore: createFirestore().firestore,
      currentIdentity: { ...identity, companyId: "x".repeat(129) },
    },
    {
      firestore: createFirestore().firestore,
      currentIdentity: { ...identity, isSuperUser: "false" },
    },
  ];

  for (const { firestore, currentIdentity } of scenarios) {
    await rejectsCode(
      () =>
        archiveCustomer({
          firestore,
          identity: currentIdentity,
          input: validInput(),
        }),
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
    );
  }
});

test("Company administrators and known customers:write presets may archive", async () => {
  for (const scenario of [
    { actor: admin, currentIdentity: identity },
    { actor: { ...admin, isAdmin: true }, currentIdentity: { ...identity, isSuperUser: true } },
    { actor: { ...admin, isAdmin: false, roles: ["manager"] }, currentIdentity: identity },
    { actor: { ...admin, isAdmin: false, roles: ["legal"] }, currentIdentity: identity },
  ]) {
    const { firestore, writes } = createFirestore({ actor: scenario.actor });
    const result = await archiveCustomer({
      firestore,
      identity: scenario.currentIdentity,
      input: validInput(),
      serverTimestampFactory: () => FieldValue.serverTimestamp(),
    });
    assert.deepEqual(result, { success: true, archived: true });
    assert.equal(writes.length, 2);
  }
});

test("invalid, revoked, cross-tenant, temporary, disabled, and super-user actors fail closed", async () => {
  for (const scenario of [
    { actor: { ...admin, isAdmin: false, roles: ["controller"] }, currentIdentity: identity },
    { actor: { ...admin, isAdmin: false, roles: ["customers:write"] }, currentIdentity: identity },
    { actor: { ...admin, isAdmin: false, roles: ["unknown-role"] }, currentIdentity: identity },
    { actor: { ...admin, isAdmin: false, roles: undefined }, currentIdentity: identity },
    { actor: { ...admin, isAdmin: false, roles: ["manager"] }, currentIdentity: { ...identity, isSuperUser: true } },
    { actor: { ...admin, isTemporary: true }, currentIdentity: identity },
    { actor: { ...admin, disabled: true }, currentIdentity: identity },
    { actor: { ...admin, companyId: "company-b" }, currentIdentity: identity },
    { actor: { ...admin, isAdmin: undefined }, currentIdentity: identity },
    { actor: null, currentIdentity: identity },
  ]) {
    const { firestore, writes } = createFirestore({ actor: scenario.actor });
    await rejectsCode(
      () =>
        archiveCustomer({
          firestore,
          identity: scenario.currentIdentity,
          input: validInput(),
        }),
      CUSTOMER_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED,
    );
    assert.deepEqual(writes, []);
  }
});

test("active-only archive reads every dependency before create then delete", async () => {
  const customer = validCustomer();
  const sentinel = FieldValue.serverTimestamp();
  let timestampCalls = 0;
  const { calls, firestore, writes } = createFirestore({ active: customer });
  const result = await archiveCustomer({
    firestore,
    identity,
    input: validInput({ reason: "  重複登録のため  " }),
    serverTimestampFactory: () => {
      timestampCalls += 1;
      return sentinel;
    },
  });

  assert.deepEqual(result, { success: true, archived: true });
  assert.equal(timestampCalls, 1);
  assert.deepEqual(
    calls
      .filter((call) => call.method === "transaction.get")
      .map((call) => call.path),
    [
      "Companies/company-a/Users/actor-a",
      "Companies/company-a/Customers/customer-a",
      "Companies/company-a/Customers_archive/customer-a",
      "Companies/company-a/Sites",
      "Companies/company-a/OperationResults",
      "Companies/company-a/Billings",
    ],
  );
  assert.deepEqual(
    calls
      .filter((call) => call.method === "firestore.collection")
      .map((call) => call.path),
    [
      "Companies/company-a/Sites",
      "Companies/company-a/OperationResults",
      "Companies/company-a/Billings",
    ],
  );
  for (const call of calls.filter((item) => item.method === "query.where")) {
    assert.deepEqual(
      { field: call.field, operator: call.operator, value: call.value },
      { field: "customerId", operator: "==", value: "customer-a" },
    );
  }
  assert.deepEqual(
    calls.filter((call) => call.method === "query.limit").map((call) => call.count),
    [1, 1, 1],
  );

  assert.deepEqual(writes.map((call) => call.method), [
    "transaction.create",
    "transaction.delete",
  ]);
  assert.equal(
    calls.findIndex((call) => call.method === "transaction.create") >
      calls.findLastIndex((call) => call.method === "transaction.get"),
    true,
  );
  assert.equal(calls.some((call) => call.method === "transaction.set"), false);
  assert.equal(calls.some((call) => call.method === "transaction.update"), false);

  assert.equal(writes[0].path, "Companies/company-a/Customers_archive/customer-a");
  assert.equal(writes[1].path, "Companies/company-a/Customers/customer-a");
  assert.deepEqual(writes[0].value, {
    schemaVersion: 1,
    customer,
    audit: {
      operationId: "operation-a",
      reason: "重複登録のため",
      actorUid: "actor-a",
      archivedAt: sentinel,
    },
  });
  assert.notEqual(writes[0].value.customer, customer);
});

test("active and archive states enforce not-found, conflict, and exact idempotent retry", async () => {
  const customer = validCustomer();
  const archivedAt = Timestamp.fromMillis(1_700_000_200_000);
  const matchingArchive = {
    schemaVersion: 1,
    customer,
    audit: {
      operationId: "operation-a",
      reason: "重複登録のため",
      actorUid: "actor-a",
      archivedAt,
    },
  };

  {
    const { firestore, writes } = createFirestore({ active: null, archive: null });
    await rejectsCode(
      () => archiveCustomer({ firestore, identity, input: validInput() }),
      CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_NOT_FOUND,
    );
    assert.deepEqual(writes, []);
  }
  {
    const { firestore, writes } = createFirestore({
      active: customer,
      archive: matchingArchive,
    });
    await rejectsCode(
      () => archiveCustomer({ firestore, identity, input: validInput() }),
      CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT,
    );
    assert.deepEqual(writes, []);
  }
  {
    const { firestore, writes } = createFirestore({
      active: null,
      archive: matchingArchive,
    });
    assert.deepEqual(
      await archiveCustomer({ firestore, identity, input: validInput() }),
      { success: true, archived: true },
    );
    assert.deepEqual(writes, []);
  }

  for (const archive of [
    { ...matchingArchive, schemaVersion: 2 },
    { ...matchingArchive, unexpected: true },
    { ...matchingArchive, customer: { ...customer, name: null } },
    { ...matchingArchive, audit: { ...matchingArchive.audit, archivedAt: { seconds: 1 } } },
  ]) {
    const { firestore, writes } = createFirestore({ active: null, archive });
    await rejectsCode(
      () => archiveCustomer({ firestore, identity, input: validInput() }),
      CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID,
    );
    assert.deepEqual(writes, []);
  }

  for (const archive of [
    { ...matchingArchive, audit: { ...matchingArchive.audit, actorUid: "actor-b" } },
    { ...matchingArchive, audit: { ...matchingArchive.audit, operationId: "operation-b" } },
    { ...matchingArchive, audit: { ...matchingArchive.audit, reason: "別の理由" } },
  ]) {
    const { firestore, writes } = createFirestore({ active: null, archive });
    await rejectsCode(
      () => archiveCustomer({ firestore, identity, input: validInput() }),
      CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT,
    );
    assert.deepEqual(writes, []);
  }

  {
    const { firestore, writes } = createFirestore({
      active: null,
      archive: matchingArchive,
      archiveDataError: true,
    });
    await rejectsCode(
      () => archiveCustomer({ firestore, identity, input: validInput() }),
      CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID,
    );
    assert.deepEqual(writes, []);
  }
});

test("each Customer reference blocks archive after all three reference reads", async () => {
  for (const collectionName of ["Sites", "OperationResults", "Billings"]) {
    const { calls, firestore, writes } = createFirestore({
      references: { [collectionName]: true },
    });
    await rejectsCode(
      () => archiveCustomer({ firestore, identity, input: validInput() }),
      CUSTOMER_ARCHIVE_ERROR_CODES.REFERENCES_EXIST,
    );
    assert.deepEqual(writes, []);
    assert.deepEqual(
      calls
        .filter((call) => call.method === "transaction.get")
        .map((call) => call.path)
        .slice(-3),
      [
        "Companies/company-a/Sites",
        "Companies/company-a/OperationResults",
        "Companies/company-a/Billings",
      ],
    );
  }
});

test("Customer decoded-value contract rejects field, type, derived, coordinate, token, and timestamp corruption", async () => {
  const extra = validCustomer();
  extra.unexpected = true;
  const missing = validCustomer();
  delete missing.name;
  const tooManyTokens = Object.fromEntries(
    Array.from({ length: 513 }, (_, index) => [`token-${index}`, true]),
  );
  const cases = [
    extra,
    missing,
    validCustomer({ docId: "customer-b" }),
    validCustomer({ name: null }),
    validCustomer({ createdAt: { seconds: 1, nanoseconds: 0 } }),
    validCustomer({ updatedAt: { serverTimestamp: true } }),
    validCustomer({ paymentDate: 25.5 }),
    validCustomer({ paymentMonth: Number.NaN }),
    validCustomer({ location: { formattedAddress: "住所", lat: Infinity, lng: 1 } }),
    validCustomer({ geopoint: { latitude: 35.681236, longitude: 139.767125 } }),
    validCustomer({ geopoint: new GeoPoint(0, 0) }),
    validCustomer({ location: null, geopoint: new GeoPoint(0, 0) }),
    validCustomer({ fullAddress: "不一致" }),
    validCustomer({ tokenMap: { token: false } }),
    validCustomer({ tokenMap: tooManyTokens }),
    validCustomer({ tokenMap: new (class TokenMap { constructor() { this.a = true; } })() }),
  ];

  for (const customer of cases) {
    assert.equal(isValidCustomerArchiveSnapshot(customer, "customer-a"), false);
    const { firestore, writes } = createFirestore({ active: customer });
    await rejectsCode(
      () => archiveCustomer({ firestore, identity, input: validInput() }),
      CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_INVALID,
    );
    assert.deepEqual(writes, []);
  }
});

test("new archive builder requires a server timestamp sentinel while retry requires a concrete Timestamp", () => {
  const customer = validCustomer();
  const sentinel = FieldValue.serverTimestamp();
  const writeEnvelope = buildCustomerArchiveEnvelope({
    customer,
    customerId: "customer-a",
    operationId: "operation-a",
    reason: "重複登録のため",
    actorUid: "actor-a",
    archivedAt: sentinel,
  });
  assert.equal(isValidCustomerArchiveSnapshot(customer, "customer-a"), true);
  assert.equal(isServerTimestampSentinel(sentinel), true);
  assert.equal(
    writeEnvelope.audit.archivedAt.isEqual(FieldValue.serverTimestamp()),
    true,
  );
  assert.equal(
    isValidCustomerArchiveEnvelope(writeEnvelope, "customer-a"),
    false,
  );

  const committedEnvelope = {
    ...writeEnvelope,
    audit: {
      ...writeEnvelope.audit,
      archivedAt: Timestamp.fromMillis(1_700_000_200_000),
    },
  };
  assert.equal(
    isValidCustomerArchiveEnvelope(committedEnvelope, "customer-a"),
    true,
  );
  assert.deepEqual(Object.keys(writeEnvelope), [
    "schemaVersion",
    "customer",
    "audit",
  ]);
  assert.deepEqual(Object.keys(writeEnvelope.audit), [
    "operationId",
    "reason",
    "actorUid",
    "archivedAt",
  ]);
});

test("Functions Customer field constant has exact root parity and product code avoids generic delete or restore", async () => {
  assert.equal(CUSTOMER_ARCHIVE_CUSTOMER_FIELDS.length, 26);
  assert.deepEqual(CUSTOMER_ARCHIVE_CUSTOMER_FIELDS, CUSTOMER_DOCUMENT_FIELDS);
  assert.ok(Object.isFrozen(CUSTOMER_ARCHIVE_CUSTOMER_FIELDS));

  const source = await readFile(
    new URL(
      "../../functions/modules/customer/archiveCustomer.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(source, /air-firebase-v2|Customer\.delete|Customer\.restore/u);
  assert.doesNotMatch(source, /generic/i);
  assert.doesNotMatch(source, /\.set\s*\(|\.update\s*\(/u);
  assert.match(source, /transaction\.create\s*\(/u);
  assert.match(source, /transaction\.delete\s*\(/u);
});

test("default timestamp factory writes the actual serverTimestamp sentinel", async () => {
  const { firestore, writes } = createFirestore();
  assert.deepEqual(
    await archiveCustomer({ firestore, identity, input: validInput() }),
    { success: true, archived: true },
  );
  assert.equal(writes.length, 2);
  assert.equal(
    writes[0].value.audit.archivedAt.isEqual(FieldValue.serverTimestamp()),
    true,
  );
});

test("read failures and non-server timestamp factory values produce no writes", async () => {
  {
    const { firestore, writes } = createFirestore({
      readErrorPath: "Companies/company-a/Billings",
    });
    await assert.rejects(() =>
      archiveCustomer({ firestore, identity, input: validInput() }),
    );
    assert.deepEqual(writes, []);
  }
  for (const invalidTimestamp of [
    null,
    undefined,
    { serverTimestamp: true },
    { isEqual: () => true },
    Timestamp.now(),
    FieldValue.delete(),
    FieldValue.increment(1),
  ]) {
    const { firestore, writes } = createFirestore();
    await rejectsCode(
      () =>
        archiveCustomer({
          firestore,
          identity,
          input: validInput(),
          serverTimestampFactory: () => invalidTimestamp,
        }),
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
    );
    assert.deepEqual(writes, []);
  }
});
