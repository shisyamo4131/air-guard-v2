/*****************************************************************************
 * @file ./functions/triggers/user.js
 * @description User ドキュメントの更新・削除トリガーを定義するモジュールです。
 * @method onUserUpdated - User ドキュメントの更新トリガーを定義します。
 * @method onUserDeleted - User ドキュメントの削除トリガーを定義します。
 *****************************************************************************/
import {
  onDocumentDeleted,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { deleteUser } from "../modules/auth/deleteUser.js";
import { syncUserAuthAccount } from "../modules/auth/syncUserAuthAccount.js";

/**
 * 削除されたUserに対応するAuthentication Userを削除してよいか判定します。
 *
 * 本登録済みであることを明示的に確認できない場合は、Auth削除を許可しません。
 *
 * @param {Object} userData - 削除されたUserドキュメントのデータ
 * @returns {boolean} Authentication Userを削除してよい場合はtrue
 */
export function shouldDeleteAuthUser(userData) {
  return userData?.isTemporary === false;
}

/*****************************************************************************
 * User ドキュメントの更新トリガー
 *****************************************************************************/
export const onUserUpdated = onDocumentUpdated(
  "Companies/{companyId}/Users/{docId}",
  async (event) => {
    // User ドキュメントの変更に基づいて Auth アカウントを同期
    return syncUserAuthAccount({
      auth: getAuth(),
      pathCompanyId: event.params.companyId,
      docId: event.params.docId,
      beforeData: event.data.before.data(),
      afterData: event.data.after.data(),
    });
  },
);

/*****************************************************************************
 * User ドキュメントの削除トリガー
 * - 対応する Firebase Authentication ユーザーを削除します。
 *****************************************************************************/
export const onUserDeleted = onDocumentDeleted(
  "Companies/{companyId}/Users/{docId}",
  async (event) => {
    const userId = event.params.docId;
    const deletedUser = event.data?.data();

    // 仮登録Userや状態を確認できないUserの削除ではAuthへ作用しない
    if (!shouldDeleteAuthUser(deletedUser)) return;

    // 本登録Userに対応するAuthentication Userを削除
    await deleteUser(userId);
  },
);
