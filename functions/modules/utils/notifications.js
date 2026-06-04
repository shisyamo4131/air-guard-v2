/*****************************************************************************
 * @file ./modules/utils/notifications.js
 * @description 汎用通知送信モジュール
 *****************************************************************************/
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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

const FCM_MULTICAST_LIMIT = 500;

/**
 * 複数トークンに同じ通知を送信（500件超は内部でチャンク分割）
 * @param {string[]} tokens - FCMトークンの配列
 * @param {Object} notification - 通知内容
 * @param {Object} data - カスタムデータ
 * @returns {Promise<Object>} { successCount, failureCount, invalidTokens, responses }
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

  // トークンを FCM_MULTICAST_LIMIT 件ずつに分割して送信
  const chunks = [];
  for (let i = 0; i < tokens.length; i += FCM_MULTICAST_LIMIT) {
    chunks.push(tokens.slice(i, i + FCM_MULTICAST_LIMIT));
  }

  const allResponses = [];
  for (const chunk of chunks) {
    const message = {
      tokens: chunk,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      ...(Object.keys(data).length > 0 && { data }),
    };
    const response = await getMessaging().sendEachForMulticast(message);
    response.responses.forEach((resp, idx) => {
      allResponses.push({
        token: chunk[idx],
        success: resp.success,
        messageId: resp.messageId,
        error: resp.error?.message,
        errorCode: resp.error?.code,
      });
    });
  }

  // 無効なトークンを抽出
  const invalidTokens = allResponses
    .filter((r) => {
      if (r.success) return false;
      console.log(`Token failed: ${r.errorCode} - ${r.error}`);
      return (
        r.errorCode === "messaging/registration-token-not-registered" ||
        r.errorCode === "messaging/invalid-registration-token" ||
        r.errorCode === "messaging/invalid-argument"
      );
    })
    .map((r) => r.token);

  return {
    successCount: allResponses.filter((r) => r.success).length,
    failureCount: allResponses.filter((r) => !r.success).length,
    invalidTokens,
    responses: allResponses,
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
// export const testNotification = onRequest(
const testNotification = onRequest(
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

      // FcmTokens コレクションから uid と companyId でトークンを取得
      const fcmTokensSnapshot = await getFirestore()
        .collection("FcmTokens")
        .where("uid", "==", userData.uid)
        .where("companyId", "==", companyId)
        .get();

      const tokens = fcmTokensSnapshot.docs.map((doc) => doc.id); // ドキュメントID = トークン

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

/**
 * Notification ドキュメント作成時のトリガー
 * - recipientUserIds の各ユーザーの FcmToken を取得してプッシュ通知を送信
 * - Recipients サブコレクションに送信結果を記録
 * - Notification ドキュメントに集計結果を保存
 * - 無効なトークンを FcmTokens コレクションから削除
 */
export const onNotificationCreated = onDocumentCreated(
  {
    document: "Companies/{companyId}/Notifications/{notificationId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const db = getFirestore();
    const companyId = event.params.companyId;
    const notificationId = event.params.notificationId;
    const notificationData = event.data.data();
    const {
      title,
      body,
      imageUrl,
      data: customData,
      recipientUserIds = [],
    } = notificationData;

    try {
      // ステータスを processing に更新
      await event.data.ref.update({ status: "processing" });

      // recipientUserIds → uid → FcmToken を収集
      const userTokenMap = {}; // userId → token[]
      for (const userId of recipientUserIds) {
        const userDoc = await db
          .doc(`Companies/${companyId}/Users/${userId}`)
          .get();
        if (!userDoc.exists) {
          userTokenMap[userId] = [];
          continue;
        }
        const { uid } = userDoc.data();
        const fcmTokensSnapshot = await db
          .collection("FcmTokens")
          .where("uid", "==", uid)
          .where("companyId", "==", companyId)
          .get();
        userTokenMap[userId] = fcmTokensSnapshot.docs.map((doc) => doc.id);
      }

      // Recipients サブコレクションを作成（pending）
      const pendingBatch = db.batch();
      for (const userId of recipientUserIds) {
        pendingBatch.set(event.data.ref.collection("Recipients").doc(userId), {
          notificationId,
          userId,
          status: "pending",
          sentAt: null,
          error: "",
        });
      }
      await pendingBatch.commit();

      // 全トークンを収集（重複排除）
      const allTokens = [...new Set(Object.values(userTokenMap).flat())];

      if (allTokens.length === 0) {
        // トークンなし - 全員 failed
        const failedBatch = db.batch();
        for (const userId of recipientUserIds) {
          failedBatch.update(
            event.data.ref.collection("Recipients").doc(userId),
            {
              status: "failed",
              sentAt: FieldValue.serverTimestamp(),
              error: "FCMトークンが登録されていません",
            },
          );
        }
        await failedBatch.commit();
        await event.data.ref.update({
          status: "completed",
          totalCount: recipientUserIds.length,
          successCount: 0,
          failureCount: recipientUserIds.length,
        });
        return;
      }

      // FCM data は文字列型のみ許可されるため変換
      const fcmData = {};
      if (customData) {
        for (const [key, value] of Object.entries(customData)) {
          fcmData[key] = String(value);
        }
      }

      // 通知送信
      const result = await sendMulticastNotification(
        allTokens,
        { title, body, imageUrl },
        fcmData,
      );
      console.log("Send result:", JSON.stringify(result, null, 2));

      // トークン → userId の逆引きマップ
      const tokenUserMap = {};
      for (const [userId, tokens] of Object.entries(userTokenMap)) {
        for (const token of tokens) {
          tokenUserMap[token] = userId;
        }
      }

      // ユーザーごとの送信結果を集計（1つでも成功なら success）
      const userResults = {};
      for (const userId of recipientUserIds) {
        userResults[userId] = { success: false, error: "" };
      }
      for (const resp of result.responses) {
        const userId = tokenUserMap[resp.token];
        if (!userId) continue;
        if (resp.success) {
          userResults[userId].success = true;
          userResults[userId].error = "";
        } else if (!userResults[userId].success) {
          userResults[userId].error = resp.error || "送信失敗";
        }
      }

      // Recipients を更新
      const resultBatch = db.batch();
      for (const [userId, res] of Object.entries(userResults)) {
        resultBatch.update(
          event.data.ref.collection("Recipients").doc(userId),
          {
            status: res.success ? "sent" : "failed",
            sentAt: FieldValue.serverTimestamp(),
            error: res.success ? "" : res.error,
          },
        );
      }
      await resultBatch.commit();

      // 無効トークンを FcmTokens コレクションから削除
      if (result.invalidTokens.length > 0) {
        const invalidBatch = db.batch();
        result.invalidTokens.forEach((token) => {
          invalidBatch.delete(db.collection("FcmTokens").doc(token));
        });
        await invalidBatch.commit();
        console.log(`Removed ${result.invalidTokens.length} invalid tokens`);
      }

      const successUserCount = Object.values(userResults).filter(
        (r) => r.success,
      ).length;
      const failureUserCount = recipientUserIds.length - successUserCount;

      await event.data.ref.update({
        status: "completed",
        totalCount: recipientUserIds.length,
        successCount: successUserCount,
        failureCount: failureUserCount,
      });
      console.log(
        `onNotificationCreated completed: success=${successUserCount}, failure=${failureUserCount}`,
      );
    } catch (error) {
      console.error("Error in onNotificationCreated:", error);
      await event.data.ref.update({ status: "failed" });
    }
  },
);
