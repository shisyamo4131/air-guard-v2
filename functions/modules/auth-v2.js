import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Company, User } from "@shisyamo4131/air-guard-v2-schemas";

/**
 * メールアドレスの利用可能性をチェック
 * 管理者登録・利用者登録の両方で使用可能
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
      // 管理者登録時: isAdmin=trueのドキュメントが存在すればエラー
      const adminSnapshot = await db
        .collectionGroup("Users")
        .where("email", "==", email)
        .where("isAdmin", "==", true)
        .get();

      if (!adminSnapshot.empty) {
        throw new HttpsError(
          "already-exists",
          "このメールアドレスは既に管理者として登録されています。"
        );
      }
    } else {
      // 利用者登録時: isAdmin=false かつ isTemporary=true のドキュメントが
      // 存在しない場合はエラー（事前登録が必要）
      const tempUserSnapshot = await db
        .collectionGroup("Users")
        .where("email", "==", email)
        .where("isAdmin", "==", false)
        .where("isTemporary", "==", true)
        .get();

      if (tempUserSnapshot.empty) {
        throw new HttpsError(
          "not-found",
          "事前登録が見つかりません。管理者にお問い合わせください。"
        );
      }

      // 本登録済み（isTemporary=false）のドキュメントが存在する場合もエラー
      const registeredUserSnapshot = await db
        .collectionGroup("Users")
        .where("email", "==", email)
        .where("isAdmin", "==", false)
        .where("isTemporary", "==", false)
        .get();

      if (!registeredUserSnapshot.empty) {
        throw new HttpsError(
          "already-exists",
          "このメールアドレスは既に利用者として登録されています。"
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
