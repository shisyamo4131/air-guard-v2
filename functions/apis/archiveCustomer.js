/*****************************************************************************
 * @file ./functions/apis/archiveCustomer.js
 * @description Customerを監査付きでarchiveするCallableです。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { archiveCustomer as archiveCustomerUseCase } from "../modules/customer/archiveCustomer.js";
import { mapCustomerArchiveError } from "../modules/customer/mappers/mapCustomerArchiveError.js";

export const archiveCustomer = onCall(async (request) => {
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
    return await archiveCustomerUseCase({
      firestore: getFirestore(),
      identity,
      input: request.data,
    });
  } catch (error) {
    const mapped = mapCustomerArchiveError(error);
    const errorCode = error?.code;
    logger.write({
      severity: "ERROR",
      message: "Customer archive failed",
      errorName:
        typeof error?.name === "string" ? error.name : "UnknownError",
      errorCode:
        typeof errorCode === "string" || typeof errorCode === "number"
          ? errorCode
          : "unknown",
    });
    throw new HttpsError(mapped.code, mapped.message);
  }
});
