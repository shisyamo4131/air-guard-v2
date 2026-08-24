/*****************************************************************************
 * @file ./functions/apis/createAdminAccount.js
 * @description 新しい会社と最初の会社管理者を作成するCallable APIです。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createAdminAccount as createAdminAccountUseCase } from "../modules/auth/createAdminAccount.js";
import { mapCreateAdminAccountError } from "../modules/auth/mappers/mapCreateAdminAccountError.js";

export const createAdminAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  try {
    const token = request.auth.token ?? {};
    return await createAdminAccountUseCase({
      auth: getAuth(),
      firestore: getFirestore(),
      tokenUid: request.auth.uid,
      tokenEmail: token.email,
      tokenEmailVerified: token.email_verified,
      tokenCompanyId: token.companyId,
      tokenIsSuperUser: token.isSuperUser,
      input: request.data,
    });
  } catch (error) {
    const mapped = mapCreateAdminAccountError(error);
    logger.error("Initial administrator creation failed", {
      operation: "create-initial-administrator",
      errorName: typeof error?.name === "string" ? error.name : "UnknownError",
      errorCode:
        typeof error?.code === "string" || typeof error?.code === "number"
          ? error.code
          : "unknown",
      callableCode: mapped.code,
    });
    throw new HttpsError(mapped.code, mapped.message);
  }
});
