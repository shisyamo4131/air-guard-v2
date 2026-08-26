/*****************************************************************************
 * @file ./functions/apis/terminateEmployee.js
 * @description UWB-07A Employee退職と関連User削除を実行するCallable APIです。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { cleanupUserFcmTokens } from "../modules/auth/lifecycle/cleanupUserFcmTokens.js";
import { terminateEmployee as terminateEmployeeUseCase } from "../modules/auth/lifecycle/terminateEmployee.js";
import { mapLifecycleOperationError } from "../modules/auth/mappers/mapLifecycleOperationError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

/**
 * 検証済みの実行者が、同じ会社のEmployeeを退職処理します。
 * companyIdとactorUidは現在Authからserver側で確立します。
 */
export const terminateEmployee = onCall(async (request) => {
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

    return await terminateEmployeeUseCase({
      firestore: getFirestore(),
      auth,
      cleanupFcm: cleanupUserFcmTokens,
      identity: actorIdentity,
      input: request.data,
    });
  } catch (error) {
    const mappedError = mapLifecycleOperationError(error);

    logger.error("Employee retirement failed", {
      errorName: error?.name,
      errorCode: error?.code,
      domainCode: error?.domainCode,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
});
