/*****************************************************************************
 * @file ./functions/modules/auth/syncUserAuthAccount.js
 * @description User ドキュメントの変更に基づいて Auth アカウントを同期するためのモジュールです。
 * @method syncUserAuthAccount - User ドキュメントの変更に基づいて Auth アカウントを同期します。
 *****************************************************************************/
import {
  assertAuthUserCompany,
  assertUserDocumentCompany,
  hasAuthRelevantChanges,
} from "./policies/userAuthCompanyPolicy.js";

export const USER_AUTH_SYNC_RESULTS = Object.freeze({
  UPDATED: "updated",
  SKIPPED_NO_RELEVANT_CHANGES: "skipped-no-relevant-changes",
  SKIPPED_TEMPORARY_USER: "skipped-temporary-user",
});

/**
 * Synchronizes the authentication account for a user based on changes in their document.
 * @param {Object} param - The parameters object
 * @param {Object} param.auth - The Firebase Authentication instance
 * @param {string} param.pathCompanyId - The company ID from the request path
 * @param {string} param.docId - The User document ID
 * @param {Object} param.beforeData - The user's data before the changes
 * @param {Object} param.afterData - The user's data after the changes
 * @returns {Promise<{ result: string }>} The result of the synchronization operation
 */
export async function syncUserAuthAccount({
  auth,
  pathCompanyId,
  docId,
  beforeData,
  afterData,
} = {}) {
  const needsAuthUpdate = hasAuthRelevantChanges({ beforeData, afterData });
  if (!needsAuthUpdate) {
    return {
      result: USER_AUTH_SYNC_RESULTS.SKIPPED_NO_RELEVANT_CHANGES,
    };
  }

  // 仮登録 User には対応する Auth アカウントが存在しないため同期しない
  if (afterData.isTemporary === true) {
    return {
      result: USER_AUTH_SYNC_RESULTS.SKIPPED_TEMPORARY_USER,
    };
  }

  // User ドキュメントと所属会社の整合性検証 → 不整合の場合は例外がスローされる
  assertUserDocumentCompany({ pathCompanyId, userData: afterData });

  // auth オブジェクトの整合性検証 → 不整合の場合は例外をスロー
  if (
    !auth ||
    typeof auth.getUser !== "function" ||
    typeof auth.updateUser !== "function"
  ) {
    throw new TypeError(
      "[syncUserAuthAccount] Invalid auth object provided. It must have getUser and updateUser methods.",
    );
  }

  // Auth アカウントを取得
  const authUser = await auth.getUser(docId);

  // Auth アカウントと所属会社の整合性検証 → 不整合の場合は例外がスローされる
  assertAuthUserCompany({ pathCompanyId, docId, authUser });

  await auth.updateUser(docId, {
    displayName: afterData.displayName,
    disabled: afterData.disabled,
  });

  return {
    result: USER_AUTH_SYNC_RESULTS.UPDATED,
  };
}
