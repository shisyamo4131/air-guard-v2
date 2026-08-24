/*****************************************************************************
 * @file ./functions/apis/authorizeCompanyRebuild.js
 * @description 再構築APIの実行者と対象会社を検証する内部モジュールです。
 * @method authorizeCompanyRebuild 再構築を許可する会社IDを確定します。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  assertUserDocumentCompany,
} from "../modules/auth/policies/userAuthCompanyPolicy.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

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

  const token = request.auth.token ?? {};
  let actorIdentity;

  try {
    actorIdentity = await resolveCallableAuthIdentity({
      auth: getAuth(),
      tokenUid: request.auth.uid,
      tokenEmail: token.email,
      tokenEmailVerified: token.email_verified,
      tokenCompanyId: token.companyId,
      tokenIsSuperUser: token.isSuperUser,
    });
  } catch (error) {
    const mappedError = mapCallableAuthIdentityError(error);
    if (mappedError) {
      throw new HttpsError(mappedError.code, mappedError.message);
    }
    throw new HttpsError("internal", "Unable to verify the Auth account");
  }

  const { companyId } = request.data ?? {};
  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required");
  }

  if (
    actorIdentity.isSuperUser !== true ||
    actorIdentity.companyId !== companyId
  ) {
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  const { uid } = actorIdentity;

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
