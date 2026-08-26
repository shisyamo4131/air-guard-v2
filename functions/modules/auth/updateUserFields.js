/*****************************************************************************
 * @file ./functions/modules/auth/updateUserFields.js
 * @description User field別更新をFirestore transactionで実行します。
 *****************************************************************************/
import {
  assertManagedUserUpdatePolicy,
  assertOwnProfileUpdatePolicy,
  assertUserRolesUpdatePolicy,
  resolveOwnUserProfileUpdate,
  resolveUserNotificationSettingsUpdate,
  resolveUserRolesUpdate,
  USER_NOTIFICATION_FIELDS,
} from "./policies/userFieldUpdatePolicy.js";

export const USER_FIELD_UPDATE_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  ACTOR_USER_NOT_FOUND: "actor-user-not-found",
  TARGET_USER_NOT_FOUND: "target-user-not-found",
  TARGET_LIFECYCLE_OPERATION_ACTIVE: "target-lifecycle-operation-active",
});

export class UserFieldUpdateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "UserFieldUpdateError";
    this.code = code;
  }
}

function assertDependencies({ firestore, companyId, actorUid }) {
  if (
    typeof companyId !== "string" ||
    !companyId ||
    companyId.trim() !== companyId ||
    companyId.includes("/") ||
    typeof actorUid !== "string" ||
    !actorUid ||
    actorUid.trim() !== actorUid ||
    actorUid.includes("/")
  ) {
    throw new UserFieldUpdateError(
      USER_FIELD_UPDATE_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[updateUserFields] Required identifiers are missing or invalid",
    );
  }
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throw new UserFieldUpdateError(
      USER_FIELD_UPDATE_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[updateUserFields] Firestore service is invalid",
    );
  }
}

function getUserReference(firestore, companyId, userId) {
  return firestore.doc(`Companies/${companyId}/Users/${userId}`);
}

function getSnapshotData(snapshot, errorCode, message) {
  if (!snapshot.exists) {
    throw new UserFieldUpdateError(errorCode, message);
  }
  return snapshot.data();
}

export async function updateOwnUserProfile({
  firestore,
  companyId,
  actorUid,
  input,
} = {}) {
  assertDependencies({ firestore, companyId, actorUid });
  const updates = resolveOwnUserProfileUpdate(input);
  const actorRef = getUserReference(firestore, companyId, actorUid);

  await firestore.runTransaction(async (transaction) => {
    const actorSnapshot = await transaction.get(actorRef);
    const actorUser = getSnapshotData(
      actorSnapshot,
      USER_FIELD_UPDATE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
      "[updateOwnUserProfile] Actor User was not found",
    );
    assertOwnProfileUpdatePolicy({ companyId, actorUser });
    transaction.update(actorRef, updates);
  });

  return { success: true, userId: actorUid };
}

export async function updateUserNotificationSettings({
  firestore,
  companyId,
  actorUid,
  input,
} = {}) {
  assertDependencies({ firestore, companyId, actorUid });
  const resolvedInput = resolveUserNotificationSettingsUpdate(input);
  const actorRef = getUserReference(firestore, companyId, actorUid);
  const targetRef = getUserReference(
    firestore,
    companyId,
    resolvedInput.targetUserId,
  );

  await firestore.runTransaction(async (transaction) => {
    const actorSnapshot = await transaction.get(actorRef);
    const actorUser = getSnapshotData(
      actorSnapshot,
      USER_FIELD_UPDATE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
      "[updateUserNotificationSettings] Actor User was not found",
    );
    const targetSnapshot = await transaction.get(targetRef);
    const targetUser = getSnapshotData(
      targetSnapshot,
      USER_FIELD_UPDATE_ERROR_CODES.TARGET_USER_NOT_FOUND,
      "[updateUserNotificationSettings] Target User was not found",
    );
    assertManagedUserUpdatePolicy({ companyId, actorUser, targetUser });
    transaction.update(
      targetRef,
      Object.fromEntries(
        USER_NOTIFICATION_FIELDS.map((field) => [field, resolvedInput[field]]),
      ),
    );
  });

  return { success: true, userId: resolvedInput.targetUserId };
}

export async function updateUserRoles({
  firestore,
  companyId,
  actorUid,
  input,
} = {}) {
  assertDependencies({ firestore, companyId, actorUid });
  const resolvedInput = resolveUserRolesUpdate(input);
  const actorRef = getUserReference(firestore, companyId, actorUid);
  const targetRef = getUserReference(
    firestore,
    companyId,
    resolvedInput.targetUserId,
  );
  const targetLifecycleLockRef = firestore.doc(
    `Companies/${companyId}/UserLifecycleLocks/${resolvedInput.targetUserId}`,
  );

  await firestore.runTransaction(async (transaction) => {
    const actorSnapshot = await transaction.get(actorRef);
    const actorUser = getSnapshotData(
      actorSnapshot,
      USER_FIELD_UPDATE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
      "[updateUserRoles] Actor User was not found",
    );
    const targetSnapshot = await transaction.get(targetRef);
    const targetUser = getSnapshotData(
      targetSnapshot,
      USER_FIELD_UPDATE_ERROR_CODES.TARGET_USER_NOT_FOUND,
      "[updateUserRoles] Target User was not found",
    );
    const targetLifecycleLockSnapshot = await transaction.get(
      targetLifecycleLockRef,
    );
    assertUserRolesUpdatePolicy({
      companyId,
      actorUid,
      targetUserId: resolvedInput.targetUserId,
      actorUser,
      targetUser,
      expectedRoles: resolvedInput.expectedRoles,
    });
    if (targetLifecycleLockSnapshot.exists) {
      throw new UserFieldUpdateError(
        USER_FIELD_UPDATE_ERROR_CODES.TARGET_LIFECYCLE_OPERATION_ACTIVE,
        "[updateUserRoles] Target User lifecycle operation is active",
      );
    }
    transaction.update(targetRef, { roles: [...resolvedInput.roles] });
  });

  return { success: true, userId: resolvedInput.targetUserId };
}
