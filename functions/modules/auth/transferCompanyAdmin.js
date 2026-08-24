/*****************************************************************************
 * @file ./functions/modules/auth/transferCompanyAdmin.js
 * @description 会社管理者の権限を別のUserへ移譲するモジュールです。
 * @method transferCompanyAdmin 会社管理者の権限を移譲します。
 *****************************************************************************/
import { assertAuthUserCompany } from "./policies/userAuthCompanyPolicy.js";
import { assertCompanyAdminTransferPolicy } from "./policies/companyAdminTransferPolicy.js";

export const COMPANY_ADMIN_TRANSFER_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  AUTH_SERVICE_INVALID: "auth-service-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  SOURCE_USER_NOT_FOUND: "source-user-not-found",
  TARGET_USER_NOT_FOUND: "target-user-not-found",
  TARGET_AUTH_DISABLED_STATE_INVALID: "target-auth-disabled-state-invalid",
  TARGET_AUTH_NOT_ACTIVE: "target-auth-not-active",
});

/**
 * 会社管理者の移譲処理で発生するエラーです。
 */
export class CompanyAdminTransferError extends Error {
  /**
   * @param {string} code - エラーコード
   * @param {string} message - エラーメッセージ
   * @param {{ cause?: unknown }} [options] - エラーの追加情報
   */
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "CompanyAdminTransferError";
    this.code = code;
  }
}

/**
 * 会社管理者の権限を別のUserへ移譲します。
 *
 * @param {Object} param - 管理者移譲に必要な情報
 * @param {Object} param.auth - Firebase Authenticationサービス
 * @param {Object} param.firestore - Firestoreサービス
 * @param {string} param.companyId - 対象会社ID
 * @param {string} param.actorUid - 操作を実行したUserのUID
 * @param {string} param.fromUid - 移譲元UserのUID
 * @param {string} param.toUid - 移譲先UserのUID
 * @returns {Promise<{success: boolean, from: string, to: string}>}
 * @throws {CompanyAdminTransferError} 必須情報やサービスが不正な場合
 * @throws {UserAuthCompanyPolicyError} Auth Userと会社の整合性がない場合
 * @throws {CompanyAdminTransferPolicyError} 管理者移譲ポリシーに違反した場合
 */
export async function transferCompanyAdmin({
  auth,
  firestore,
  companyId,
  actorUid,
  fromUid,
  toUid,
} = {}) {
  if (
    typeof companyId !== "string" ||
    !companyId ||
    typeof actorUid !== "string" ||
    !actorUid ||
    typeof fromUid !== "string" ||
    !fromUid ||
    typeof toUid !== "string" ||
    !toUid
  ) {
    throw new CompanyAdminTransferError(
      COMPANY_ADMIN_TRANSFER_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[transferCompanyAdmin] Required fields are missing",
    );
  }

  if (!auth || typeof auth.getUser !== "function") {
    throw new CompanyAdminTransferError(
      COMPANY_ADMIN_TRANSFER_ERROR_CODES.AUTH_SERVICE_INVALID,
      "[transferCompanyAdmin] Auth service must provide getUser",
    );
  }

  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.collection !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throw new CompanyAdminTransferError(
      COMPANY_ADMIN_TRANSFER_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[transferCompanyAdmin] Firestore service is invalid",
    );
  }

  // 移譲先のAuth Userを取得して、UIDと会社claimを検証
  const targetAuthUser = await auth.getUser(toUid);

  // 移譲先 User の所属会社の整合性を検証 → 不整合の場合は例外をスロー
  assertAuthUserCompany({
    pathCompanyId: companyId,
    docId: toUid,
    authUser: targetAuthUser,
  });

  // 移譲先のAuth disabled状態をfail-closedで検証
  if (typeof targetAuthUser.disabled !== "boolean") {
    throw new CompanyAdminTransferError(
      COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_AUTH_DISABLED_STATE_INVALID,
      "[transferCompanyAdmin] Target Auth disabled state is invalid",
    );
  }

  if (targetAuthUser.disabled === true) {
    throw new CompanyAdminTransferError(
      COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_AUTH_NOT_ACTIVE,
      "[transferCompanyAdmin] Target Auth user is not active",
    );
  }

  const usersCollectionPath = `Companies/${companyId}/Users`;
  const fromUserRef = firestore.doc(`${usersCollectionPath}/${fromUid}`);
  const toUserRef = firestore.doc(`${usersCollectionPath}/${toUid}`);
  const currentAdminsQuery = firestore
    .collection(usersCollectionPath)
    .where("isAdmin", "==", true);

  return firestore.runTransaction(async (transaction) => {
    // Firestoreの読み取りはすべて更新より前に実行する
    const fromSnapshot = await transaction.get(fromUserRef);
    const toSnapshot = await transaction.get(toUserRef);
    const currentAdminsSnapshot = await transaction.get(currentAdminsQuery);

    if (!fromSnapshot.exists) {
      throw new CompanyAdminTransferError(
        COMPANY_ADMIN_TRANSFER_ERROR_CODES.SOURCE_USER_NOT_FOUND,
        "[transferCompanyAdmin] Source user not found",
      );
    }

    if (!toSnapshot.exists) {
      throw new CompanyAdminTransferError(
        COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_USER_NOT_FOUND,
        "[transferCompanyAdmin] Target user not found",
      );
    }

    const fromUser = fromSnapshot.data();
    const toUser = toSnapshot.data();
    const currentAdminUids = currentAdminsSnapshot.docs.map(
      (documentSnapshot) => documentSnapshot.id,
    );

    // 管理者権限移譲処理ポリシーを検証 → 不整合の場合は例外をスロー
    assertCompanyAdminTransferPolicy({
      companyId,
      actorUid,
      fromUid,
      fromUser,
      toUid,
      toUser,
      currentAdminUids,
    });

    // 2件を同じFirestoreトランザクション内で更新する
    // 管理者権限移譲先 User の role は初期化する
    transaction.update(fromUserRef, { isAdmin: false });
    transaction.update(toUserRef, { isAdmin: true, roles: [] });

    return { success: true, from: fromUid, to: toUid };
  });
}
