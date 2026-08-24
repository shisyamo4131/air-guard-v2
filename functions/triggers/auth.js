/*****************************************************************************
 * @file ./functions/triggers/auth.js
 * @description Firebase Authentication Userのイベントトリガーを定義するモジュールです。
 * @method onAuthUserDeleted Authentication User削除時に関連dataを整理します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import * as functions from "firebase-functions/v1";
import { FcmToken } from "@shisyamo4131/air-guard-v2-schemas";

/**
 * Triggered when a Firebase Authentication user is deleted.
 * - This function is called when a user account is deleted from Firebase Authentication.
 * - Cleans up user-related data (e.g., FCM tokens).
 */
export const onAuthUserDeleted = functions
  .region("asia-northeast1")
  .auth.user()
  .onDelete(async (user) => {
    try {
      // FcmTokensコレクションから該当ドキュメントを削除
      const deletedCount = await FcmToken.deleteByUid(user.uid);

      if (deletedCount === 0) {
        logger.info("Authentication deletion FCM cleanup completed", {
          deletedCount: 0,
        });
      } else {
        logger.info("Authentication deletion FCM cleanup completed", {
          deletedCount,
        });
      }
    } catch (error) {
      logger.error("Authentication deletion FCM cleanup failed", {
        errorName: error?.name,
        errorCode: error?.code,
      });
      // エラーが発生してもトリガーは失敗させない（他のクリーンアップ処理を妨げないため）
    }
  });
