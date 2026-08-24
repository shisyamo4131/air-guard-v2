/*****************************************************************************
 * @file ./functions/apis/updateUserFields.js
 * @description Userの本人プロフィール、通知設定、roleをfield別に更新します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  updateOwnUserProfile as updateOwnUserProfileUseCase,
  updateUserNotificationSettings as updateUserNotificationSettingsUseCase,
  updateUserRoles as updateUserRolesUseCase,
} from "../modules/auth/updateUserFields.js";
import { mapUserFieldUpdateError } from "../modules/auth/mappers/mapUserFieldUpdateError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

async function handleUserFieldUpdateRequest(request, operation, useCase) {
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

    return await useCase({
      firestore: getFirestore(),
      companyId: actorIdentity.companyId,
      actorUid: actorIdentity.uid,
      input: request.data,
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;

    const mappedError = mapUserFieldUpdateError(error);
    logger.error("User field update failed", {
      operation,
      errorName: error?.name,
      errorCode: error?.code,
    });
    throw new HttpsError(mappedError.code, mappedError.message);
  }
}

export const updateOwnUserProfile = onCall(async (request) => {
  return handleUserFieldUpdateRequest(
    request,
    "own-profile",
    updateOwnUserProfileUseCase,
  );
});

export const updateUserNotificationSettings = onCall(async (request) => {
  return handleUserFieldUpdateRequest(
    request,
    "notification-settings",
    updateUserNotificationSettingsUseCase,
  );
});

export const updateUserRoles = onCall(async (request) => {
  return handleUserFieldUpdateRequest(request, "roles", updateUserRolesUseCase);
});
