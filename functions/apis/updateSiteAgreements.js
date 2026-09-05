import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapSiteAgreementUpdateError } from "../modules/sites/mappers.js";
import { updateSiteAgreements as updateSiteAgreementsUseCase } from "../modules/sites/updateSiteAgreements.js";

export const updateSiteAgreements = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です。");
  try {
    const identity = await resolveCallableAuthIdentity({
      auth: getAuth(), tokenUid: request.auth.uid,
      tokenEmail: request.auth.token?.email,
      tokenEmailVerified: request.auth.token?.email_verified,
      tokenCompanyId: request.auth.token?.companyId,
      tokenIsSuperUser: request.auth.token?.isSuperUser,
    });
    return await updateSiteAgreementsUseCase({
      firestore: getFirestore(), identity, input: request.data,
    });
  } catch (error) {
    const mapped = mapSiteAgreementUpdateError(error);
    logger.write({
      severity: "ERROR", message: "Site agreement update failed",
      errorName: typeof error?.name === "string" ? error.name : "UnknownError",
      errorCode: typeof error?.code === "string" || typeof error?.code === "number"
        ? error.code : "unknown",
    });
    throw new HttpsError(mapped.code, mapped.message);
  }
});
