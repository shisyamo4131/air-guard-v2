/*****************************************************************************
 * @file ./functions/apis/checkEmailAvailability.js
 * @description 新規会社の管理者signup用メールアドレスを事前確認するCallable APIです。
 * @method checkEmailAvailability Authenticationと全会社Userの重複を確認します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

/**
 * 新規会社の管理者signup用にメールアドレスの利用可能性を事前確認する。
 * 未認証状態での実行も想定されるため、request.auth のチェックは行わない。
 *
 * 【チェックフロー】
 * 1. Authentication にメールアドレスが存在しないことを確認する。
 * 2. 全会社の User にメールアドレスが存在しないことを確認する。
 *
 * このCallableはUX用の事前検査であり、管理者作成の認可境界ではない。
 * createAdminAccountでも現在Auth・既存所属・User重複を検証する必要がある。
 *
 * @param {string} email - チェックするメールアドレス
 * @returns {Object} 利用可能性結果
 * @returns {boolean} return.available - 利用可能かどうか
 */
export const checkEmailAvailability = onCall(async (request) => {
  const { email } = request.data ?? {};

  if (typeof email !== "string" || email.trim() === "") {
    throw new HttpsError(
      "invalid-argument",
      "メールアドレスが指定されていません。",
    );
  }

  try {
    const auth = getAuth();
    const db = getFirestore();

    // 1. Authenticationのメールアドレスは一意のため、存在時は登録不可
    const authExists = await auth
      .getUserByEmail(email)
      .then(() => true)
      .catch((error) => {
        if (error.code === "auth/user-not-found") {
          return false;
        }
        throw error;
      });

    if (authExists) {
      throw new HttpsError(
        "already-exists",
        "このメールアドレスは既に使用されています。",
      );
    }

    // 2. 登録状態に関係なく、全会社のUserでメールアドレス重複を拒否
    const usersSnapshot = await db
      .collectionGroup("Users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!usersSnapshot.empty) {
      throw new HttpsError(
        "already-exists",
        "このメールアドレスは既に使用されています。",
      );
    }

    logger.info("Administrator signup email preflight passed.");

    return { available: true };
  } catch (error) {
    logger.error("checkEmailAvailability でエラーが発生しました:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "メールアドレスチェック中に予期しないエラーが発生しました。",
    );
  }
});
