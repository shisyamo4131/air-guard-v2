/*****************************************************************************
 * @file ./functions/apis/updateCompanyOperations.js
 * @description Company通常設定を変更fieldだけで更新するCallableです。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import {
  CompanyOperationsUpdateError,
  COMPANY_OPERATIONS_UPDATE_ERROR_CODES,
  updateCompanyOperations as updateCompanyOperationsUseCase,
} from "../modules/company/updateCompanyOperations.js";

function mapCompanyOperationsUpdateError(error) {
  const identityError = mapCallableAuthIdentityError(error);
  if (identityError) return identityError;

  if (error instanceof CompanyOperationsUpdateError) {
    switch (error.code) {
      case COMPANY_OPERATIONS_UPDATE_ERROR_CODES.INVALID_INPUT:
        return {
          code: "invalid-argument",
          message: "通常設定の入力内容を確認してください。",
        };
      case COMPANY_OPERATIONS_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED:
        return {
          code: "permission-denied",
          message: "通常設定を更新する権限がありません。",
        };
      case COMPANY_OPERATIONS_UPDATE_ERROR_CODES.COMPANY_NOT_FOUND:
        return { code: "not-found", message: "会社情報が見つかりません。" };
      default:
        break;
    }
  }
  return { code: "internal", message: "通常設定を更新できませんでした。" };
}

export const updateCompanyOperations = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  try {
    const identity = await resolveCallableAuthIdentity({
      auth: getAuth(),
      tokenUid: request.auth.uid,
      tokenEmail: request.auth.token?.email,
      tokenEmailVerified: request.auth.token?.email_verified,
      tokenCompanyId: request.auth.token?.companyId,
      tokenIsSuperUser: request.auth.token?.isSuperUser,
    });
    return await updateCompanyOperationsUseCase({
      firestore: getFirestore(),
      identity,
      input: request.data,
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const mapped = mapCompanyOperationsUpdateError(error);
    logger.error("Company operations update failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });
    throw new HttpsError(mapped.code, mapped.message);
  }
});
