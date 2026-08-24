/*****************************************************************************
 * @file ./functions/modules/auth/policies/userFieldUpdatePolicy.js
 * @description Userの本人プロフィール、通知設定、role更新境界を検証します。
 *****************************************************************************/
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { ROLE_PRESETS } from "../../../constants/rolePresets.js";
import {
  resolveRolePermissions,
  RolePermissionError,
} from "./rolePermissions.js";
import { assertUserDocumentCompany } from "./userAuthCompanyPolicy.js";

const DISPLAY_NAME_MAX_LENGTH = 6;
const PROFILE_FIELDS = new Set(["displayName", "tagSize"]);
const NOTIFICATION_FIELDS = Object.freeze([
  "receiveConfirmedArrangementNotification",
  "receiveArrivedArrangementNotification",
  "receiveLeavedArrangementNotification",
]);
const NOTIFICATION_INPUT_FIELDS = new Set([
  "targetUserId",
  ...NOTIFICATION_FIELDS,
]);
const ROLE_INPUT_FIELDS = new Set(["targetUserId", "roles"]);
const VALID_TAG_SIZES = new Set(
  Object.values(TAG_SIZE_VALUES).map(({ value }) => value),
);

export const USER_FIELD_UPDATE_POLICY_ERROR_CODES = Object.freeze({
  INPUT_INVALID: "input-invalid",
  UNEXPECTED_FIELD: "unexpected-field",
  IDENTIFIER_INVALID: "identifier-invalid",
  DISPLAY_NAME_INVALID: "display-name-invalid",
  TAG_SIZE_INVALID: "tag-size-invalid",
  NOTIFICATION_FLAG_INVALID: "notification-flag-invalid",
  ROLES_INVALID: "roles-invalid",
  ROLE_INVALID: "role-invalid",
  ROLE_DUPLICATED: "role-duplicated",
  USER_DISABLED_STATE_INVALID: "user-disabled-state-invalid",
  USER_NOT_ACTIVE: "user-not-active",
  USER_ADMIN_STATE_INVALID: "user-admin-state-invalid",
  ACTOR_ROLES_INVALID: "actor-roles-invalid",
  ACTOR_PERMISSION_DENIED: "actor-permission-denied",
  SELF_ROLE_CHANGE_FORBIDDEN: "self-role-change-forbidden",
  TARGET_IS_ADMIN: "target-is-admin",
});

export class UserFieldUpdatePolicyError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "UserFieldUpdatePolicyError";
    this.code = code;
  }
}

function throwPolicyError(code, message, options = {}) {
  throw new UserFieldUpdatePolicyError(code, message, options);
}

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function assertExactFields(input, allowedFields) {
  if (!isPlainObject(input)) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.INPUT_INVALID,
      "[userFieldUpdatePolicy] input must be a plain object",
    );
  }

  const fields = Object.keys(input);
  if (fields.length !== allowedFields.size) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.INPUT_INVALID,
      "[userFieldUpdatePolicy] input fields are incomplete",
    );
  }

  for (const field of fields) {
    if (!allowedFields.has(field)) {
      throwPolicyError(
        USER_FIELD_UPDATE_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
        `[userFieldUpdatePolicy] unexpected field: ${field}`,
      );
    }
  }
}

function resolveDocumentId(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    value.includes("/")
  ) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.IDENTIFIER_INVALID,
      "[userFieldUpdatePolicy] targetUserId is invalid",
    );
  }
  return value;
}

function assertActiveRegisteredUser({ companyId, userData }) {
  assertUserDocumentCompany({ pathCompanyId: companyId, userData });

  if (typeof userData.disabled !== "boolean") {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.USER_DISABLED_STATE_INVALID,
      "[userFieldUpdatePolicy] User disabled state is invalid",
    );
  }
  if (userData.disabled) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.USER_NOT_ACTIVE,
      "[userFieldUpdatePolicy] User is not active",
    );
  }
  if (typeof userData.isAdmin !== "boolean") {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.USER_ADMIN_STATE_INVALID,
      "[userFieldUpdatePolicy] User admin state is invalid",
    );
  }
}

function assertManagedTargetUser({ companyId, targetUser }) {
  if (!targetUser || typeof targetUser !== "object" || Array.isArray(targetUser)) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.INPUT_INVALID,
      "[userFieldUpdatePolicy] Target User is invalid",
    );
  }
  if (targetUser.companyId !== companyId) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED,
      "[userFieldUpdatePolicy] Target User company does not match",
    );
  }
  if (typeof targetUser.isAdmin !== "boolean") {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.USER_ADMIN_STATE_INVALID,
      "[userFieldUpdatePolicy] Target User admin state is invalid",
    );
  }
}

export function resolveOwnUserProfileUpdate(input) {
  assertExactFields(input, PROFILE_FIELDS);

  if (
    typeof input.displayName !== "string" ||
    !input.displayName ||
    input.displayName.trim() !== input.displayName ||
    input.displayName.length > DISPLAY_NAME_MAX_LENGTH
  ) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.DISPLAY_NAME_INVALID,
      "[resolveOwnUserProfileUpdate] displayName is invalid",
    );
  }
  if (
    typeof input.tagSize !== "string" ||
    !VALID_TAG_SIZES.has(input.tagSize)
  ) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.TAG_SIZE_INVALID,
      "[resolveOwnUserProfileUpdate] tagSize is invalid",
    );
  }

  return Object.freeze({
    displayName: input.displayName,
    tagSize: input.tagSize,
  });
}

export function resolveUserNotificationSettingsUpdate(input) {
  assertExactFields(input, NOTIFICATION_INPUT_FIELDS);
  const targetUserId = resolveDocumentId(input.targetUserId);

  const updates = { targetUserId };
  for (const field of NOTIFICATION_FIELDS) {
    if (typeof input[field] !== "boolean") {
      throwPolicyError(
        USER_FIELD_UPDATE_POLICY_ERROR_CODES.NOTIFICATION_FLAG_INVALID,
        `[resolveUserNotificationSettingsUpdate] ${field} must be boolean`,
      );
    }
    updates[field] = input[field];
  }
  return Object.freeze(updates);
}

export function resolveUserRolesUpdate(input) {
  assertExactFields(input, ROLE_INPUT_FIELDS);
  const targetUserId = resolveDocumentId(input.targetUserId);
  if (!Array.isArray(input.roles)) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.ROLES_INVALID,
      "[resolveUserRolesUpdate] roles must be an array",
    );
  }

  const roles = [];
  const seen = new Set();
  for (const role of input.roles) {
    if (typeof role !== "string" || !ROLE_PRESETS[role]) {
      throwPolicyError(
        USER_FIELD_UPDATE_POLICY_ERROR_CODES.ROLE_INVALID,
        "[resolveUserRolesUpdate] role must be a known preset",
      );
    }
    if (seen.has(role)) {
      throwPolicyError(
        USER_FIELD_UPDATE_POLICY_ERROR_CODES.ROLE_DUPLICATED,
        "[resolveUserRolesUpdate] roles must not contain duplicates",
      );
    }
    seen.add(role);
    roles.push(role);
  }

  return Object.freeze({ targetUserId, roles: Object.freeze(roles) });
}

export function assertOwnProfileUpdatePolicy({ companyId, actorUser } = {}) {
  assertActiveRegisteredUser({ companyId, userData: actorUser });
}

export function assertManagedUserUpdatePolicy({
  companyId,
  actorUser,
  targetUser,
} = {}) {
  assertActiveRegisteredUser({ companyId, userData: actorUser });
  assertManagedTargetUser({ companyId, targetUser });

  let permissions;
  try {
    permissions = resolveRolePermissions(actorUser.roles);
  } catch (error) {
    if (error instanceof RolePermissionError) {
      throwPolicyError(
        USER_FIELD_UPDATE_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
        "[assertManagedUserUpdatePolicy] Actor roles are invalid",
        { cause: error },
      );
    }
    throw error;
  }

  if (actorUser.isAdmin !== true && !permissions.includes("users:write")) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED,
      "[assertManagedUserUpdatePolicy] Actor cannot update managed fields",
    );
  }
}

export function assertUserRolesUpdatePolicy({
  companyId,
  actorUid,
  targetUserId,
  actorUser,
  targetUser,
} = {}) {
  assertManagedUserUpdatePolicy({ companyId, actorUser, targetUser });

  if (actorUid === targetUserId) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.SELF_ROLE_CHANGE_FORBIDDEN,
      "[assertUserRolesUpdatePolicy] Self role change is forbidden",
    );
  }
  if (targetUser.isAdmin) {
    throwPolicyError(
      USER_FIELD_UPDATE_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
      "[assertUserRolesUpdatePolicy] Administrator roles cannot be changed",
    );
  }
}

export { NOTIFICATION_FIELDS as USER_NOTIFICATION_FIELDS };
