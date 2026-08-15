import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { rebuildAllHistories as rebuildAllHistoriesCore } from "../modules/siteEmployeeHistories/rebuildAllHistories.js";
import { rebuildSecurityReportIndexes as rebuildSecurityReportIndexesCore } from "../modules/securityReport/index.js";
import {
  assertAuthUserCompany,
  assertUserDocumentCompany,
} from "../modules/auth/userAuthCompanyPolicy.js";

const REBUILD_PERMISSION_DENIED_MESSAGE =
  "An active same-company super user is required";

/**
 * 再構築処理の実行者と対象会社が一致することを検証します。
 *
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<string>} 検証済みの会社ID
 */
async function authorizeCompanyRebuild(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required");
  }

  const { companyId } = request.data ?? {};
  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required");
  }

  const { uid, token } = request.auth;
  if (
    !uid ||
    typeof uid !== "string" ||
    token?.email_verified !== true ||
    token.isSuperUser !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      REBUILD_PERMISSION_DENIED_MESSAGE,
    );
  }

  try {
    assertAuthUserCompany({
      pathCompanyId: companyId,
      docId: uid,
      authUser: { uid, customClaims: token },
    });
  } catch {
    throw new HttpsError(
      "permission-denied",
      REBUILD_PERMISSION_DENIED_MESSAGE,
    );
  }

  let authUser;
  try {
    authUser = await getAuth().getUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      throw new HttpsError(
        "permission-denied",
        REBUILD_PERMISSION_DENIED_MESSAGE,
      );
    }
    throw new HttpsError("internal", "Unable to verify the Auth account");
  }

  try {
    assertAuthUserCompany({
      pathCompanyId: companyId,
      docId: uid,
      authUser,
    });
  } catch {
    throw new HttpsError(
      "permission-denied",
      REBUILD_PERMISSION_DENIED_MESSAGE,
    );
  }

  if (
    authUser.emailVerified !== true ||
    authUser.disabled !== false ||
    authUser.customClaims?.isSuperUser !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      REBUILD_PERMISSION_DENIED_MESSAGE,
    );
  }

  const actorSnapshot = await getFirestore()
    .collection("Companies")
    .doc(companyId)
    .collection("Users")
    .doc(uid)
    .get();
  const actor = actorSnapshot.data();

  if (!actorSnapshot.exists) {
    throw new HttpsError(
      "permission-denied",
      REBUILD_PERMISSION_DENIED_MESSAGE,
    );
  }

  try {
    assertUserDocumentCompany({ pathCompanyId: companyId, userData: actor });
  } catch {
    throw new HttpsError(
      "permission-denied",
      REBUILD_PERMISSION_DENIED_MESSAGE,
    );
  }

  if (actor.disabled !== false) {
    throw new HttpsError(
      "permission-denied",
      REBUILD_PERMISSION_DENIED_MESSAGE,
    );
  }

  return companyId;
}

/*****************************************************************************
 * SiteEmployeeHistories を全件再構築します。
 *****************************************************************************/
export const rebuildAllHistories = onCall(async (request) => {
  const companyId = await authorizeCompanyRebuild(request);

  try {
    await rebuildAllHistoriesCore(companyId);
    return { message: "Successfully rebuilt all histories." };
  } catch (err) {
    if (err instanceof HttpsError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : "Unexpected error";
    throw new HttpsError("internal", message);
  }
});

/*****************************************************************************
 * SecurityReportIndexes をStorageの現在状態から再構築します。
 *****************************************************************************/
export const rebuildSecurityReportIndexes = onCall(
  { timeoutSeconds: 540 },
  async (request) => {
    const companyId = await authorizeCompanyRebuild(request);

    try {
      const result = await rebuildSecurityReportIndexesCore(companyId);
      return {
        ...result,
        message:
          `警備日報インデックスを再構築しました。` +
          `（処理対象: ${result.processedCount}件、登録: ${result.indexedCount}件）`,
      };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }

      const message = err instanceof Error ? err.message : "Unexpected error";
      throw new HttpsError("internal", message);
    }
  },
);
