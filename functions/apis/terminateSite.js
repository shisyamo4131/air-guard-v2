import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { terminateSite as terminateSiteUseCase } from "../modules/sites/lifecycle.js";
import { mapSiteLifecycleError } from "../modules/sites/mappers.js";

export const terminateSite = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です。");
  try {
    const identity = await resolveCallableAuthIdentity({
      auth: getAuth(), tokenUid: request.auth.uid,
      tokenEmail: request.auth.token?.email,
      tokenEmailVerified: request.auth.token?.email_verified,
      tokenCompanyId: request.auth.token?.companyId,
      tokenIsSuperUser: request.auth.token?.isSuperUser,
    });
    return await terminateSiteUseCase({ firestore: getFirestore(), identity, input: request.data });
  } catch (error) {
    logger.error("Site termination failed", { errorName: error?.name, errorCode: error?.code });
    const mapped = mapSiteLifecycleError(error);
    throw new HttpsError(mapped.code, mapped.message);
  }
});
