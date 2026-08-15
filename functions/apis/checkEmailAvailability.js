/*****************************************************************************
 * @file ./functions/apis/checkEmailAvailability.js
 * @description サインアップ用メールアドレスの利用可能性を確認するCallable APIです。
 * @method checkEmailAvailability 管理者登録または一般User登録の可否を確認します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

/**
 * メールアドレスの利用可能性をチェック（サインアップ用）
 * 管理者登録・利用者登録の両方で使用可能
 * 未認証状態での実行も想定されるため、request.auth のチェックは行わない。
 *
 * 【チェックフロー】
 * 1. Authentication でメールアドレスの存在チェック（全ケース共通）
 *    → 存在する場合は無条件でエラー
 *
 * 2. Firestore でメールアドレスの存在チェック（isAdmin により分岐）
 *
 * 【管理者アカウント（isAdmin: true）】
 * - Firestore の Users コレクショングループにメールアドレスが存在しないことを確認
 * - isAdmin、isTemporary の状態に関わらず、メールアドレスの重複を防止
 *
 * 【利用者アカウント（isAdmin: false）】
 * - isTemporary=true のドキュメントが存在しない場合はエラー（事前登録チェック）
 *
 * @param {boolean} isAdmin - true: 管理者登録用, false: 利用者登録用
 * @param {string} email - チェックするメールアドレス
 * @returns {Object} 利用可能性結果
 * @returns {boolean} return.available - 利用可能かどうか
 */
export const checkEmailAvailability = onCall(async (request) => {
  const { email, isAdmin } = request.data;

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "メールアドレスが指定されていません。",
    );
  }

  if (typeof isAdmin !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "isAdminフラグが指定されていません。",
    );
  }

  try {
    const auth = getAuth();
    const db = getFirestore();

    // 1. Authenticationでチェック（無条件でエラー）
    // Authenticationのメールアドレスは一意のため、既に存在する場合は
    // 管理者・利用者に関わらず登録不可
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

    // 2. Firestoreでチェック（管理者と利用者で処理が異なる）
    if (isAdmin) {
      // 管理者登録時: 指定されたメールアドレスがUsersコレクショングループに登録されていたらエラー
      const adminSnapshot = await db
        .collectionGroup("Users")
        .where("email", "==", email)
        .get();

      if (!adminSnapshot.empty) {
        throw new HttpsError(
          "already-exists",
          "このメールアドレスは既に管理者として登録されています。",
        );
      }
    } else {
      // 利用者登録時: isTemporary=true のドキュメントが存在しない場合はエラー（事前登録が必要）
      const tempUserSnapshot = await db
        .collectionGroup("Users")
        .where("email", "==", email)
        .where("isTemporary", "==", true)
        .get();

      if (tempUserSnapshot.empty) {
        throw new HttpsError(
          "not-found",
          "事前登録が見つかりません。管理者にお問い合わせください。",
        );
      }
    }

    logger.info(
      `Email availability check passed for: ${email}, isAdmin: ${isAdmin}`,
    );

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
