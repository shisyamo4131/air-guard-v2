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
  assertAuthUserCompany,
  assertUserDocumentCompany,
} from "../modules/auth/userAuthCompanyPolicy.js";

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

  const { uid, token } = request.auth;
  const companyId = token?.companyId;
  if (
    typeof uid !== "string" ||
    !uid ||
    token?.email_verified !== true
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
    throw new HttpsError("internal", "Authアカウントを確認できません。");
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

  if (authUser.emailVerified !== true || authUser.disabled !== false) {
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
    const usersSnapshot = await getFirestore()
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
