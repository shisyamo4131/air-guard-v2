/*****************************************************************************
 * @file ./functions/apis/updateCompanyBilling.js
 * @description Company振込先を変更fieldだけで更新するCallableです。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import {
  CompanyBillingUpdateError,
  COMPANY_BILLING_UPDATE_ERROR_CODES,
  updateCompanyBilling as updateCompanyBillingUseCase,
} from "../modules/company/updateCompanyBilling.js";

function mapCompanyBillingUpdateError(error) {
  const identityError = mapCallableAuthIdentityError(error);
  if (identityError) return identityError;

  if (error instanceof CompanyBillingUpdateError) {
    switch (error.code) {
      case COMPANY_BILLING_UPDATE_ERROR_CODES.INVALID_INPUT:
        return {
          code: "invalid-argument",
          message: "振込先の入力内容を確認してください。",
        };
      case COMPANY_BILLING_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED:
        return {
          code: "permission-denied",
          message: "振込先を更新する権限がありません。",
        };
      case COMPANY_BILLING_UPDATE_ERROR_CODES.COMPANY_NOT_FOUND:
        return { code: "not-found", message: "会社情報が見つかりません。" };
      default:
        break;
    }
  }
  return { code: "internal", message: "振込先を更新できませんでした。" };
}

export const updateCompanyBilling = onCall(async (request) => {
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
    return await updateCompanyBillingUseCase({
      firestore: getFirestore(),
      identity,
      input: request.data,
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const mapped = mapCompanyBillingUpdateError(error);
    logger.error("Company billing update failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });
    throw new HttpsError(mapped.code, mapped.message);
  }
});
