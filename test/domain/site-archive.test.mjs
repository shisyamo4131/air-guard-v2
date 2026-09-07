import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import {
  archiveSite,
  parseSiteArchiveInput,
  SITE_ARCHIVE_ERROR_CODES,
  SiteArchiveError,
} from "../../functions/modules/sites/archiveSite.js";
import {
  buildSiteArchiveEnvelope,
  isValidSiteArchiveEnvelope,
  isValidSiteArchiveSnapshot,
  SITE_ARCHIVE_SCHEMA_VERSION,
  SITE_ARCHIVE_SITE_FIELDS,
} from "../../functions/modules/sites/siteArchiveDocumentContract.js";

const requireFromFunctions = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { FieldValue, Timestamp } = requireFromFunctions(
  "firebase-admin/firestore",
);

const REFERENCES = Object.freeze([
  "SiteOperationSchedules",
  "OperationResults",
  "ArrangementNotifications",
  "Billings",
  "SiteEmployeeHistories",
]);

const identity = Object.freeze({
  uid: "actor-a",
  email: "actor@example.invalid",
  companyId: "company-a",
  isSuperUser: false,
});

const admin = Object.freeze({
  docId: "actor-a",
  companyId: "company-a",
  isTemporary: false,
  disabled: false,
  isAdmin: true,
  roles: [],
});

function validSite(overrides = {}) {
  return {
    docId: "site-a",
    uid: "creator-a",
    createdAt: Timestamp.fromMillis(1_700_000_000_000),
    updatedAt: Timestamp.fromMillis(1_700_000_100_000),
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
    geopoint: null,
    remarks: null,
    agreementsV2: [],
    status: "ACTIVE",
    fullAddress: "東京都千代田区千代田1-1",
    prefecture: "東京都",
    isTemporary: true,
    hasConstructionPeriod: false,
    hasConstructionPeriodStartAt: false,
    hasConstructionPeriodEndAt: false,
    displayName: "合成現場",
    tokenMap: {},
    ...overrides,
  };
}

function validInput(overrides = {}) {
  return {
    siteId: "site-a",
    reason: "重複登録のため",
    operationId: "operation-a",
    ...overrides,
  };
}

function snapshot(data) {
  return data === null
    ? { exists: false, data: () => undefined }
    : { exists: true, data: () => data };
}

function createFirestore({
  actor = admin,
  system = { isMaintenance: false },
  active = validSite(),
  archive = null,
  references = {},
  invalidQuery = null,
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
          calls.push({ method: "query.where", path, field, operator, value });
          return {
            limit(count) {
              calls.push({ method: "query.limit", path, count });
              return { kind: "query", path, field, operator, value, count };
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
          if (target.kind === "query") {
            const collectionName = target.path.split("/").at(-1);
            if (collectionName === invalidQuery) return { size: 2 };
            return { size: references[collectionName] ? 1 : 0 };
          }
          if (target.path === "System/system") return snapshot(system);
          if (target.path.includes("/Users/")) return snapshot(actor);
          if (target.path.includes("/Sites_archive/")) return snapshot(archive);
          return snapshot(active);
        },
        create(reference, value) {
          const call = { method: "transaction.create", path: reference.path, value };
          calls.push(call);
          writes.push(call);
        },
        delete(reference) {
          const call = { method: "transaction.delete", path: reference.path };
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
    assert.ok(error instanceof SiteArchiveError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

function archivedEnvelope({
  site = validSite(),
  operationId = "operation-a",
  reason = "重複登録のため",
  actorUid = "actor-a",
} = {}) {
  return {
    schemaVersion: SITE_ARCHIVE_SCHEMA_VERSION,
    site,
    audit: {
      operationId,
      reason,
      actorUid,
      archivedAt: Timestamp.fromMillis(1_700_000_200_000),
    },
  };
}

test("Site archive input is exact, normalized, bounded, and path safe", () => {
  assert.deepEqual(
    parseSiteArchiveInput({
      siteId: "  site-a  ",
      reason: "  重複登録  ",
      operationId: "  opaque-value:#?  ",
    }),
    { siteId: "site-a", reason: "重複登録", operationId: "opaque-value:#?" },
  );
  for (const input of [
    validInput({ siteId: "x" }),
    validInput({ siteId: "x".repeat(128) }),
    validInput({ operationId: "x" }),
    validInput({ operationId: "x".repeat(128) }),
    validInput({ reason: "x" }),
    validInput({ reason: "x".repeat(200) }),
  ]) assert.doesNotThrow(() => parseSiteArchiveInput(input));

  class Input { constructor() { Object.assign(this, validInput()); } }
  const symbolInput = validInput();
  symbolInput[Symbol("extra")] = true;
  for (const input of [
    {}, [], new Input(), { ...validInput(), extra: true },
    { siteId: "site-a", reason: "reason" },
    validInput({ siteId: " " }), validInput({ siteId: "x".repeat(129) }),
    validInput({ siteId: "unsafe/id" }), validInput({ operationId: " " }),
    validInput({ operationId: "unsafe/id" }),
    validInput({ operationId: "x".repeat(129) }), validInput({ reason: " " }),
    validInput({ reason: "x".repeat(201) }), validInput({ reason: 1 }), symbolInput,
  ]) {
    assert.throws(
      () => parseSiteArchiveInput(input),
      (error) => error instanceof SiteArchiveError &&
        error.code === SITE_ARCHIVE_ERROR_CODES.INVALID_INPUT,
    );
  }
});

test("strict Site archive actor matrix allows only administrators and known sites:write presets", async () => {
  for (const scenario of [
    { actor: admin, currentIdentity: identity },
    { actor: admin, currentIdentity: { ...identity, isSuperUser: true } },
    ...["manager", "controller", "legal"].map((role) => ({
      actor: { ...admin, isAdmin: false, roles: [role] },
      currentIdentity: identity,
    })),
  ]) {
    const { firestore, writes } = createFirestore({ actor: scenario.actor });
    assert.deepEqual(await archiveSite({
      firestore,
      identity: scenario.currentIdentity,
      input: validInput(),
    }), { success: true, archived: true });
    assert.equal(writes.length, 2);
  }

  for (const scenario of [
    { actor: { ...admin, isAdmin: false, roles: [] }, currentIdentity: identity },
    ...["accountant", "human-resource", "labor", "sites:write", "unknown-role"]
      .map((role) => ({
        actor: { ...admin, isAdmin: false, roles: [role] },
        currentIdentity: identity,
      })),
    { actor: { ...admin, isAdmin: false, roles: ["manager", "unknown-role"] }, currentIdentity: identity },
    { actor: { ...admin, isAdmin: false, roles: ["manager"] }, currentIdentity: { ...identity, isSuperUser: true } },
    { actor: { ...admin, isTemporary: true }, currentIdentity: identity },
    { actor: { ...admin, disabled: true }, currentIdentity: identity },
    { actor: { ...admin, companyId: "company-b" }, currentIdentity: identity },
    { actor: { ...admin, docId: "actor-b" }, currentIdentity: identity },
    { actor: { ...admin, roles: undefined, isAdmin: false }, currentIdentity: identity },
    { actor: null, currentIdentity: identity },
  ]) {
    const { firestore, writes } = createFirestore({ actor: scenario.actor });
    await rejectsCode(
      () => archiveSite({ firestore, identity: scenario.currentIdentity, input: validInput() }),
      SITE_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED,
    );
    assert.deepEqual(writes, []);
  }
});

test("ACTIVE and TERMINATED Sites archive after every direct reference read and no Company order read", async () => {
  for (const status of ["ACTIVE", "TERMINATED"]) {
    const site = validSite({ status });
    const sentinel = FieldValue.serverTimestamp();
    const { calls, firestore, writes } = createFirestore({ active: site });
    assert.deepEqual(await archiveSite({
      firestore,
      identity,
      input: validInput(),
      serverTimestampFactory: () => sentinel,
    }), { success: true, archived: true });

    assert.deepEqual(
      calls.filter(({ method }) => method === "transaction.get").map(({ path }) => path),
      [
        "System/system",
        "Companies/company-a/Users/actor-a",
        "Companies/company-a/Sites/site-a",
        "Companies/company-a/Sites_archive/site-a",
        ...REFERENCES.map((name) => `Companies/company-a/${name}`),
      ],
    );
    assert.equal(calls.some(({ path }) => path === "Companies/company-a"), false);
    assert.equal(
      calls.findIndex(({ method }) => method === "transaction.create") >
        calls.findLastIndex(({ method }) => method === "transaction.get"),
      true,
    );
    assert.deepEqual(writes.map(({ method }) => method), [
      "transaction.create", "transaction.delete",
    ]);
    assert.equal(writes[0].path, "Companies/company-a/Sites_archive/site-a");
    assert.equal(writes[1].path, "Companies/company-a/Sites/site-a");
    assert.deepEqual(Object.keys(writes[0].value).sort(), ["audit", "schemaVersion", "site"]);
    assert.deepEqual(Object.keys(writes[0].value.audit).sort(), [
      "actorUid", "archivedAt", "operationId", "reason",
    ]);
    assert.deepEqual(writes[0].value.site, site);
    assert.notEqual(writes[0].value.site, site);
  }
});

test("each of the exact five direct reference collections and mixed references block with write zero", async () => {
  for (const references of [
    ...REFERENCES.map((name) => ({ [name]: true })),
    Object.fromEntries(REFERENCES.map((name) => [name, true])),
  ]) {
    const { calls, firestore, writes } = createFirestore({ references });
    await rejectsCode(
      () => archiveSite({ firestore, identity, input: validInput() }),
      SITE_ARCHIVE_ERROR_CODES.REFERENCES_EXIST,
    );
    assert.deepEqual(writes, []);
    assert.deepEqual(
      calls.filter(({ method }) => method === "transaction.get")
        .map(({ path }) => path).slice(-REFERENCES.length),
      REFERENCES.map((name) => `Companies/company-a/${name}`),
    );
  }
});

test("missing, malformed, maintenance, and invalid query states fail with write zero", async () => {
  const missingField = validSite();
  delete missingField.name;
  for (const [options, code] of [
    [{ active: null }, SITE_ARCHIVE_ERROR_CODES.SITE_NOT_FOUND],
    [{ active: missingField }, SITE_ARCHIVE_ERROR_CODES.SITE_INVALID],
    [{ active: validSite({ docId: "site-b" }) }, SITE_ARCHIVE_ERROR_CODES.SITE_INVALID],
    [{ system: null }, SITE_ARCHIVE_ERROR_CODES.MAINTENANCE],
    [{ system: { isMaintenance: true } }, SITE_ARCHIVE_ERROR_CODES.MAINTENANCE],
    [{ system: { isMaintenance: "false" } }, SITE_ARCHIVE_ERROR_CODES.MAINTENANCE],
    [{ invalidQuery: REFERENCES[0] }, SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY],
  ]) {
    const { firestore, writes } = createFirestore(options);
    await rejectsCode(() => archiveSite({ firestore, identity, input: validInput() }), code);
    assert.deepEqual(writes, []);
  }
});

test("same operation retry is idempotent while archive collisions never overwrite", async () => {
  const matching = archivedEnvelope();
  {
    const { firestore, writes } = createFirestore({ active: null, archive: matching });
    assert.deepEqual(await archiveSite({ firestore, identity, input: validInput() }), {
      success: true,
      archived: true,
    });
    assert.deepEqual(writes, []);
  }
  for (const archive of [
    archivedEnvelope({ operationId: "operation-b" }),
    archivedEnvelope({ actorUid: "actor-b" }),
    archivedEnvelope({ reason: "別理由" }),
  ]) {
    const { firestore, writes } = createFirestore({ active: null, archive });
    await rejectsCode(
      () => archiveSite({ firestore, identity, input: validInput() }),
      SITE_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT,
    );
    assert.deepEqual(writes, []);
  }
  {
    const { firestore, writes } = createFirestore({ active: validSite(), archive: matching });
    await rejectsCode(
      () => archiveSite({ firestore, identity, input: validInput() }),
      SITE_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT,
    );
    assert.deepEqual(writes, []);
  }
  for (const archive of [
    { ...matching, extra: true },
    { ...matching, schemaVersion: 2 },
    { ...matching, audit: { ...matching.audit, archivedAt: { seconds: 1 } } },
  ]) {
    const { firestore, writes } = createFirestore({ active: null, archive });
    await rejectsCode(
      () => archiveSite({ firestore, identity, input: validInput() }),
      SITE_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID,
    );
    assert.deepEqual(writes, []);
  }
});

test("archive snapshot and envelope contracts are exact and use a server timestamp only for new writes", () => {
  const site = validSite({ scheduleRevision: 2 });
  const sentinel = FieldValue.serverTimestamp();
  assert.equal(isValidSiteArchiveSnapshot(site, "site-a"), true);
  assert.deepEqual(
    Object.keys(site).filter((key) => !SITE_ARCHIVE_SITE_FIELDS.includes(key)),
    ["scheduleRevision"],
  );
  const envelope = buildSiteArchiveEnvelope({
    site,
    siteId: "site-a",
    operationId: "operation-a",
    reason: "重複登録のため",
    actorUid: "actor-a",
    archivedAt: sentinel,
  });
  assert.equal(envelope.schemaVersion, SITE_ARCHIVE_SCHEMA_VERSION);
  assert.notEqual(envelope.site, site);
  assert.equal(isValidSiteArchiveEnvelope({
    ...envelope,
    audit: { ...envelope.audit, archivedAt: Timestamp.fromMillis(1) },
  }, "site-a"), true);
  assert.equal(isValidSiteArchiveEnvelope(envelope, "site-a"), false);
  for (const invalid of [
    { ...site, unexpected: true },
    { ...site, name: null },
    { ...site, scheduleRevision: -1 },
    { ...site, status: "UNKNOWN" },
  ]) assert.equal(isValidSiteArchiveSnapshot(invalid, "site-a"), false);
});

test("invalid dependencies and transaction surfaces fail closed before any committed write", async () => {
  for (const dependencies of [
    { firestore: null, identity },
    { firestore: { doc() {}, collection() {} }, identity },
    { firestore: createFirestore().firestore, identity: null },
    { firestore: createFirestore().firestore, identity: { ...identity, uid: "actor/a" } },
    { firestore: createFirestore().firestore, identity: { ...identity, isSuperUser: "false" } },
  ]) {
    await rejectsCode(
      () => archiveSite({ ...dependencies, input: validInput() }),
      SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
    );
  }
  const { firestore, writes } = createFirestore();
  firestore.runTransaction = (callback) => callback({ get: async () => snapshot(null) });
  await rejectsCode(
    () => archiveSite({ firestore, identity, input: validInput() }),
    SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
  );
  assert.deepEqual(writes, []);
});
