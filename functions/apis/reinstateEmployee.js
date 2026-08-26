/*****************************************************************************
 * @file ./functions/apis/reinstateEmployee.js
 * @description UWB-07C 誤退職訂正Callable APIです。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { mapLifecycleOperationError } from "../modules/auth/mappers/mapLifecycleOperationError.js";
import { reinstateEmployee as reinstateEmployeeUseCase } from "../modules/auth/lifecycle/reinstateEmployee.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

export const reinstateEmployee = onCall(async (request) => {
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
    return await reinstateEmployeeUseCase({
      firestore: getFirestore(),
      identity: actorIdentity,
      input: request.data,
    });
  } catch (error) {
    const mappedError = mapLifecycleOperationError(error);
    logger.error("Employee reinstatement failed", {
      errorName: error?.name,
      errorCode: error?.code,
      domainCode: error?.domainCode,
    });
    throw new HttpsError(mappedError.code, mappedError.message);
  }
});
