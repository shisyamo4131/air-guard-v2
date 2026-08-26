/*****************************************************************************
 * @file ./functions/apis/checkEmailAvailabilityGlobal.js
 * @description 全会社のUserを対象にメールアドレスの重複を確認するCallable APIです。
 * @method checkEmailAvailabilityGlobal メールアドレスが利用可能か確認します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  assertUserDocumentCompany,
} from "../modules/auth/policies/userAuthCompanyPolicy.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

const PERMISSION_DENIED_MESSAGE = "有効な会社管理者権限を確認できません。";

/**
 * 会社管理者が、全会社のUserに対するメールアドレス重複を確認します。
 *
 * @property {string} email - チェックするメールアドレス
 * @returns {Object} 利用可不可結果 { available: true }
 * @throws {HttpsError} 実行者が有効な会社管理者でない場合
 * @throws {HttpsError} メールアドレスが指定されていない場合
 * @throws {HttpsError} メールアドレスが既に使用されている場合
 */
export const checkEmailAvailabilityGlobal = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const token = request.auth.token ?? {};
  const auth = getAuth();
  const db = getFirestore();
  let actorIdentity;

  try {
    actorIdentity = await resolveCallableAuthIdentity({
      auth,
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
    throw new HttpsError("internal", "Authアカウントを確認できません。");
  }

  const { uid, companyId } = actorIdentity;

  const actorSnapshot = await db
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

  if (
    actor.isTemporary !== false ||
    actor.disabled !== false ||
    actor.isAdmin !== true
  ) {
    throw new HttpsError("permission-denied", PERMISSION_DENIED_MESSAGE);
  }

  const { email } = request.data ?? {};
  if (typeof email !== "string" || !email.trim()) {
    throw new HttpsError(
      "invalid-argument",
      "メールアドレスが指定されていません。",
    );
  }

  try {
    const usersSnapshot = await db
      .collectionGroup("Users")
      .where("email", "==", email)
      .get();

    if (!usersSnapshot.empty) {
      throw new HttpsError(
        "already-exists",
        "このメールアドレスは既に使用されています。",
      );
    }

    return { available: true };
  } catch (error) {
    logger.error("checkEmailAvailabilityGlobal でエラーが発生しました:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "メールアドレスチェック中に予期しないエラーが発生しました。",
    );
  }
});
