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

    // 対応する Authentication ユーザーを削除
    // → isTemporary=true の仮登録ユーザーの場合は Authentication が存在しないが
    //   deleteUser 関数内でユーザーが存在しない場合のエラーは無視されるため問題なし
    await deleteUser(userId);
  },
);
