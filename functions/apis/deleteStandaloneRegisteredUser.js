/*****************************************************************************
 * @file ./functions/apis/deleteStandaloneRegisteredUser.js
 * @description UWB-07B 単独本登録User削除Callable APIです。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { cleanupUserFcmTokens } from "../modules/auth/lifecycle/cleanupUserFcmTokens.js";
import { deleteStandaloneRegisteredUser as deleteStandaloneRegisteredUserUseCase } from "../modules/auth/lifecycle/deleteStandaloneRegisteredUser.js";
import { mapLifecycleOperationError } from "../modules/auth/mappers/mapLifecycleOperationError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

export const deleteStandaloneRegisteredUser = onCall(async (request) => {
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
    return await deleteStandaloneRegisteredUserUseCase({
      firestore: getFirestore(),
      auth,
      cleanupFcm: cleanupUserFcmTokens,
      identity: actorIdentity,
      input: request.data,
    });
  } catch (error) {
    const mappedError = mapLifecycleOperationError(error);
    logger.error("Standalone registered User deletion failed", {
      errorName: error?.name,
      errorCode: error?.code,
      domainCode: error?.domainCode,
    });
    throw new HttpsError(mappedError.code, mappedError.message);
  }
});
