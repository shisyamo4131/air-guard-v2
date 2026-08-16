/*****************************************************************************
 * @file ./functions/modules/auth/userEnabledStatePolicy.js
 * @description 利用者の有効状態変更に関するポリシーを検証するためのモジュールです。
 * @method assertUserEnabledStateChangePolicy - 利用者の有効状態変更に関するポリシーを検証します。
 *****************************************************************************/
import { assertUserDocumentCompany } from "./userAuthCompanyPolicy.js";

export const USER_ENABLED_STATE_POLICY_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  ACTOR_NOT_ADMIN: "actor-not-admin",
  ACTOR_NOT_ACTIVE: "actor-not-active",
  ACTOR_DISABLED_STATE_INVALID: "actor-disabled-state-invalid",
  SELF_STATUS_CHANGE_FORBIDDEN: "self-status-change-forbidden",
  TARGET_IS_ADMIN: "target-is-admin",
  TARGET_ADMIN_STATE_INVALID: "target-admin-state-invalid",
});

/**
 * Custom error class for user enabled state policy errors.
 */
export class UserEnabledStatePolicyError extends Error {
  /**
   * Creates a new UserEnabledStatePolicyError.
   * @param {string} code - error code.
   * @param {string} message - error message.
   * @param {{ cause?: unknown }} [options] - optional error options, including cause.
   */
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "UserEnabledStatePolicyError";
    this.code = code;
  }
}

/**
 * Asserts that the user enabled state change policy is valid.
 * @param {Object} param - The parameters object
 * @param {string} param.companyId - The company ID
 * @param {string} param.actorUid - The UID of the actor (the user making the change)
 * @param {Object} param.actorUser - The actor's user data
 * @param {string} param.targetUid - The UID of the target user (the user being changed)
 * @param {Object} param.targetUser - The target user's data
 * @throws {UserEnabledStatePolicyError} - If required fields are missing
 * @throws {UserAuthCompanyPolicyError} - If the actor does not have company consistency
 * @throws {UserEnabledStatePolicyError} - If the actor is not an admin
 * @throws {UserEnabledStatePolicyError} - If the actor is not active
 * @throws {UserEnabledStatePolicyError} - If the actor's disabled state is invalid
 * @throws {UserEnabledStatePolicyError} - If the actor is trying to change their own status
 * @throws {UserAuthCompanyPolicyError} - If the target user does not have company consistency
 * @throws {UserEnabledStatePolicyError} - If the target user is an admin
 * @throws {UserEnabledStatePolicyError} - If the target user's admin state is invalid
 */
export function assertUserEnabledStateChangePolicy({
  companyId,
  actorUid,
  actorUser,
  targetUid,
  targetUser,
} = {}) {
  if (!companyId || !actorUid || !actorUser || !targetUid || !targetUser) {
    throw new UserEnabledStatePolicyError(
      USER_ENABLED_STATE_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[assertUserEnabledStateChangePolicy] Required fields are missing",
    );
  }

  // 実行者と所属会社の整合性検証 → 不整合の場合は例外がスローされる
  assertUserDocumentCompany({ pathCompanyId: companyId, userData: actorUser });

  // 実行者が管理者でなければ例外をスロー
  if (actorUser.isAdmin !== true) {
    throw new UserEnabledStatePolicyError(
      USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ADMIN,
      "[assertUserEnabledStateChangePolicy] Actor is not an admin",
    );
  }

  // 実行者の disabled が boolean 型でなければ例外をスロー
  if (typeof actorUser.disabled !== "boolean") {
    throw new UserEnabledStatePolicyError(
      USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID,
      "[assertUserEnabledStateChangePolicy] Actor disabled state is invalid",
    );
  }
  // 実行者が有効状態でなければ例外をスロー
  if (actorUser.disabled === true) {
    throw new UserEnabledStatePolicyError(
      USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
      "[assertUserEnabledStateChangePolicy] Actor is not active",
    );
  }

  // 実行者と対象者の UID が一致する場合は例外をスロー（自己の有効状態変更は許可しない）
  if (actorUid === targetUid) {
    throw new UserEnabledStatePolicyError(
      USER_ENABLED_STATE_POLICY_ERROR_CODES.SELF_STATUS_CHANGE_FORBIDDEN,
      "[assertUserEnabledStateChangePolicy] Self status change is forbidden",
    );
  }

  // 対象者と所属会社の整合性検証 → 不整合の場合は例外がスローされる
  assertUserDocumentCompany({ pathCompanyId: companyId, userData: targetUser });

  // 対象者の isAdmin が boolean 型でなければ例外をスロー
  if (typeof targetUser.isAdmin !== "boolean") {
    throw new UserEnabledStatePolicyError(
      USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
      "[assertUserEnabledStateChangePolicy] Target admin state is invalid",
    );
  }

  // 対象者の isAdmin が true の場合は例外をスロー（管理者の有効状態変更は許可しない）
  if (targetUser.isAdmin === true) {
    throw new UserEnabledStatePolicyError(
      USER_ENABLED_STATE_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
      "[assertUserEnabledStateChangePolicy] Target is an admin",
    );
  }
}
