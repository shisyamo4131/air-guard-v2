/*****************************************************************************
 * @file ./modules/utils/notifications.js
 * @description 汎用通知送信モジュール
 *****************************************************************************/
import { getMessaging } from "firebase-admin/messaging";
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

// エミュレーター環境かどうかを判定
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

/**
 * 単一トークンに通知を送信
 * @param {string} token - FCMトークン
 * @param {Object} notification - 通知内容 { title, body, imageUrl }
 * @param {Object} data - カスタムデータ（任意）
 * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
 */
export async function sendNotification(token, notification, data = {}) {
  // エミュレーター環境での警告
  if (isEmulator) {
    logger.warn(
      "⚠️ [EMULATOR] Sending REAL push notification using Dev environment!",
      { token, notification, data },
    );
  }

  try {
    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      ...(Object.keys(data).length > 0 && { data }),
    };

    const messageId = await getMessaging().send(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 複数トークンに同じ通知を送信（最大500トークン）
 * @param {string[]} tokens - FCMトークンの配列
 * @param {Object} notification - 通知内容
 * @param {Object} data - カスタムデータ
 * @returns {Promise<Object>} { successCount, failureCount, invalidTokens }
 */
export async function sendMulticastNotification(
  tokens,
  notification,
  data = {},
) {
  if (!tokens || tokens.length === 0) {
    throw new Error("No tokens provided");
  }

  // エミュレーター環境での警告
  if (isEmulator) {
    logger.warn(
      "⚠️ [EMULATOR] Sending REAL push notification using Dev environment!",
      { tokenCount: tokens.length, notification, data },
    );
  }

  const message = {
    tokens: tokens.slice(0, 500), // 最大500件
    notification: {
      title: notification.title,
      body: notification.body,
      ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
    },
    ...(Object.keys(data).length > 0 && { data }),
  };

  const response = await getMessaging().sendEachForMulticast(message);

  // 無効なトークンを抽出（registration-token-not-registered, invalid-registration-token など）
  const invalidTokens = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const errorCode = resp.error?.code;
      if (
        errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token"
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
}

/**
 * 複数トークンに異なる通知を送信（最大500件）
 * @param {Array} messages - { token, notification, data } の配列
 * @returns {Promise<Object>} { successCount, failureCount, invalidTokens }
 */
export async function sendBatchNotifications(messages) {
  if (!messages || messages.length === 0) {
    throw new Error("No messages provided");
  }

  // エミュレーター環境での警告
  if (isEmulator) {
    logger.warn(
      "⚠️ [EMULATOR] Sending REAL push notifications using Dev environment!",
      { messageCount: messages.length },
    );
  }

  const formattedMessages = messages.slice(0, 500).map((msg) => ({
    token: msg.token,
    notification: {
      title: msg.notification.title,
      body: msg.notification.body,
      ...(msg.notification.imageUrl && { imageUrl: msg.notification.imageUrl }),
    },
    ...(msg.data && Object.keys(msg.data).length > 0 && { data: msg.data }),
  }));

  const response = await getMessaging().sendEach(formattedMessages);

  // 無効なトークンを抽出
  const invalidTokens = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const errorCode = resp.error?.code;
      if (
        errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token"
      ) {
        invalidTokens.push(messages[idx].token);
      }
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
}

/**
 * テスト用 HTTP トリガー（開発時のみ使用）
 * デプロイ後、ブラウザから以下のURLでテスト可能：
 * https://asia-northeast1-air-guard-v2.cloudfunctions.net/testNotification?userId=xxx&companyId=xxx
 *
 * ⚠️ テスト時のみ export のコメントを外すこと
 */
export const testNotification = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    try {
      const { userId, companyId } = req.query;

      if (!userId || !companyId) {
        res.status(400).json({
          error: "userId と companyId が必要です",
        });
        return;
      }

      // User ドキュメントを取得
      const userDoc = await getFirestore()
        .doc(`Companies/${companyId}/Users/${userId}`)
        .get();

      if (!userDoc.exists) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const userData = userDoc.data();
      const tokens = userData.fcmTokens || [];

      if (tokens.length === 0) {
        res.status(400).json({ error: "No FCM tokens" });
        return;
      }

      console.log("FCM Tokens to send:", tokens);

      // 通知送信
      const result = await sendMulticastNotification(
        tokens,
        {
          title: "テスト通知",
          body: `${new Date().toLocaleString("ja-JP")} に送信されました`,
        },
        {
          type: "test",
          timestamp: new Date().toISOString(),
        },
      );

      res.json({
        success: true,
        tokens, // デバッグ用にトークンも返す
        ...result,
      });
    } catch (error) {
      console.error("Test notification error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
