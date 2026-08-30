/*****************************************************************************
 * @file ./functions/apis/updateCompanyArrangement.js
 * @description Company表示順を対象fieldだけで更新するCallableです。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import {
  CompanyArrangementUpdateError,
  COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES,
  updateCompanyArrangement as updateCompanyArrangementUseCase,
} from "../modules/company/updateCompanyArrangement.js";

function mapCompanyArrangementUpdateError(error) {
  const identityError = mapCallableAuthIdentityError(error);
  if (identityError) return identityError;

  if (error instanceof CompanyArrangementUpdateError) {
    switch (error.code) {
      case COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.INVALID_INPUT:
        return {
          code: "invalid-argument",
          message: "表示順の入力内容を確認してください。",
        };
      case COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED:
        return {
          code: "permission-denied",
          message: "表示順を更新する権限がありません。",
        };
      case COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.COMPANY_NOT_FOUND:
        return { code: "not-found", message: "会社情報が見つかりません。" };
      default:
        break;
    }
  }
  return { code: "internal", message: "表示順を更新できませんでした。" };
}

export const updateCompanyArrangement = onCall(async (request) => {
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
    return await updateCompanyArrangementUseCase({
      firestore: getFirestore(),
      identity,
      input: request.data,
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const mapped = mapCompanyArrangementUpdateError(error);
    logger.error("Company arrangement update failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });
    throw new HttpsError(mapped.code, mapped.message);
  }
});
