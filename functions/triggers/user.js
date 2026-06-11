import {
  onDocumentDeleted,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { deleteUser } from "../modules/auth/deleteUser.js";

/*****************************************************************************
 * User ドキュメントの更新トリガー
 * - displayName または disabled フィールドが変更された場合、対応する Firebase Authentication ユーザーを更新します。
 * - isTemporary=true の仮登録ユーザーの場合は Authentication が存在しないため更新不要
 *****************************************************************************/
export const onUserUpdated = onDocumentUpdated(
  "Companies/{companyId}/Users/{docId}",
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const userId = event.params.docId;

    if (afterData.isTemporary) return;

    const needsAuthUpdate =
      beforeData.displayName !== afterData.displayName ||
      beforeData.disabled !== afterData.disabled;

    if (needsAuthUpdate) {
      await getAuth().updateUser(userId, {
        displayName: afterData.displayName,
        disabled: afterData.disabled,
      });
    }
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
