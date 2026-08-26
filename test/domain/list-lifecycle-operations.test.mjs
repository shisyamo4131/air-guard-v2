import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { listLifecycleOperations } from "../../functions/modules/auth/lifecycle/listLifecycleOperations.js";
import {
  createEmployeeOnlyRetirementOperationRecord,
  createEmployeeReinstatementOperationRecord,
  createRegisteredUserDeletionOperationRecord,
  LIFECYCLE_AUTH_DISPOSITIONS,
  LIFECYCLE_CLEANUP_STATES,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_EVENT_PHASES,
  LIFECYCLE_OPERATION_STATES,
  LIFECYCLE_OPERATION_TYPES,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationSchema.js";

const functionsRequire = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { FieldPath, Timestamp } = functionsRequire("firebase-admin/firestore");

const COMPANY_ID = "company-a";
const ACTOR_UID = "actor-a";
const SOURCE_OPERATION_ID = "10000000-0000-4000-8000-000000000999";
const FINGERPRINT = "a".repeat(64);
const ITEM_FIELDS = [
  "actorDisplayName",
  "completedAt",
  "createdAt",
  "effectiveDate",
  "employeeId",
  "includesUserAccountDeletion",
  "operationType",
  "reason",
  "status",
  "subjectDisplayName",
];

function operationId(index) {
  return `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function timestamp(index = 0) {
  return Timestamp.fromDate(new Date(Date.UTC(2026, 7, 25, 0, index, 0)));
}

function actorUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    disabled: false,
    isAdmin: true,
    roles: [],
    ...overrides,
  };
}

function snapshot(id, data, exists = true) {
  return {
    id,
    exists,
    data: () => data,
  };
}

function employeeOnlyRetirement(index, overrides = {}) {
  const id = operationId(index);
  const at = overrides.createdAt ?? timestamp(index);
  return {
    id,
    data: createEmployeeOnlyRetirementOperationRecord({
      operationId: id,
      actorUid: ACTOR_UID,
      actorDisplayName: overrides.actorDisplayName ?? "管理者",
      employeeId: `employee-${index}`,
      terminationDate: "2026-08-24",
      reasonOfTermination: "本人都合",
      requestFingerprint: FINGERPRINT,
      timestamp: at,
    }),
  };
}

function reinstatement(index, overrides = {}) {
  const id = operationId(index);
  const at = overrides.createdAt ?? timestamp(index);
  return {
    id,
    data: createEmployeeReinstatementOperationRecord({
      operationId: id,
      actorUid: ACTOR_UID,
      actorDisplayName: overrides.actorDisplayName ?? "管理者",
      employeeId: `employee-${index}`,
      reversesOperationId: SOURCE_OPERATION_ID,
      correctionReasonCode: "MISTAKEN_RETIREMENT",
      requestFingerprint: FINGERPRINT,
      timestamp: at,
    }),
  };
}

function registeredDeletion(
  index,
  {
    operationType =
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION,
    state = LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING,
    cleanupState = LIFECYCLE_CLEANUP_STATES.PENDING,
    actorDisplayName = "管理者",
    createdAt = timestamp(index),
  } = {},
) {
  const id = operationId(index);
  const base = createRegisteredUserDeletionOperationRecord({
    operationId: id,
    operationType,
    actorUid: ACTOR_UID,
    actorDisplayName,
    employeeId:
      operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT
        ? `employee-${index}`
        : null,
    targetUserUid: `target-${index}`,
    targetDisplayName: "対象者",
    terminationDate:
      operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT
        ? "2026-08-24"
        : null,
    reasonOfTermination:
      operationType === LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT
        ? "本人都合"
        : null,
    offboardingReason:
      operationType ===
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION
        ? "利用終了"
        : null,
    requestFingerprint: FINGERPRINT,
    timestamp: createdAt,
  });

  const record = { ...base, state, cleanupState };
  if (state === LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE) {
    record.lastErrorPhase = LIFECYCLE_EVENT_PHASES.AUTH_DELETE;
    record.lastErrorCode = LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE;
  }
  if (state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED) {
    record.authDisposition = LIFECYCLE_AUTH_DISPOSITIONS.DELETED;
    record.authDeletedAt = createdAt;
    record.dataFinalizedAt = createdAt;
    if (cleanupState === LIFECYCLE_CLEANUP_STATES.FAILED) {
      record.lastErrorPhase = LIFECYCLE_EVENT_PHASES.FCM_CLEANUP;
      record.lastErrorCode = LIFECYCLE_DOMAIN_ERROR_CODES.UPSTREAM_UNAVAILABLE;
    }
  }
  if (state === LIFECYCLE_OPERATION_STATES.COMPLETED) {
    record.authDisposition = LIFECYCLE_AUTH_DISPOSITIONS.DELETED;
    record.cleanupState = LIFECYCLE_CLEANUP_STATES.COMPLETED;
    record.authDeletedAt = createdAt;
    record.dataFinalizedAt = createdAt;
    record.completedAt = createdAt;
  }
  return { id, data: record };
}

function firestoreFixture({
  actor = actorUser(),
  actorSequence = null,
  actorExists = true,
  actorSnapshotId = ACTOR_UID,
  pages = [[]],
  cursors = {},
} = {}) {
  const trace = [];
  let pageIndex = 0;
  let actorReadIndex = 0;
  const actorPath = `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`;

  return {
    trace,
    doc(path) {
      trace.push(["doc", path]);
      return {
        async get() {
          trace.push(["doc.get", path]);
          if (path === actorPath) {
            const actors = actorSequence ?? [actor];
            const currentActor =
              actors[Math.min(actorReadIndex, actors.length - 1)];
            actorReadIndex += 1;
            return snapshot(actorSnapshotId, currentActor, actorExists);
          }
          const cursor = path.split("/").at(-1);
          return cursors[cursor] ?? snapshot(cursor, undefined, false);
        },
      };
    },
    collection(path) {
      trace.push(["collection", path]);
      const query = {
        orderBy(field, direction) {
          trace.push(["orderBy", field, direction]);
          return this;
        },
        startAfter(anchor) {
          trace.push(["startAfter", anchor]);
          return this;
        },
        limit(value) {
          trace.push(["limit", value]);
          return this;
        },
        async get() {
          trace.push(["query.get"]);
          const page = pages[Math.min(pageIndex, pages.length - 1)] ?? [];
          pageIndex += 1;
          return { docs: page.map(({ id, data }) => snapshot(id, data)) };
        },
      };
      return query;
    },
  };
}

function request(firestore, input = { cursor: null }, identity = {}) {
  return listLifecycleOperations({
    firestore,
    identity: {
      uid: ACTOR_UID,
      companyId: COMPANY_ID,
      isSuperUser: false,
      ...identity,
    },
    input,
  });
}

test("history reader derives actor and operation paths from verified identity", async () => {
  const operation = employeeOnlyRetirement(1);
  const firestore = firestoreFixture({ pages: [[operation]] });

  await request(firestore);

  assert.deepEqual(firestore.trace[0], [
    "doc",
    `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`,
  ]);
  assert.equal(
    firestore.trace.some(
      (entry) =>
        entry[0] === "collection" &&
        entry[1] === `Companies/${COMPANY_ID}/LifecycleOperations`,
    ),
    true,
  );
  assert.equal(
    firestore.trace.some(
      (entry) => JSON.stringify(entry).includes("company-from-input"),
    ),
    false,
  );
  assert.equal(
    firestore.trace.some((entry) => entry[0] === "collectionGroup"),
    false,
  );
});

test("history reader accepts only an active registered same-company administrator", async () => {
  await assert.doesNotReject(request(firestoreFixture()));

  const deniedActors = [
    actorUser({ isAdmin: false, roles: ["manager"] }),
    actorUser({ isAdmin: false, roles: ["human-resource"] }),
    actorUser({ isAdmin: false, roles: ["users:write"] }),
    actorUser({ isTemporary: true }),
    actorUser({ disabled: true }),
    actorUser({ companyId: "company-b" }),
  ];
  for (const actor of deniedActors) {
    await assert.rejects(request(firestoreFixture({ actor })));
  }

  await assert.rejects(
    request(firestoreFixture(), { cursor: null }, { isSuperUser: true }),
    (error) => error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.ACTOR_NOT_ALLOWED,
  );
  await assert.rejects(
    request(firestoreFixture({ actorExists: false })),
    (error) =>
      error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
  );
  await assert.rejects(
    request(firestoreFixture({ actorSnapshotId: "stale-actor" })),
    (error) =>
      error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
  );
});

test("history reader rechecks actor after the page query and returns no stale-authority data", async () => {
  const operation = employeeOnlyRetirement(1);
  const revokedActors = [
    actorUser({ isAdmin: false }),
    actorUser({ disabled: true }),
    actorUser({ isTemporary: true }),
    actorUser({ companyId: "company-b" }),
  ];

  for (const revokedActor of revokedActors) {
    const firestore = firestoreFixture({
      actorSequence: [actorUser(), revokedActor],
      pages: [[operation]],
    });
    await assert.rejects(request(firestore));
    assert.equal(
      firestore.trace.filter(
        (entry) =>
          entry[0] === "doc.get" &&
          entry[1] === `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`,
      ).length,
      2,
    );
    assert.equal(
      firestore.trace.some((entry) => entry[0] === "query.get"),
      true,
    );
  }
});

test("history query is createdAt desc then document ID desc with fixed limit 21", async () => {
  const firestore = firestoreFixture();
  await request(firestore);

  const orderByCalls = firestore.trace.filter((entry) => entry[0] === "orderBy");
  assert.equal(orderByCalls.length, 2);
  assert.deepEqual(orderByCalls[0], ["orderBy", "createdAt", "desc"]);
  assert.equal(orderByCalls[1][2], "desc");
  assert.equal(orderByCalls[1][1].isEqual(FieldPath.documentId()), true);
  assert.deepEqual(
    firestore.trace.filter((entry) => entry[0] === "limit"),
    [["limit", 21]],
  );
});

test("history pagination returns 20 items and exposes a cursor only for a 21st item", async () => {
  const twenty = Array.from({ length: 20 }, (_, index) =>
    employeeOnlyRetirement(index + 1),
  );
  const twentyOne = [...twenty, employeeOnlyRetirement(21)];

  const noNext = await request(firestoreFixture({ pages: [twenty] }));
  assert.equal(noNext.items.length, 20);
  assert.equal(noNext.nextCursor, null);

  const withNext = await request(firestoreFixture({ pages: [twentyOne] }));
  assert.equal(withNext.items.length, 20);
  assert.equal(withNext.nextCursor, twenty[19].id);
  assert.equal(
    withNext.items.some((item) => item.employeeId === "employee-21"),
    false,
  );
});

test("same-createdAt records retain document-ID-desc query order", async () => {
  const at = timestamp(1);
  const high = employeeOnlyRetirement(2, {
    actorDisplayName: "高",
    createdAt: at,
  });
  const low = employeeOnlyRetirement(1, {
    actorDisplayName: "低",
    createdAt: at,
  });
  const result = await request(firestoreFixture({ pages: [[high, low]] }));

  assert.deepEqual(
    result.items.map((item) => item.actorDisplayName),
    ["高", "低"],
  );
  assert.equal(result.items[0].createdAt, result.items[1].createdAt);
});

test("cursor is validated under the derived tenant and replayed as a snapshot anchor", async () => {
  const cursorRecord = employeeOnlyRetirement(10);
  const pageRecord = employeeOnlyRetirement(9);
  const cursorSnapshot = snapshot(cursorRecord.id, cursorRecord.data);
  const firestore = firestoreFixture({
    pages: [[pageRecord], [pageRecord]],
    cursors: { [cursorRecord.id]: cursorSnapshot },
  });

  const first = await request(firestore, { cursor: cursorRecord.id });
  const replay = await request(firestore, { cursor: cursorRecord.id });
  assert.deepEqual(first, replay);
  assert.equal(
    firestore.trace.filter(
      (entry) =>
        entry[0] === "doc" &&
        entry[1] ===
          `Companies/${COMPANY_ID}/LifecycleOperations/${cursorRecord.id}`,
    ).length,
    2,
  );
  assert.equal(
    firestore.trace.filter(
      (entry) => entry[0] === "startAfter" && entry[1] === cursorSnapshot,
    ).length,
    2,
  );
});

test("missing, other-tenant, and unusable cursors share the invalid-input boundary", async () => {
  const cursorErrors = [];
  const isUniformInvalidInput = (error) => {
    cursorErrors.push(error);
    return error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.INVALID_INPUT;
  };
  const missing = operationId(50);
  await assert.rejects(
    request(firestoreFixture(), { cursor: missing }),
    isUniformInvalidInput,
  );

  const otherTenantRecord = employeeOnlyRetirement(51);
  const otherTenant = firestoreFixture({
    cursors: {
      [otherTenantRecord.id]: snapshot(
        otherTenantRecord.id,
        otherTenantRecord.data,
        false,
      ),
    },
  });
  await assert.rejects(
    request(otherTenant, { cursor: otherTenantRecord.id }),
    isUniformInvalidInput,
  );

  const unusable = employeeOnlyRetirement(52);
  const unusableRecord = { ...unusable.data, operationId: operationId(53) };
  await assert.rejects(
    request(
      firestoreFixture({
        cursors: {
          [unusable.id]: snapshot(unusable.id, unusableRecord),
        },
      }),
      { cursor: unusable.id },
    ),
    isUniformInvalidInput,
  );

  const corruptSchema = employeeOnlyRetirement(54);
  await assert.rejects(
    request(
      firestoreFixture({
        cursors: {
          [corruptSchema.id]: snapshot(corruptSchema.id, {
            ...corruptSchema.data,
            internalExtra: true,
          }),
        },
      }),
      { cursor: corruptSchema.id },
    ),
    isUniformInvalidInput,
  );
  assert.equal(
    new Set(
      cursorErrors.map(
        (error) => `${error.name}|${error.domainCode}|${error.message}`,
      ),
    ).size,
    1,
  );
});

test("every valid internal lifecycle state maps to one public status", async () => {
  const operations = [
    registeredDeletion(101, {
      state: LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING,
    }),
    registeredDeletion(102, {
      state: LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED,
    }),
    registeredDeletion(103, {
      state: LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT,
    }),
    registeredDeletion(104, {
      state: LIFECYCLE_OPERATION_STATES.DATA_FINALIZED,
      cleanupState: LIFECYCLE_CLEANUP_STATES.PENDING,
    }),
    registeredDeletion(105, {
      state: LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE,
    }),
    registeredDeletion(106, {
      state: LIFECYCLE_OPERATION_STATES.DATA_FINALIZED,
      cleanupState: LIFECYCLE_CLEANUP_STATES.FAILED,
    }),
    registeredDeletion(107, {
      state: LIFECYCLE_OPERATION_STATES.COMPLETED,
    }),
  ];
  const result = await request(firestoreFixture({ pages: [operations] }));

  assert.deepEqual(
    result.items.map((item) => item.status),
    [
      "processing",
      "processing",
      "processing",
      "processing",
      "retrying",
      "retrying",
      "completed",
    ],
  );
  assert.deepEqual(
    result.items.map((item) => item.includesUserAccountDeletion),
    Array(7).fill(true),
  );
  assert.equal(result.items.slice(0, 6).every((item) => item.completedAt === null), true);
  assert.notEqual(result.items[6].completedAt, null);
});

test("projection is exact, type-specific, and excludes internal identifiers and state", async () => {
  const retirement = registeredDeletion(201, {
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
    state: LIFECYCLE_OPERATION_STATES.COMPLETED,
  });
  const standalone = registeredDeletion(202, {
    state: LIFECYCLE_OPERATION_STATES.COMPLETED,
  });
  const correction = reinstatement(203);
  const result = await request(
    firestoreFixture({ pages: [[retirement, standalone, correction]] }),
  );

  assert.deepEqual(Object.keys(result).sort(), [
    "items",
    "nextCursor",
    "schemaVersion",
  ]);
  assert.equal(result.schemaVersion, 1);
  for (const item of result.items) {
    assert.deepEqual(Object.keys(item).sort(), ITEM_FIELDS);
  }
  assert.deepEqual(result.items[0], {
    operationType: "employee-retirement",
    status: "completed",
    actorDisplayName: "管理者",
    employeeId: "employee-201",
    subjectDisplayName: null,
    includesUserAccountDeletion: true,
    effectiveDate: "2026-08-24",
    reason: "本人都合",
    createdAt: timestamp(201).toDate().toISOString(),
    completedAt: timestamp(201).toDate().toISOString(),
  });
  assert.equal(result.items[1].employeeId, null);
  assert.equal(result.items[1].subjectDisplayName, "対象者");
  assert.equal(result.items[1].includesUserAccountDeletion, true);
  assert.equal(result.items[2].includesUserAccountDeletion, false);
  assert.equal(result.items[2].reason, null);

  const serialized = JSON.stringify(result.items);
  for (const forbidden of [
    "operationId",
    "actorUid",
    "targetUserUid",
    "requestFingerprint",
    "cleanupState",
    "authDisposition",
    "attemptCount",
    "lastErrorCode",
    "reversesOperationId",
    "target-201",
    FINGERPRINT,
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("a malformed Timestamp, schema, or document ID rejects the whole page", async () => {
  const valid = employeeOnlyRetirement(301);
  const invalidTimestamp = {
    ...employeeOnlyRetirement(302),
    data: {
      ...employeeOnlyRetirement(302).data,
      createdAt: new Date("2026-08-25T00:00:00.000Z"),
    },
  };
  const invalidSchema = {
    ...employeeOnlyRetirement(303),
    data: { ...employeeOnlyRetirement(303).data, secret: "must-fail" },
  };
  const mismatchedId = {
    ...employeeOnlyRetirement(304),
    id: operationId(305),
  };

  for (const malformed of [invalidTimestamp, invalidSchema, mismatchedId]) {
    await assert.rejects(
      request(firestoreFixture({ pages: [[valid, malformed]] })),
    );
  }
});

test("the look-ahead 21st document is validated before it is excluded", async () => {
  const firstTwenty = Array.from({ length: 20 }, (_, index) =>
    employeeOnlyRetirement(500 + index),
  );
  const malformedTwentyFirst = employeeOnlyRetirement(520);
  malformedTwentyFirst.data = {
    ...malformedTwentyFirst.data,
    updatedAt: { seconds: 1_777_000_000, nanoseconds: 0 },
  };

  await assert.rejects(
    request(
      firestoreFixture({
        pages: [[...firstTwenty, malformedTwentyFirst]],
      }),
    ),
    (error) => error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL,
  );
});

test("every non-null internal operation timestamp requires a Firestore Timestamp", async () => {
  const completed = registeredDeletion(401, {
    state: LIFECYCLE_OPERATION_STATES.COMPLETED,
  });
  const plainTimestamp = { seconds: 1_777_000_000, nanoseconds: 0 };

  for (const field of [
    "createdAt",
    "updatedAt",
    "authDeletedAt",
    "dataFinalizedAt",
    "completedAt",
  ]) {
    const malformed = {
      id: completed.id,
      data: { ...completed.data, [field]: plainTimestamp },
    };
    await assert.rejects(
      request(firestoreFixture({ pages: [[malformed]] })),
      (error) => error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL,
      field,
    );

    await assert.rejects(
      request(
        firestoreFixture({
          cursors: {
            [completed.id]: snapshot(completed.id, malformed.data),
          },
        }),
        { cursor: completed.id },
      ),
      (error) => error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.INVALID_INPUT,
      `cursor ${field}`,
    );
  }
});
