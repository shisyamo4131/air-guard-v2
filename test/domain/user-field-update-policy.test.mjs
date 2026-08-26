import assert from "node:assert/strict";
import test from "node:test";

import {
  assertManagedUserUpdatePolicy,
  assertOwnProfileUpdatePolicy,
  assertUserRolesUpdatePolicy,
  resolveOwnUserProfileUpdate,
  resolveUserNotificationSettingsUpdate,
  resolveUserRolesUpdate,
  USER_FIELD_UPDATE_POLICY_ERROR_CODES,
  UserFieldUpdatePolicyError,
} from "../../functions/modules/auth/policies/userFieldUpdatePolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "actor-a";
const TARGET_UID = "target-a";

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

function notifications(overrides = {}) {
  return {
    targetUserId: TARGET_UID,
    receiveConfirmedArrangementNotification: true,
    receiveArrivedArrangementNotification: false,
    receiveLeavedArrangementNotification: true,
    ...overrides,
  };
}

function assertPolicyError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof UserFieldUpdatePolicyError);
    assert.equal(error.code, code);
    return true;
  });
}

test("own profile accepts exactly displayName and tagSize", () => {
  assert.deepEqual(
    resolveOwnUserProfileUpdate({ displayName: "利用者", tagSize: "SMALL" }),
    { displayName: "利用者", tagSize: "SMALL" },
  );
});

test("own profile rejects protected, missing, and invalid fields", () => {
  assertPolicyError(
    () =>
      resolveOwnUserProfileUpdate({
        displayName: "利用者",
        tagSize: "SMALL",
        roles: ["manager"],
      }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.INPUT_INVALID,
  );
  assertPolicyError(
    () => resolveOwnUserProfileUpdate({ displayName: "利用者" }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.INPUT_INVALID,
  );
  assertPolicyError(
    () =>
      resolveOwnUserProfileUpdate({ displayName: " 田中", tagSize: "SMALL" }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.DISPLAY_NAME_INVALID,
  );
  assertPolicyError(
    () =>
      resolveOwnUserProfileUpdate({ displayName: "利用者", tagSize: "HUGE" }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.TAG_SIZE_INVALID,
  );
});

test("notification settings require exactly three boolean flags and target ID", () => {
  assert.deepEqual(
    resolveUserNotificationSettingsUpdate(notifications()),
    notifications(),
  );
  assertPolicyError(
    () =>
      resolveUserNotificationSettingsUpdate(
        notifications({ disabled: true }),
      ),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.INPUT_INVALID,
  );
  assertPolicyError(
    () =>
      resolveUserNotificationSettingsUpdate(
        notifications({ receiveArrivedArrangementNotification: "false" }),
      ),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.NOTIFICATION_FLAG_INVALID,
  );
});

test("role updates accept known unique presets only", () => {
  assert.deepEqual(
    resolveUserRolesUpdate({
      targetUserId: TARGET_UID,
      roles: ["manager", "human-resource"],
    }),
    { targetUserId: TARGET_UID, roles: ["manager", "human-resource"] },
  );
  assertPolicyError(
    () => resolveUserRolesUpdate({ targetUserId: TARGET_UID, roles: ["root"] }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.ROLE_INVALID,
  );
  assertPolicyError(
    () =>
      resolveUserRolesUpdate({
        targetUserId: TARGET_UID,
        roles: ["manager", "manager"],
      }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.ROLE_DUPLICATED,
  );
});

test("own profile requires an active registered same-company actor", () => {
  assert.doesNotThrow(() =>
    assertOwnProfileUpdatePolicy({ companyId: COMPANY_ID, actorUser: actor() }),
  );
  assert.throws(() =>
    assertOwnProfileUpdatePolicy({
      companyId: COMPANY_ID,
      actorUser: actor({ isTemporary: true }),
    }),
  );
  assertPolicyError(
    () =>
      assertOwnProfileUpdatePolicy({
        companyId: COMPANY_ID,
        actorUser: actor({ disabled: true }),
      }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.USER_NOT_ACTIVE,
  );
});

test("managed fields require administrator or strict users:write preset", () => {
  assert.doesNotThrow(() =>
    assertManagedUserUpdatePolicy({
      companyId: COMPANY_ID,
      actorUser: actor(),
      targetUser: target(),
    }),
  );
  assert.doesNotThrow(() =>
    assertManagedUserUpdatePolicy({
      companyId: COMPANY_ID,
      actorUser: actor({ isAdmin: true, roles: [] }),
      targetUser: target({ isTemporary: true }),
    }),
  );
  assertPolicyError(
    () =>
      assertManagedUserUpdatePolicy({
        companyId: COMPANY_ID,
        actorUser: actor({ roles: ["human-resource"] }),
        targetUser: target(),
      }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED,
  );
  assertPolicyError(
    () =>
      assertManagedUserUpdatePolicy({
        companyId: COMPANY_ID,
        actorUser: actor(),
        targetUser: target({ companyId: "company-b" }),
      }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED,
  );
});

test("role updates reject self and company administrator targets", () => {
  assertPolicyError(
    () =>
      assertUserRolesUpdatePolicy({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: ACTOR_UID,
        actorUser: actor(),
        targetUser: target(),
      }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.SELF_ROLE_CHANGE_FORBIDDEN,
  );
  assertPolicyError(
    () =>
      assertUserRolesUpdatePolicy({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_UID,
        actorUser: actor(),
        targetUser: target({ isAdmin: true }),
      }),
    USER_FIELD_UPDATE_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
  );
});
