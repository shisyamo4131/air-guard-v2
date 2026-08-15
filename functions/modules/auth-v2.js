import { logger } from "firebase-functions";
import * as functions from "firebase-functions/v1";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Company, FcmToken, User } from "@shisyamo4131/air-guard-v2-schemas";

// User の有効状態切替
import { changeUserEnabledState } from "./auth/changeUserEnabledState.js";
import { mapUserEnabledStateError } from "./auth/mapUserEnabledStateError.js";

// 管理者権限移譲処理
import { transferCompanyAdmin } from "./auth/transferCompanyAdmin.js";
import { mapCompanyAdminTransferError } from "./auth/mapCompanyAdminTransferError.js";

// 一般User本登録処理
import { setupUserAccount as setupUserAccountUseCase } from "./auth/setupUserAccount.js";
import { mapUserAccountSetupError } from "./auth/mapUserAccountSetupError.js";

/**
 * メールアドレスの利用可不可をチェック（グローバル）
 * - Users コレクションについて、グローバルにメールアドレスの重複をチェックします。
 * - authentication でアカウントが作成される前に、User ドキュメントが isTemporary === true で
 *   作成されている可能性があるため、User ドキュメントの作成前には必ずこの関数で
 *   メールアドレスの重複チェックを行う必要があります。
 * @property {string} email - チェックするメールアドレス
 * @returns {Object} 利用可不可結果 { available: true }
 * @throws {HttpsError} メールアドレスが指定されていない場合、またはチェック中に予期しないエラーが発生した場合
 * @throws {HttpsError} メールアドレスが他の User ドキュメントで既に使用されている場合
 */
export const checkEmailAvailabilityGlobal = onCall(async (request) => {
  const { email } = request.data;

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "メールアドレスが指定されていません。",
    );
  }

  try {
    const db = getFirestore();
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
 * - isTemporary=true のドキュメントが存在することを確認（事前登録チェック）
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

/**
 * 管理者アカウント作成
 * クライアント側でAuthentication作成後に呼び出される
 * 認証状態での実行を想定
 * @param {Object} request
 * @param {Object} request.auth - 認証情報
 * @param {Object} request.data
 * @param {string} request.data.companyName - 会社名
 * @param {string} request.data.companyNameKana - 会社名カナ
 * @param {string} request.data.displayName - 管理者表示名
 */
export const createAdminAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const { companyName, companyNameKana, displayName } = request.data;
  const uid = request.auth.uid;
  const email = request.auth.token.email;

  if (!companyName || !companyNameKana || !displayName) {
    throw new HttpsError(
      "invalid-argument",
      "会社情報（会社名、会社名カナ、管理者表示名）が不足しています。",
    );
  }

  logger.info(`createAdminAccount started for UID: ${uid}, Email: ${email}`);

  try {
    const db = getFirestore();
    const auth = getAuth();

    // トランザクションでCompanyとUser作成
    const result = await db.runTransaction(async (transaction) => {
      // Company作成
      const company = new Company({
        companyName: companyName,
        companyNameKana: companyNameKana,
      });

      const companyRef = await company.create({ transaction });

      logger.info(
        `Company created with ID: ${companyRef.id} for admin UID: ${uid}`,
      );

      // User作成（Companiesのサブコレクション、uidをdocIdとして使用）
      const user = new User({
        email,
        displayName: displayName || "",
        companyId: companyRef.id,
        isAdmin: true,
        isTemporary: false,
      });

      await user.create({
        docId: uid,
        transaction,
        prefix: `Companies/${companyRef.id}`,
      });

      logger.info(
        `User document created with ID: ${uid} for UID: ${uid} under company ID: ${companyRef.id}`,
      );

      return { companyId: companyRef.id, userId: uid };
    });

    // カスタムクレーム設定
    await auth.setCustomUserClaims(uid, {
      companyId: result.companyId,
      isSuperUser: false,
    });

    logger.info(
      `Custom claims set for UID: ${uid}, CompanyId: ${result.companyId}`,
    );

    return {
      success: true,
      companyId: result.companyId,
      userId: result.userId,
    };
  } catch (error) {
    logger.error("createAdminAccount でエラーが発生しました:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "管理者アカウント作成中に予期しないエラーが発生しました。",
    );
  }
});

/**
 * ユーザー事前登録確認
 * 利用者自身が本登録を行う際に、管理者による仮登録が完了しているかどうかを確認
 * 未認証状態での実行も想定されるため、request.auth のチェックは行わない。
 * @param {Object} request
 * @param {Object} request.data
 * @param {string} request.data.email - 確認するメールアドレス
 * @return {Object} 登録状況と仮登録情報
 * @return {boolean} return.isPreRegistered - 事前登録されているかどうか
 * @return {string} [return.companyId] - 事前登録されている場合の会社ID
 * @return {string} [return.displayName] - 事前登録されている場合の表示名
 * @return {Array} [return.roles] - 事前登録されている場合の役割リスト
 * @return {string} [return.tempUserId] - 事前登録されている場合の仮ユーザードキュメントID
 */
export const checkUserPreRegistration = onCall(async (request) => {
  const { email } = request.data;

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "メールアドレスが指定されていません。",
    );
  }

  try {
    const db = getFirestore();

    // コレクショングループクエリで仮Userドキュメントを検索
    const preRegSnapshot = await db
      .collectionGroup("Users")
      .where("email", "==", email)
      .where("isTemporary", "==", true)
      .get();

    if (preRegSnapshot.empty) {
      logger.info(`No pre-registration found for email: ${email}`);
      return { isPreRegistered: false };
    }

    const preRegDoc = preRegSnapshot.docs[0];
    const preRegData = preRegDoc.data();

    logger.info(
      `Pre-registration found for email: ${email}, CompanyId: ${preRegData.companyId}`,
    );

    return {
      isPreRegistered: true,
      companyId: preRegData.companyId,
      displayName: preRegData.displayName || "",
      roles: preRegData.roles || [],
      tempUserId: preRegDoc.id,
    };
  } catch (error) {
    logger.error("checkUserPreRegistration でエラーが発生しました:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "ユーザー事前登録確認中に予期しないエラーが発生しました。",
    );
  }
});

/**
 * 一般User本登録Callableを処理します。
 *
 * Authenticationの確認済みメールアドレスから事前登録を解決するため、
 * クライアント指定の会社ID・仮User IDは使用しません。policyを含む
 * use-caseとFirebaseサービスは固定し、実装依存関係を差し替える
 * production APIは公開しません。
 *
 * @param {Object} request - Callableリクエスト
 * @return {Promise<{success: boolean, companyId: string, userId: string}>}
 */
async function handleSetupUserAccountRequest(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  try {
    return await setupUserAccountUseCase({
      auth: getAuth(),
      firestore: getFirestore(),
      authUid: request.auth.uid,
      authEmail: request.auth.token?.email,
      authEmailVerified: request.auth.token?.email_verified,
    });
  } catch (error) {
    const mappedError = mapUserAccountSetupError(error);
    logger.error("User account setup failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
}

export const setupUserAccount = onCall(async (request) => {
  return handleSetupUserAccountRequest(request);
});

/**
 * 利用者の有効・無効状態変更リクエストを処理します。
 * @param {Object} request - Callable リクエスト
 * @param {boolean} enabled - 変更後の有効状態
 * @returns {Promise<{ success: boolean, uid: string }>}
 */
async function handleUserEnabledStateChangeRequest(request, enabled) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const targetUid = request.data?.uid;

  if (typeof targetUid !== "string" || !targetUid) {
    throw new HttpsError(
      "invalid-argument",
      "対象ユーザーIDが指定されていません。",
    );
  }

  const actorUid = request.auth.uid;
  const companyId = request.auth.token?.companyId;

  if (
    typeof actorUid !== "string" ||
    !actorUid ||
    typeof companyId !== "string" ||
    !companyId
  ) {
    throw new HttpsError("permission-denied", "認証情報を確認できません。");
  }

  try {
    return await changeUserEnabledState({
      auth: getAuth(),
      firestore: getFirestore(),
      companyId,
      actorUid,
      targetUid,
      enabled,
    });
  } catch (error) {
    const mappedError = mapUserEnabledStateError(error);
    logger.error("User enabled state change failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
}

/**
 * User アカウントを無効化します。
 */
export const disableUser = onCall(async (request) => {
  return handleUserEnabledStateChangeRequest(request, false);
});

/**
 * User アカウントを有効化します。
 */
export const enableUser = onCall(async (request) => {
  return handleUserEnabledStateChangeRequest(request, true);
});

/**
 * 会社管理者の権限を別のUserへ移譲します。
 *
 * @param {Object} request - Callableリクエスト
 * @param {Object} request.auth - 認証情報
 * @param {Object} request.data - リクエストデータ
 * @param {string} request.data.from - 移譲元UserのUID
 * @param {string} request.data.to - 移譲先UserのUID
 * @returns {Promise<{success: boolean, from: string, to: string}>}
 * @throws {HttpsError} 認証または管理者移譲に失敗した場合
 */
export const changeAdminUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const actorUid = request.auth.uid;
  const companyId = request.auth.token?.companyId;
  const fromUid = request.data?.from;
  const toUid = request.data?.to;

  if (
    typeof actorUid !== "string" ||
    !actorUid ||
    typeof companyId !== "string" ||
    !companyId
  ) {
    throw new HttpsError("permission-denied", "認証情報を確認できません。");
  }

  try {
    return await transferCompanyAdmin({
      auth: getAuth(),
      firestore: getFirestore(),
      companyId,
      actorUid,
      fromUid,
      toUid,
    });
  } catch (error) {
    const mappedError = mapCompanyAdminTransferError(error);

    logger.error("Company admin transfer failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
});

/**
 * Triggered when a Firebase Authentication user is deleted.
 * - This function is called when a user account is deleted from Firebase Authentication.
 * - Cleans up user-related data (e.g., FCM tokens).
 */
export const onAuthUserDeleted = functions
  .region("asia-northeast1")
  .auth.user()
  .onDelete(async (user) => {
    logger.info(`Authentication user deleted: ${user.uid}`);
    logger.info(`Email: ${user.email || "N/A"}`);

    try {
      // FcmTokensコレクションから該当ドキュメントを削除
      const deletedCount = await FcmToken.deleteByUid(user.uid);

      if (deletedCount === 0) {
        logger.info(`No FCM token documents found for user: ${user.uid}`);
      } else {
        logger.info(
          `Deleted ${deletedCount} FCM token document(s) for user: ${user.uid}`,
        );
      }
    } catch (error) {
      logger.error(`Error deleting FCM token for user ${user.uid}:`, error);
      // エラーが発生してもトリガーは失敗させない（他のクリーンアップ処理を妨げないため）
    }
  });
