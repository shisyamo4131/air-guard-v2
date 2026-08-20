import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteTemporaryUser,
  DELETE_TEMPORARY_USER_ERROR_CODES,
  DeleteTemporaryUserError,
} from "../../functions/modules/auth/deleteTemporaryUser.js";
import { createUserEmailReservationId } from "../../functions/modules/auth/createTemporaryUser.js";
import { TemporaryUserManagementPolicyError } from "../../functions/modules/auth/temporaryUserManagementPolicy.js";
import { TemporaryUserDeletionPolicyError } from "../../functions/modules/auth/temporaryUserDeletionPolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "actor-a";
const TARGET_USER_ID = "temporary-a";
const TARGET_EMAIL = "temporary@example.com";
const EMAIL_RESERVATION_PATH =
  `UserEmailReservations/${createUserEmailReservationId(TARGET_EMAIL)}`;
const EMPLOYEE_RESERVATION_PATH =
  `Companies/${COMPANY_ID}/EmployeeUserReservations/employee-a`;

function createActorUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    isAdmin: true,
    disabled: false,
    roles: [],
    ...overrides,
  };
}

function createTargetUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    email: TARGET_EMAIL,
    isTemporary: true,
    isAdmin: false,
    disabled: false,
    ...overrides,
  };
}

function createFirestore({
  actorUser,
  targetUser,
  emailReservation,
  employeeReservation,
} = {}) {
  const deletes = [];
  const reads = [];
  const resolvedTargetUser = targetUser ?? createTargetUser();
  const resolvedEmailReservation =
    emailReservation === undefined
      ? { companyId: COMPANY_ID, userId: TARGET_USER_ID }
      : emailReservation;
  const resolvedEmployeeReservation =
    employeeReservation === undefined
      ? { userId: TARGET_USER_ID }
      : employeeReservation;
  const snapshots = new Map([
    [
      `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`,
      actorUser === null
        ? { exists: false }
        : { exists: true, data: () => actorUser ?? createActorUser() },
    ],
    [
      `Companies/${COMPANY_ID}/Users/${TARGET_USER_ID}`,
      targetUser === null
        ? { exists: false }
        : { exists: true, data: () => resolvedTargetUser },
    ],
    [
      EMAIL_RESERVATION_PATH,
      resolvedEmailReservation === null
        ? { exists: false }
        : { exists: true, data: () => resolvedEmailReservation },
    ],
    [
      EMPLOYEE_RESERVATION_PATH,
      resolvedEmployeeReservation === null
        ? { exists: false }
        : { exists: true, data: () => resolvedEmployeeReservation },
    ],
  ]);

  const transaction = {
    async get(reference) {
      reads.push(reference.path);
      return snapshots.get(reference.path) ?? { exists: false };
    },
    delete(reference) {
      deletes.push(reference.path);
      snapshots.set(reference.path, { exists: false });
    },
  };

  return {
    deletes,
    reads,
    doc(path) {
      return { path };
    },
    async runTransaction(callback) {
      return callback(transaction);
    },
  };
}

test("an administrator deletes only a standalone temporary User", async () => {
  const firestore = createFirestore();

  const result = await deleteTemporaryUser({
    firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    targetUserId: TARGET_USER_ID,
  });

  assert.deepEqual(result, {
    success: true,
    userId: TARGET_USER_ID,
    linkType: "standalone",
    employeeId: null,
  });
  assert.deepEqual(firestore.deletes, [
    `Companies/${COMPANY_ID}/Users/${TARGET_USER_ID}`,
    EMAIL_RESERVATION_PATH,
  ]);
  assert.equal(firestore.reads.includes(EMPLOYEE_RESERVATION_PATH), false);
});

test("a users:write actor deletes only an Employee-linked temporary User", async () => {
  const firestore = createFirestore({
    actorUser: createActorUser({ isAdmin: false, roles: ["manager"] }),
    targetUser: createTargetUser({ employeeId: "employee-a" }),
  });

  const result = await deleteTemporaryUser({
    firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    targetUserId: TARGET_USER_ID,
  });

  assert.deepEqual(result, {
    success: true,
    userId: TARGET_USER_ID,
    linkType: "employee-linked",
    employeeId: "employee-a",
  });
  assert.deepEqual(firestore.deletes, [
    `Companies/${COMPANY_ID}/Users/${TARGET_USER_ID}`,
    EMAIL_RESERVATION_PATH,
    EMPLOYEE_RESERVATION_PATH,
  ]);
});

test("invalid required inputs and document IDs are rejected", async () => {
  const base = {
    firestore: createFirestore(),
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    targetUserId: TARGET_USER_ID,
  };

  for (const input of [
    undefined,
    { ...base, companyId: "" },
    { ...base, actorUid: "" },
    { ...base, targetUserId: "" },
  ]) {
    await assert.rejects(
      () => deleteTemporaryUser(input),
      (error) => {
        assert.ok(error instanceof DeleteTemporaryUserError);
        assert.equal(
          error.code,
          DELETE_TEMPORARY_USER_ERROR_CODES.REQUIRED_FIELD_MISSING,
        );
        return true;
      },
    );
  }

  for (const input of [
    { ...base, companyId: " company-a" },
    { ...base, actorUid: "actor/a" },
    { ...base, targetUserId: "temporary-a " },
  ]) {
    await assert.rejects(
      () => deleteTemporaryUser(input),
      (error) => {
        assert.ok(error instanceof DeleteTemporaryUserError);
        assert.equal(
          error.code,
          DELETE_TEMPORARY_USER_ERROR_CODES.IDENTIFIER_INVALID,
        );
        return true;
      },
    );
  }
});

test("an invalid Firestore service is rejected", async () => {
  for (const firestore of [undefined, {}, { doc() {} }]) {
    await assert.rejects(
      () =>
        deleteTemporaryUser({
          firestore,
          companyId: COMPANY_ID,
          actorUid: ACTOR_UID,
          targetUserId: TARGET_USER_ID,
        }),
      (error) => {
        assert.ok(error instanceof DeleteTemporaryUserError);
        assert.equal(
          error.code,
          DELETE_TEMPORARY_USER_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
        );
        return true;
      },
    );
  }
});

test("missing actor and target documents are rejected without deletion", async () => {
  for (const [options, code] of [
    [
      { actorUser: null },
      DELETE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND,
    ],
    [
      { targetUser: null },
      DELETE_TEMPORARY_USER_ERROR_CODES.TARGET_USER_NOT_FOUND,
    ],
  ]) {
    const firestore = createFirestore(options);
    await assert.rejects(
      () =>
        deleteTemporaryUser({
          firestore,
          companyId: COMPANY_ID,
          actorUid: ACTOR_UID,
          targetUserId: TARGET_USER_ID,
        }),
      (error) => {
        assert.ok(error instanceof DeleteTemporaryUserError);
        assert.equal(error.code, code);
        return true;
      },
    );
    assert.deepEqual(firestore.deletes, []);
  }
});

test("actor authorization failures are preserved without deletion", async () => {
  const firestore = createFirestore({
    actorUser: createActorUser({ isAdmin: false, roles: ["labor"] }),
  });

  await assert.rejects(
    () =>
      deleteTemporaryUser({
        firestore,
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_USER_ID,
      }),
    TemporaryUserManagementPolicyError,
  );
  assert.deepEqual(firestore.reads, [
    `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`,
  ]);
  assert.deepEqual(firestore.deletes, []);
});

test("target policy failures are preserved without deletion", async () => {
  const firestore = createFirestore({
    targetUser: createTargetUser({ isTemporary: false }),
  });

  await assert.rejects(
    () =>
      deleteTemporaryUser({
        firestore,
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_USER_ID,
      }),
    TemporaryUserDeletionPolicyError,
  );
  assert.deepEqual(firestore.deletes, []);
});

test("invalid target email fails before reservation reads", async () => {
  for (const email of [undefined, null, "invalid", "a".repeat(51)]) {
    const firestore = createFirestore({
      targetUser: createTargetUser({ email }),
    });
    await assert.rejects(
      () =>
        deleteTemporaryUser({
          firestore,
          companyId: COMPANY_ID,
          actorUid: ACTOR_UID,
          targetUserId: TARGET_USER_ID,
        }),
      (error) => {
        assert.ok(error instanceof DeleteTemporaryUserError);
        assert.equal(
          error.code,
          DELETE_TEMPORARY_USER_ERROR_CODES.TARGET_EMAIL_INVALID,
        );
        return true;
      },
    );
    assert.equal(firestore.reads.includes(EMAIL_RESERVATION_PATH), false);
    assert.deepEqual(firestore.deletes, []);
  }
});

test("email reservation must exist and point exactly to the target", async () => {
  const cases = [
    [null, DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_NOT_FOUND],
    [[], DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_INVALID],
    [
      { companyId: COMPANY_ID },
      DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_INVALID,
    ],
    [
      { companyId: COMPANY_ID, userId: TARGET_USER_ID, extra: true },
      DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_INVALID,
    ],
    [
      { companyId: "company-b", userId: TARGET_USER_ID },
      DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_MISMATCH,
    ],
    [
      { companyId: COMPANY_ID, userId: "another-user" },
      DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_MISMATCH,
    ],
  ];

  for (const [emailReservation, code] of cases) {
    const firestore = createFirestore({ emailReservation });
    await assert.rejects(
      () =>
        deleteTemporaryUser({
          firestore,
          companyId: COMPANY_ID,
          actorUid: ACTOR_UID,
          targetUserId: TARGET_USER_ID,
        }),
      (error) => error instanceof DeleteTemporaryUserError && error.code === code,
    );
    assert.deepEqual(firestore.deletes, []);
  }
});

test("Employee reservation must exist and point exactly to the linked target", async () => {
  const cases = [
    [null, DELETE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_NOT_FOUND],
    [[], DELETE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_INVALID],
    [
      { userId: TARGET_USER_ID, extra: true },
      DELETE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_INVALID,
    ],
    [
      { userId: "another-user" },
      DELETE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_MISMATCH,
    ],
  ];

  for (const [employeeReservation, code] of cases) {
    const firestore = createFirestore({
      targetUser: createTargetUser({ employeeId: "employee-a" }),
      employeeReservation,
    });
    await assert.rejects(
      () =>
        deleteTemporaryUser({
          firestore,
          companyId: COMPANY_ID,
          actorUid: ACTOR_UID,
          targetUserId: TARGET_USER_ID,
        }),
      (error) => error instanceof DeleteTemporaryUserError && error.code === code,
    );
    assert.deepEqual(firestore.deletes, []);
  }
});

test("mixed-case target email resolves the canonical reservation path", async () => {
  const firestore = createFirestore({
    targetUser: createTargetUser({ email: " Temporary@Example.COM " }),
  });
  await deleteTemporaryUser({
    firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    targetUserId: TARGET_USER_ID,
  });
  assert.equal(firestore.reads.includes(EMAIL_RESERVATION_PATH), true);
});

test("an actor cannot delete its own registered User document", async () => {
  const firestore = createFirestore();

  await assert.rejects(
    () =>
      deleteTemporaryUser({
        firestore,
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: ACTOR_UID,
      }),
    TemporaryUserDeletionPolicyError,
  );
  assert.deepEqual(firestore.deletes, []);
});

test("retry after deletion reports the missing target without another delete", async () => {
  const firestore = createFirestore();
  const input = {
    firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    targetUserId: TARGET_USER_ID,
  };

  await deleteTemporaryUser(input);

  await assert.rejects(
    () => deleteTemporaryUser(input),
    (error) => {
      assert.ok(error instanceof DeleteTemporaryUserError);
      assert.equal(
        error.code,
        DELETE_TEMPORARY_USER_ERROR_CODES.TARGET_USER_NOT_FOUND,
      );
      return true;
    },
  );
  assert.deepEqual(firestore.deletes, [
    `Companies/${COMPANY_ID}/Users/${TARGET_USER_ID}`,
    EMAIL_RESERVATION_PATH,
  ]);
});
