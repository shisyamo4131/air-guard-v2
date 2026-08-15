/*****************************************************************************
 * @file ./functions/modules/auth/setupUserAccount.js
 * @description 確認済みメールアドレスに対応する一般Userを本登録します。
 * @method setupUserAccount 一般Userの本登録と会社claimの設定を行います。
 *****************************************************************************/
import { User } from "@shisyamo4131/air-guard-v2-schemas";
import { resolveUserAccountSetupRegistration } from "./userAccountSetupPolicy.js";

export const USER_ACCOUNT_SETUP_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  AUTH_SERVICE_INVALID: "auth-service-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  TARGET_USER_ALREADY_EXISTS: "target-user-already-exists",
});

/**
 * 一般Userの本登録処理で発生するエラーです。
 */
export class UserAccountSetupError extends Error {
  /**
   * @param {string} code - エラーコード
   * @param {string} message - エラーメッセージ
   * @param {{ cause?: unknown }} [options] - エラーの追加情報
   */
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "UserAccountSetupError";
    this.code = code;
  }
}

/**
 * Userドキュメントの参照から会社IDを取得します。
 *
 * `Companies/{companyId}/Users/{userId}` 以外のパスは受け付けません。
 *
 * @param {Object} documentSnapshot - Userドキュメントのsnapshot
 * @returns {string} 会社ID。正しいパスでなければ空文字列
 */
function getCompanyIdFromUserSnapshot(documentSnapshot) {
  const path = documentSnapshot?.ref?.path;
  if (typeof path !== "string") return "";

  const pathSegments = path.split("/");
  if (
    pathSegments.length !== 4 ||
    pathSegments[0] !== "Companies" ||
    pathSegments[2] !== "Users" ||
    pathSegments[3] !== documentSnapshot.id
  ) {
    return "";
  }

  return pathSegments[1];
}

/**
 * 確認済みメールアドレスに対応する一般Userを本登録します。
 *
 * クライアントから会社IDや仮User IDを受け取らず、Authenticationの
 * 確認済みメールアドレスに一致する唯一の仮Userを使用します。
 *
 * @param {Object} param - 本登録に必要な情報
 * @param {Object} param.auth - Firebase Authenticationサービス
 * @param {Object} param.firestore - Firestoreサービス
 * @param {string} param.authUid - 本登録を行うAuthentication UserのUID
 * @param {string} param.authEmail - Authenticationのメールアドレス
 * @param {boolean} param.authEmailVerified - メールアドレス確認済み状態
 * @returns {Promise<{success: boolean, companyId: string, userId: string}>}
 * @throws {UserAccountSetupError} 必須情報やサービスが不正な場合
 * @throws {UserAccountSetupPolicyError} 本登録ポリシーに違反した場合
 */
export async function setupUserAccount({
  auth,
  firestore,
  authUid,
  authEmail,
  authEmailVerified,
} = {}) {
  if (
    typeof authUid !== "string" ||
    !authUid ||
    typeof authEmail !== "string" ||
    !authEmail
  ) {
    throw new UserAccountSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[setupUserAccount] Required fields are missing",
    );
  }

  if (!auth || typeof auth.setCustomUserClaims !== "function") {
    throw new UserAccountSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.AUTH_SERVICE_INVALID,
      "[setupUserAccount] Auth service must provide setCustomUserClaims",
    );
  }

  if (
    !firestore ||
    typeof firestore.collectionGroup !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throw new UserAccountSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[setupUserAccount] Firestore service is invalid",
    );
  }

  const temporaryUsersQuery = firestore
    .collectionGroup("Users")
    .where("email", "==", authEmail)
    .where("isTemporary", "==", true);

  const registration = await firestore.runTransaction(async (transaction) => {
    const temporaryUsersSnapshot = await transaction.get(temporaryUsersQuery);
    const temporaryUserSnapshots = temporaryUsersSnapshot.docs;
    const registrations = temporaryUserSnapshots.map((documentSnapshot) => ({
      ...documentSnapshot.data(),
      id: documentSnapshot.id,
      pathCompanyId: getCompanyIdFromUserSnapshot(documentSnapshot),
    }));

    const selectedRegistration = resolveUserAccountSetupRegistration({
      authUid,
      authEmail,
      authEmailVerified,
      registrations,
    });

    const temporaryUserSnapshot = temporaryUserSnapshots[0];
    const registeredUserRef = temporaryUserSnapshot.ref.parent.doc(authUid);
    const registeredUserSnapshot = await transaction.get(registeredUserRef);

    if (registeredUserSnapshot.exists) {
      throw new UserAccountSetupError(
        USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_ALREADY_EXISTS,
        "[setupUserAccount] Registered User document already exists",
      );
    }

    const temporaryUser = new User({
      ...temporaryUserSnapshot.data(),
      docId: temporaryUserSnapshot.id,
    });

    const registeredUser = new User({
      ...temporaryUser.toObject(),
      isTemporary: false,
    });
    const prefix = `Companies/${selectedRegistration.pathCompanyId}`;

    // User classのschema検証とServerAdapterのUTC日時設定を通して作成する
    await registeredUser.create({
      docId: authUid,
      transaction,
      prefix,
    });

    // Firestoreはdocument IDを変更できないため、旧仮Userを削除する
    await temporaryUser.delete({ transaction, prefix });

    return selectedRegistration;
  });

  await auth.setCustomUserClaims(authUid, {
    companyId: registration.pathCompanyId,
    isSuperUser: false,
  });

  return {
    success: true,
    companyId: registration.pathCompanyId,
    userId: authUid,
  };
}
