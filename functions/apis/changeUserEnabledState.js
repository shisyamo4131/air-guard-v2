/*****************************************************************************
 * @file ./functions/apis/changeUserEnabledState.js
 * @description 同じ会社の一般Userを有効化・無効化するCallable APIです。
 * @method disableUser 検証済みの対象Userを無効化します。
 * @method enableUser 検証済みの対象Userを有効化します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { changeUserEnabledState } from "../modules/auth/changeUserEnabledState.js";
import { mapUserEnabledStateError } from "../modules/auth/mapUserEnabledStateError.js";

/**
 * 利用者の有効・無効状態変更リクエストを処理します。
 * @param {Object} request - Callable リクエスト
 * @param {boolean} enabled - 変更後の有効状態
 * @returns {Promise<{ success: boolean, uid: string }>}
 */
async function handleUserEnabledStateChangeRequest(request, enabled) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const targetUid = request.data?.uid;

  if (typeof targetUid !== "string" || !targetUid) {
    throw new HttpsError(
      "invalid-argument",
      "対象ユーザーIDが指定されていません。",
    );
  }

  const actorUid = request.auth.uid;
  const companyId = request.auth.token?.companyId;

  if (
    typeof actorUid !== "string" ||
    !actorUid ||
    typeof companyId !== "string" ||
    !companyId
  ) {
    throw new HttpsError("permission-denied", "認証情報を確認できません。");
  }

  try {
    return await changeUserEnabledState({
      auth: getAuth(),
      firestore: getFirestore(),
      companyId,
      actorUid,
      targetUid,
      enabled,
    });
  } catch (error) {
    const mappedError = mapUserEnabledStateError(error);
    logger.error("User enabled state change failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
}

/**
 * User アカウントを無効化します。
 */
export const disableUser = onCall(async (request) => {
  return handleUserEnabledStateChangeRequest(request, false);
});

/**
 * User アカウントを有効化します。
 */
export const enableUser = onCall(async (request) => {
  return handleUserEnabledStateChangeRequest(request, true);
});
