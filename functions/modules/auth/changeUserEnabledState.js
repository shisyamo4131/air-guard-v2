/*****************************************************************************
 * @file ./functions/modules/auth/changeUserEnabledState.js
 * @description 利用者の有効状態を変更するためのモジュールです。
 * @method changeUserEnabledState 利用者の有効状態を変更します。
 *****************************************************************************/
import { assertAuthUserCompany } from "./userAuthCompanyPolicy.js";
import { assertUserEnabledStateChangePolicy } from "./userEnabledStatePolicy.js";

export const USER_ENABLED_STATE_CHANGE_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  ENABLED_STATE_INVALID: "enabled-state-invalid",
  AUTH_SERVICE_INVALID: "auth-service-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  ACTOR_USER_NOT_FOUND: "actor-user-not-found",
  TARGET_USER_NOT_FOUND: "target-user-not-found",
});

/**
 * Custom error class for user enabled state change errors.
 */
export class UserEnabledStateChangeError extends Error {
  /**
   * Creates a new UserEnabledStateChangeError.
   * @param {string} code - error code.
   * @param {string} message - error message.
   * @param {{ cause?: unknown }} [options] - optional error options, including cause.
   */
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "UserEnabledStateChangeError";
    this.code = code;
  }
}

/**
 * Changes the enabled state of a user.
 * @param {Object} param - The parameters for changing the user's enabled state.
 * @param {Object} param.auth - The authentication service.
 * @param {Object} param.firestore - The Firestore service.
 * @param {string} param.companyId - The ID of the company.
 * @param {string} param.actorUid - The UID of the user making the change.
 * @param {string} param.targetUid - The UID of the user whose enabled state is being changed.
 * @param {boolean} param.enabled - The new enabled state.
 * @returns {Promise<{ success: boolean, uid: string }>} A promise resolving to the result of the operation.
 * @throws {UserEnabledStateChangeError} If required fields are missing or if the operation fails due to policy violations or service issues.
 * @throws {UserEnabledStateChangeError} If the `enabled` parameter is not a boolean.
 * @throws {UserEnabledStateChangeError} If the `auth` or `firestore` services are invalid.
 * @throws {UserEnabledStateChangeError} If the actor or target user is not found.
 * @throws {UserAuthCompanyPolicyError} If the actor or target user does not have company consistency.
 * @throws {UserEnabledStatePolicyError} If the user enabled state change policy is invalid.
 */
export async function changeUserEnabledState({
  auth,
  firestore,
  companyId,
  actorUid,
  targetUid,
  enabled,
} = {}) {
  // 引数の検証
  if (
    typeof companyId !== "string" ||
    !companyId ||
    typeof actorUid !== "string" ||
    !actorUid ||
    typeof targetUid !== "string" ||
    !targetUid
  ) {
    throw new UserEnabledStateChangeError(
      USER_ENABLED_STATE_CHANGE_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[changeUserEnabledState] Required fields are missing",
    );
  }

  if (typeof enabled !== "boolean") {
    throw new UserEnabledStateChangeError(
      USER_ENABLED_STATE_CHANGE_ERROR_CODES.ENABLED_STATE_INVALID,
      "[changeUserEnabledState] Enabled state must be boolean",
    );
  }

  if (!auth || typeof auth.getUser !== "function") {
    throw new UserEnabledStateChangeError(
      USER_ENABLED_STATE_CHANGE_ERROR_CODES.AUTH_SERVICE_INVALID,
      "[changeUserEnabledState] Auth service must provide getUser",
    );
  }

  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throw new UserEnabledStateChangeError(
      USER_ENABLED_STATE_CHANGE_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[changeUserEnabledState] Firestore service is invalid",
    );
  }

  // 実行者と対象者の User ドキュメントの参照を取得
  const actorUserRef = firestore.doc(
    `Companies/${companyId}/Users/${actorUid}`,
  );
  const targetUserRef = firestore.doc(
    `Companies/${companyId}/Users/${targetUid}`,
  );

  return firestore.runTransaction(async (transaction) => {
    // 実行者の User ドキュメントを取得
    const actorSnapshot = await transaction.get(actorUserRef);

    // 実行者の User ドキュメントが存在しない場合は例外をスロー
    if (!actorSnapshot.exists) {
      throw new UserEnabledStateChangeError(
        USER_ENABLED_STATE_CHANGE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
        "[changeUserEnabledState] Actor user not found",
      );
    }

    // 対象者の User ドキュメントを取得
    const targetSnapshot = await transaction.get(targetUserRef);

    // 対象者の User ドキュメントが存在しない場合は例外をスロー
    if (!targetSnapshot.exists) {
      throw new UserEnabledStateChangeError(
        USER_ENABLED_STATE_CHANGE_ERROR_CODES.TARGET_USER_NOT_FOUND,
        "[changeUserEnabledState] Target user not found",
      );
    }

    const actorUser = actorSnapshot.data();
    const targetUser = targetSnapshot.data();

    // 実行者と対象者の有効状態変更ポリシーを検証 → 不整合の場合は例外をスロー
    assertUserEnabledStateChangePolicy({
      companyId,
      actorUid,
      actorUser,
      targetUid,
      targetUser,
    });

    // 対象者の Auth アカウントを取得
    const authUser = await auth.getUser(targetUid);

    // 対象者の Auth アカウントと所属会社の整合性検証 → 不整合の場合は例外をスロー
    assertAuthUserCompany({
      pathCompanyId: companyId,
      docId: targetUid,
      authUser,
    });

    // 対象者の User ドキュメントの disabled フィールドを更新
    transaction.update(targetUserRef, { disabled: !enabled });

    return { success: true, uid: targetUid };
  });
}
