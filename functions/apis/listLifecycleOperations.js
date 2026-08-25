/*****************************************************************************
 * @file ./functions/apis/listLifecycleOperations.js
 * @description 会社管理者専用のlifecycle operation履歴Callable APIです。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { listLifecycleOperations as listHistoryUseCase } from "../modules/auth/lifecycle/listLifecycleOperations.js";
import { LIFECYCLE_DOMAIN_ERROR_CODES } from "../modules/auth/lifecycle/lifecycleOperationSchema.js";
import { mapLifecycleOperationError } from "../modules/auth/mappers/mapLifecycleOperationError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

function assertVerifiedIdentityUnchanged(initialIdentity, freshIdentity) {
  const initialFields = Object.keys(initialIdentity).sort();
  const freshFields = Object.keys(freshIdentity).sort();
  const identityChanged =
    initialFields.length !== freshFields.length ||
    initialFields.some(
      (field, index) =>
        field !== freshFields[index] ||
        !Object.is(initialIdentity[field], freshIdentity[field]),
    );
  if (identityChanged) {
    const error = new Error(
      "[listLifecycleOperations] verified identity changed during request",
    );
    error.name = "LifecycleOperationHistoryError";
    error.domainCode = LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID;
    throw error;
  }
}

export const listLifecycleOperations = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const actorToken = request.auth.token ?? {};
  const auth = getAuth();
  try {
    const identity = await resolveCallableAuthIdentity({
      auth,
      tokenUid: request.auth.uid,
      tokenEmail: actorToken.email,
      tokenEmailVerified: actorToken.email_verified,
      tokenCompanyId: actorToken.companyId,
      tokenIsSuperUser: actorToken.isSuperUser,
    });

    const response = await listHistoryUseCase({
      firestore: getFirestore(),
      identity,
      input: request.data,
    });
    const freshIdentity = await resolveCallableAuthIdentity({
      auth,
      tokenUid: request.auth.uid,
      tokenEmail: actorToken.email,
      tokenEmailVerified: actorToken.email_verified,
      tokenCompanyId: actorToken.companyId,
      tokenIsSuperUser: actorToken.isSuperUser,
    });
    assertVerifiedIdentityUnchanged(identity, freshIdentity);
    return response;
  } catch (error) {
    const mappedError = mapLifecycleOperationError(error);
    logger.error("Lifecycle operation history lookup failed", {
      errorName: error?.name,
      errorCode: error?.code,
      domainCode: error?.domainCode,
    });
    throw new HttpsError(mappedError.code, mappedError.message);
  }
});
