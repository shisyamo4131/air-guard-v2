import assert from "node:assert/strict";
import test from "node:test";

import {
  updateOwnUserProfile,
  updateUserNotificationSettings,
  updateUserRoles,
  USER_FIELD_UPDATE_ERROR_CODES,
  UserFieldUpdateError,
} from "../../functions/modules/auth/updateUserFields.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "actor-a";
const TARGET_UID = "target-a";
const TARGET_LOCK_PATH =
  `Companies/${COMPANY_ID}/UserLifecycleLocks/${TARGET_UID}`;

function actor(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    roles: ["manager"],
    ...overrides,
  };
}

function target(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    roles: [],
    ...overrides,
  };
}

function dependencies({ actorUser = actor(), targetUser = target() } = {}) {
  const calls = [];
  const documents = new Map([
    [`Companies/${COMPANY_ID}/Users/${ACTOR_UID}`, actorUser],
    [`Companies/${COMPANY_ID}/Users/${TARGET_UID}`, targetUser],
  ]);
  const firestore = {
    doc(path) {
      calls.push({ method: "doc", path });
      return { path };
    },
    async runTransaction(callback) {
      calls.push({ method: "runTransaction" });
      return callback({
        async get(reference) {
          calls.push({ method: "get", path: reference.path });
          const data = documents.get(reference.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(reference, updates) {
          calls.push({ method: "update", path: reference.path, updates });
        },
      });
    },
  };
  return { firestore, calls, documents };
}

test("own profile writes only displayName and tagSize to the actor document", async () => {
  const deps = dependencies();
  const result = await updateOwnUserProfile({
    firestore: deps.firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    input: { displayName: "新表示", tagSize: "LARGE" },
  });
  assert.deepEqual(result, { success: true, userId: ACTOR_UID });
  assert.deepEqual(deps.calls.at(-1), {
    method: "update",
    path: `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`,
    updates: { displayName: "新表示", tagSize: "LARGE" },
  });
});

test("notification settings write only the three notification flags", async () => {
  const deps = dependencies();
  await updateUserNotificationSettings({
    firestore: deps.firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    input: {
      targetUserId: TARGET_UID,
      receiveConfirmedArrangementNotification: true,
      receiveArrivedArrangementNotification: false,
      receiveLeavedArrangementNotification: true,
    },
  });
  assert.deepEqual(deps.calls.at(-1), {
    method: "update",
    path: `Companies/${COMPANY_ID}/Users/${TARGET_UID}`,
    updates: {
      receiveConfirmedArrangementNotification: true,
      receiveArrivedArrangementNotification: false,
      receiveLeavedArrangementNotification: true,
    },
  });
});

test("role updates write only a copied roles array", async () => {
  const deps = dependencies();
  await updateUserRoles({
    firestore: deps.firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    input: {
      targetUserId: TARGET_UID,
      expectedRoles: [],
      roles: ["controller"],
    },
  });
  assert.deepEqual(deps.calls.at(-1), {
    method: "update",
    path: `Companies/${COMPANY_ID}/Users/${TARGET_UID}`,
    updates: { roles: ["controller"] },
  });
});

test("role updates reject stale roles and active lifecycle operations", async () => {
  const stale = dependencies({ targetUser: target({ roles: ["manager"] }) });
  await assert.rejects(
    updateUserRoles({
      firestore: stale.firestore,
      companyId: COMPANY_ID,
      actorUid: ACTOR_UID,
      input: {
        targetUserId: TARGET_UID,
        expectedRoles: [],
        roles: ["controller"],
      },
    }),
    (error) => error?.code === "target-roles-stale",
  );
  assert.equal(stale.calls.some((call) => call.method === "update"), false);

  const locked = dependencies();
  locked.documents.set(TARGET_LOCK_PATH, { operationId: "operation-a" });
  await assert.rejects(
    updateUserRoles({
      firestore: locked.firestore,
      companyId: COMPANY_ID,
      actorUid: ACTOR_UID,
      input: {
        targetUserId: TARGET_UID,
        expectedRoles: [],
        roles: ["controller"],
      },
    }),
    (error) =>
      error instanceof UserFieldUpdateError &&
      error.code ===
        USER_FIELD_UPDATE_ERROR_CODES.TARGET_LIFECYCLE_OPERATION_ACTIVE,
  );
  assert.equal(locked.calls.some((call) => call.method === "update"), false);
});

test("missing actor or target documents fail before any write", async () => {
  for (const missingPath of [
    `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`,
    `Companies/${COMPANY_ID}/Users/${TARGET_UID}`,
  ]) {
    const deps = dependencies();
    deps.documents.delete(missingPath);
    await assert.rejects(
      updateUserNotificationSettings({
        firestore: deps.firestore,
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        input: {
          targetUserId: TARGET_UID,
          receiveConfirmedArrangementNotification: false,
          receiveArrivedArrangementNotification: false,
          receiveLeavedArrangementNotification: false,
        },
      }),
      (error) => {
        assert.ok(error instanceof UserFieldUpdateError);
        assert.ok([
          USER_FIELD_UPDATE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
          USER_FIELD_UPDATE_ERROR_CODES.TARGET_USER_NOT_FOUND,
        ].includes(error.code));
        return true;
      },
    );
    assert.equal(deps.calls.some((call) => call.method === "update"), false);
  }
});

test("invalid dependencies and identifiers fail before transaction start", async () => {
  const deps = dependencies();
  await assert.rejects(
    updateOwnUserProfile({
      firestore: deps.firestore,
      companyId: "company/a",
      actorUid: ACTOR_UID,
      input: { displayName: "利用者", tagSize: "MEDIUM" },
    }),
    (error) =>
      error instanceof UserFieldUpdateError &&
      error.code === USER_FIELD_UPDATE_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assert.equal(deps.calls.length, 0);
});
