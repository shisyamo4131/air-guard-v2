import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Company, User } from "@shisyamo4131/air-guard-v2-schemas";

/**
 * Authentication からスローされるエラーのリスト
 */
const AUTH_ERROR_CODE_MAP = {
  "auth/user-disabled": {
    status: "user-disabled",
    message: "このアカウントは無効化されています。",
  },
  "auth/user-not-found": {
    status: "user-not-found",
    message: "メールアドレス、パスワードをご確認ください。",
  },
  "auth/email-already-exists": {
    status: "already-exists",
    message: "このメールアドレスは既に使用されています。",
  },
  "auth/invalid-email": {
    status: "invalid-argument",
    message: "メールアドレスの形式が正しくありません。",
  },
  "auth/invalid-password": {
    status: "invalid-argument",
    message: "パスワードの形式が正しくありません。",
  },
  "auth/weak-password": {
    status: "invalid-argument",
    message: "パスワードが簡単すぎます（最低6文字以上にしてください）。",
  },
};

/**
 * メールアドレスの利用可能性をチェック
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
      "メールアドレスが指定されていません。"
    );
  }

  if (typeof isAdmin !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "isAdminフラグが指定されていません。"
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
        "このメールアドレスは既に使用されています。"
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
          "このメールアドレスは既に管理者として登録されています。"
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
          "事前登録が見つかりません。管理者にお問い合わせください。"
        );
      }
    }

    logger.info(
      `Email availability check passed for: ${email}, isAdmin: ${isAdmin}`
    );

    return { available: true };
  } catch (error) {
    logger.error("checkEmailAvailability でエラーが発生しました:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "メールアドレスチェック中に予期しないエラーが発生しました。"
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
      "会社情報（会社名、会社名カナ、管理者表示名）が不足しています。"
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
        `Company created with ID: ${companyRef.id} for admin UID: ${uid}`
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
        `User document created with ID: ${uid} for UID: ${uid} under company ID: ${companyRef.id}`
      );

      return { companyId: companyRef.id, userId: uid };
    });

    // カスタムクレーム設定
    await auth.setCustomUserClaims(uid, {
      companyId: result.companyId,
      isSuperUser: false,
    });

    logger.info(
      `Custom claims set for UID: ${uid}, CompanyId: ${result.companyId}`
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
      "管理者アカウント作成中に予期しないエラーが発生しました。"
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
      "メールアドレスが指定されていません。"
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
      `Pre-registration found for email: ${email}, CompanyId: ${preRegData.companyId}`
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
      "ユーザー事前登録確認中に予期しないエラーが発生しました。"
    );
  }
});

/**
 * 一般ユーザーアカウント作成
 * クライアント側でAuthentication作成後に呼び出される
 * 認証状態での実行を想定
 * @param {Object} request
 * @param {Object} request.auth - 認証情報
 * @param {Object} request.data
 * @param {string} request.data.companyId - 会社ID
 * @param {string} request.data.tempUserId - 仮ユーザードキュメントID
 * @return {Object} 処理結果
 */
export const setupUserAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const { companyId, tempUserId } = request.data;
  const uid = request.auth.uid;
  const email = request.auth.token.email;

  if (!companyId || !tempUserId) {
    throw new HttpsError(
      "invalid-argument",
      "必須パラメータが不足しています。"
    );
  }

  logger.info(
    `setupUserAccount started for UID: ${uid}, Email: ${email}, CompanyId: ${companyId}`
  );

  try {
    const db = getFirestore();
    const auth = getAuth();

    // 仮Userドキュメントの存在、メールアドレスの一致、仮登録状態であることを確認
    const tempUser = new User();
    const tempUserExists = await tempUser.fetch({
      docId: tempUserId,
      prefix: `Companies/${companyId}`,
    });
    if (!tempUserExists) {
      throw new HttpsError("not-found", "事前登録が見つかりません。");
    }
    if (tempUser.email !== email) {
      throw new HttpsError(
        "permission-denied",
        "メールアドレスが一致しません。"
      );
    }
    if (!tempUser.isTemporary) {
      throw new HttpsError(
        "failed-precondition",
        "このユーザーは既に本登録されています。"
      );
    }

    // 本登録用インスタンスの準備
    const user = new User({ ...tempUser.toObject(), isTemporary: false });

    // トランザクションで本Userドキュメント作成と仮ドキュメント削除
    await db.runTransaction(async (transaction) => {
      await tempUser.delete({ transaction, prefix: `Companies/${companyId}` });
      await user.create({
        docId: uid,
        transaction,
        prefix: `Companies/${companyId}`,
      });

      logger.info(
        `User document created with ID: ${uid} for UID: ${uid}, temp doc deleted: ${tempUserId}`
      );
    });

    // カスタムクレーム設定
    await auth.setCustomUserClaims(uid, {
      companyId,
      isSuperUser: false,
    });

    logger.info(`Custom claims set for UID: ${uid}, CompanyId: ${companyId}`);

    return { success: true };
  } catch (error) {
    logger.error("setupUserAccount でエラーが発生しました:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "ユーザーアカウント作成中に予期しないエラーが発生しました。"
    );
  }
});

/**
 * Switch user enabled/disabled state
 * - Disabled flag is updated in `onUserUpdated` trigger.
 * @param {string} uid - user ID
 * @param {boolean} [enabled] - enabled state (default: true)
 * @returns {Promise<{ success: boolean, uid: string }>} - result
 * @throws {HttpsError} if uid is not provided or if any operation fails
 * @throws {ContextualError} if any operation fails
 */
async function switchUserEnabled(uid, enabled = true) {
  if (!uid) {
    throw new HttpsError("invalid-argument", "UIDが指定されていません。");
  }

  const auth = getAuth();
  const firestore = getFirestore();

  // 1. Authentication でユーザー情報を取得
  const user = await auth.getUser(uid);
  if (!user) {
    throw new HttpsError("not-found", `ユーザー ${uid} が見つかりません。`);
  }

  // 2. カスタムクレームから companyId を取得
  const companyId = user.customClaims?.companyId;
  if (!companyId) {
    throw new HttpsError(
      "failed-precondition",
      "ユーザーの会社情報が見つかりません。"
    );
  }

  // 3. Firestore ドキュメント参照を構築
  const userDocRef = firestore.doc(`Companies/${companyId}/Users/${uid}`);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) {
    throw new HttpsError(
      "not-found",
      `ユーザー ${uid} のFirestoreドキュメントが見つかりません。`
    );
  }

  // 4. disabled フラグを更新
  await userDocRef.update({ disabled: !enabled });

  logger.info(`User ${uid} ${enabled ? "enabled" : "disabled"} successfully`);

  return { success: true, uid };
}

/**
 * ユーザーアカウントを無効化します。
 * 認証状態での実行を想定
 */
export const disableUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const { uid } = request.data;
  if (!uid) {
    throw new HttpsError(
      "invalid-argument",
      "無効化するユーザーIDが指定されていません。"
    );
  }

  try {
    return await switchUserEnabled(uid, false);
  } catch (error) {
    const mappedAuthError = AUTH_ERROR_CODE_MAP[error.code];
    if (mappedAuthError) {
      throw new HttpsError(mappedAuthError.status, mappedAuthError.message);
    }
    throw new HttpsError(
      "internal",
      `ユーザー ${uid} の無効化中に予期しないエラーが発生しました。`
    );
  }
});

/**
 * ユーザーアカウントを有効化します。
 * 認証状態での実行を想定
 */
export const enableUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const { uid } = request.data;
  if (!uid) {
    throw new HttpsError(
      "invalid-argument",
      "有効化するユーザーIDが指定されていません。"
    );
  }

  try {
    return await switchUserEnabled(uid);
  } catch (error) {
    const mappedAuthError = AUTH_ERROR_CODE_MAP[error.code];
    if (mappedAuthError) {
      throw new HttpsError(mappedAuthError.status, mappedAuthError.message);
    }
    throw new HttpsError(
      "internal",
      `ユーザー ${uid} の有効化中に予期しないエラーが発生しました。`
    );
  }
});

/**
 * 管理者ユーザー変更
 * @param {Object} request
 * @param {Object} request.auth - 認証情報
 * @param {Object} request.data
 * @param {string} request.data.from - 移行元ユーザーID
 * @param {string} request.data.to - 移行先ユーザーID
 * @return {Object} 処理結果
 * @return {boolean} return.success - 成功フラグ
 * @return {string} return.from - 移行元ユーザーID
 * @return {string} return.to - 移行先ユーザーID
 * @throws {HttpsError} if any validation or operation fails
 */
export const changeAdminUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const { companyId } = request.auth.token;
  if (!companyId) {
    throw new HttpsError("permission-denied", "会社情報が見つかりません。");
  }

  const { from, to } = request.data;
  if (!from || !to) {
    throw new HttpsError(
      "invalid-argument",
      "移行元・移行先のユーザーIDが指定されていません。"
    );
  }

  const fromUser = new User();
  const fromExists = await fromUser.fetch({
    docId: from,
    prefix: `Companies/${request.auth.token.companyId}`,
  });
  if (!fromExists) {
    throw new HttpsError(
      "not-found",
      `移行元ユーザー ${from} が見つかりません。`
    );
  }

  const toUser = new User();
  const toExists = await toUser.fetch({
    docId: to,
    prefix: `Companies/${request.auth.token.companyId}`,
  });
  if (!toExists) {
    throw new HttpsError(
      "not-found",
      `移行先ユーザー ${to} が見つかりません。`
    );
  }

  try {
    const db = getFirestore();

    const result = await db.runTransaction(async (transaction) => {
      fromUser.isAdmin = false;
      toUser.isAdmin = true;
      const promises = [
        fromUser.update({ transaction, prefix: `Companies/${companyId}` }),
        toUser.update({ transaction, prefix: `Companies/${companyId}` }),
      ];
      await Promise.all(promises);
      return { from: fromUser.docId, to: toUser.docId };
    });

    logger.info(`Admin user changed from ${from} to ${to} successfully`);
    return { success: true, ...result };
  } catch (error) {
    logger.error("changeAdminUser でエラーが発生しました:", error);
    throw new HttpsError(
      "internal",
      `管理者ユーザーの変更中に予期しないエラーが発生しました。`
    );
  }
});
