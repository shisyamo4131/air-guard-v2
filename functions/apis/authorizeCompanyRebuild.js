/*****************************************************************************
 * @file ./functions/apis/authorizeCompanyRebuild.js
 * @description 再構築APIの実行者と対象会社を検証する内部モジュールです。
 * @method authorizeCompanyRebuild 再構築を許可する会社IDを確定します。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  assertAuthUserCompany,
  assertUserDocumentCompany,
} from "../modules/auth/userAuthCompanyPolicy.js";

const PERMISSION_DENIED_MESSAGE =
  "An active same-company super user is required";

/**
 * 再構築処理の実行者と対象会社が一致することを検証します。
 *
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<string>} 検証済みの会社ID
 */
export async function authorizeCompanyRebuild(request) {
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
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  try {
    assertAuthUserCompany({
      pathCompanyId: companyId,
      docId: uid,
      authUser: { uid, customClaims: token },
    });
  } catch {
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  let authUser;
  try {
    authUser = await getAuth().getUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
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
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  if (
    authUser.emailVerified !== true ||
    authUser.disabled !== false ||
    authUser.customClaims?.isSuperUser !== true
  ) {
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  const actorSnapshot = await getFirestore()
    .collection("Companies")
    .doc(companyId)
    .collection("Users")
    .doc(uid)
    .get();
  const actor = actorSnapshot.data();

  if (!actorSnapshot.exists) {
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  try {
    assertUserDocumentCompany({ pathCompanyId: companyId, userData: actor });
  } catch {
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  if (actor.disabled !== false) {
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  return companyId;
}
