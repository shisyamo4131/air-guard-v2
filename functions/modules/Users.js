/*****************************************************************************
 * User document updated trigger
 *****************************************************************************/
import {
  onDocumentDeleted,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";

export const onUserUpdated = onDocumentUpdated(
  "Companies/{companyId}/Users/{docId}",
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const userId = event.params.docId;

    if (afterData.isTemporary) return;

    if (
      beforeData.displayName !== afterData.displayName ||
      beforeData.disabled !== afterData.disabled
    ) {
      await getAuth().updateUser(userId, {
        displayName: afterData.displayName,
        disabled: afterData.disabled,
      });
    }
  }
);

/**
 * Triggered when a user document is deleted.
 * - Deletes the corresponding Firebase Authentication user.
 * - isTemporary=true の仮登録ユーザーの場合は Authentication が存在しないため削除不要
 */
export const onUserDeleted = onDocumentDeleted(
  "Companies/{companyId}/Users/{docId}",
  async (event) => {
    const userId = event.params.docId;
    const userData = event.data.data();

    // 仮登録ユーザー（isTemporary=true）の場合は Authentication が存在しないためスキップ
    if (userData?.isTemporary) return;

    try {
      const auth = getAuth();
      await auth.deleteUser(userId);
    } catch (error) {
      // ユーザーが既に削除されている場合はエラーを無視
      if (error.code === "auth/user-not-found") {
        console.warn(
          `Authentication user ${userId} not found, skipping deletion.`
        );
        return;
      }
      // その他のエラーは再スロー
      throw error;
    }
  }
);
