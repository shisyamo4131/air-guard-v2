/*****************************************************************************
 * @file ./functions/apis/deleteTemporaryUser.js
 * @description 同じ会社の仮登録Userだけを削除するCallable APIです。
 * @method deleteTemporaryUser
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { deleteTemporaryUser as deleteTemporaryUserUseCase } from "../modules/auth/deleteTemporaryUser.js";
import { mapDeleteTemporaryUserError } from "../modules/auth/mappers/mapDeleteTemporaryUserError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

/**
 * 検証済みの実行者が、同じ会社の仮登録Userを削除します。
 * @param {Object} request
 * @param {Object} request.auth
 * @param {Object} request.data
 * @param {string} request.data.targetUserId
 * @returns {Promise<{
 *   success: boolean,
 *   userId: string,
 *   linkType: "standalone" | "employee-linked",
 *   employeeId: string | null,
 * }>}
 * @throws {HttpsError}
 */
export const deleteTemporaryUser = onCall(async (request) => {
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

    return await deleteTemporaryUserUseCase({
      firestore: getFirestore(),
      companyId: actorIdentity.companyId,
      actorUid: actorIdentity.uid,
      targetUserId: request.data?.targetUserId,
    });
  } catch (error) {
    const mappedError = mapDeleteTemporaryUserError(error);

    logger.error("Temporary User deletion failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
});
