/*****************************************************************************
 * @file ./functions/apis/getEmployeeReinstatementContext.js
 * @description UWB-07C UI向け最小訂正context Callable APIです。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getEmployeeReinstatementContext as getContextUseCase } from "../modules/auth/lifecycle/getEmployeeReinstatementContext.js";
import { mapLifecycleOperationError } from "../modules/auth/mappers/mapLifecycleOperationError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

export const getEmployeeReinstatementContext = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }
  const actorToken = request.auth.token ?? {};
  try {
    const identity = await resolveCallableAuthIdentity({
      auth: getAuth(),
      tokenUid: request.auth.uid,
      tokenEmail: actorToken.email,
      tokenEmailVerified: actorToken.email_verified,
      tokenCompanyId: actorToken.companyId,
      tokenIsSuperUser: actorToken.isSuperUser,
    });
    return await getContextUseCase({
      firestore: getFirestore(),
      identity,
      input: request.data,
    });
  } catch (error) {
    const mappedError = mapLifecycleOperationError(error);
    logger.error("Employee reinstatement context lookup failed", {
      errorName: error?.name,
      errorCode: error?.code,
      domainCode: error?.domainCode,
    });
    throw new HttpsError(mappedError.code, mappedError.message);
  }
});
