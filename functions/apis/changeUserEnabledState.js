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
import { mapUserEnabledStateError } from "../modules/auth/mappers/mapUserEnabledStateError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

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

  const actorToken = request.auth.token ?? {};
  const auth = getAuth();

  try {
    const actorIdentity = await resolveCallableAuthIdentity({
      auth,
      tokenUid: request.auth.uid,
      tokenEmail: actorToken.email,
      tokenEmailVerified: actorToken.email_verified,
      tokenCompanyId: actorToken.companyId,
      tokenIsSuperUser: actorToken.isSuperUser,
    });
    const requestData = request.data;
    const requestFields =
      requestData && typeof requestData === "object" && !Array.isArray(requestData)
        ? Object.keys(requestData)
        : [];
    if (
      requestFields.length !== 2 ||
      !requestFields.includes("uid") ||
      !requestFields.includes("expectedDisabled")
    ) {
      throw new HttpsError(
        "invalid-argument",
        "必要な情報が不足しているか、形式が正しくありません。",
      );
    }

    const targetUid = requestData.uid;
    const expectedDisabled = requestData.expectedDisabled;

    if (
      typeof targetUid !== "string" ||
      !targetUid ||
      typeof expectedDisabled !== "boolean"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "対象ユーザーIDが指定されていません。",
      );
    }

    return await changeUserEnabledState({
      auth,
      firestore: getFirestore(),
      companyId: actorIdentity.companyId,
      actorUid: actorIdentity.uid,
      targetUid,
      enabled,
      expectedDisabled,
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;

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
