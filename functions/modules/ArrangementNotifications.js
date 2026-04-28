/*****************************************************************************
 * @file ./modules/ArrangementNotifications.js
 * @description ArrangementNotification ドキュメント作成時のプッシュ通知送信トリガー
 *****************************************************************************/
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { sendMulticastNotification } from "./utils/notifications.js";
import { ArrangementNotification } from "../schemas/index.js";

/**
 * ArrangementNotification 作成時のトリガー
 * - employeeId から User を検索
 * - 該当ユーザーの fcmTokens に対してプッシュ通知を送信
 * - 送信結果を ArrangementNotification ドキュメントに記録
 * - 無効なトークンをユーザードキュメントから削除
 */
export const onArrangementNotificationCreated = onDocumentCreated(
  {
    document: "Companies/{companyId}/ArrangementNotifications/{notificationId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const db = getFirestore();
    const companyId = event.params.companyId;
    const notificationId = event.params.notificationId;
    const arrangementData = event.data.data();

    try {
      // 1. employeeId から該当する User を検索
      const usersSnapshot = await db
        .collection(`Companies/${companyId}/Users`)
        .where("employeeId", "==", arrangementData.employeeId)
        .get();

      if (usersSnapshot.empty) {
        console.log(
          `No user found for employeeId: ${arrangementData.employeeId}`,
        );
        await event.data.ref.update({
          notificationSentAt: FieldValue.serverTimestamp(),
          notificationError: "該当するユーザーが見つかりませんでした",
        });
        return;
      }

      // 2. 複数ユーザーが見つかる可能性があるため、全ユーザーの fcmTokens を収集
      const allTokens = [];
      usersSnapshot.docs.forEach((doc) => {
        const userData = doc.data();
        if (userData.fcmTokens && userData.fcmTokens.length > 0) {
          allTokens.push(...userData.fcmTokens);
        }
      });

      if (allTokens.length === 0) {
        console.log(
          `No FCM tokens found for employeeId: ${arrangementData.employeeId}`,
        );
        await event.data.ref.update({
          notificationSentAt: FieldValue.serverTimestamp(),
          notificationError: "FCMトークンが登録されていません",
        });
        return;
      }

      // 3. ArrangementNotification インスタンスを作成して日付を取得
      const arrangement = new ArrangementNotification(arrangementData);
      
      // date プロパティから月日を取得 (formatJstDate で JST 変換済み)
      const [year, month, day] = arrangement.date.split('-');

      const notification = {
        title: "配置通知",
        body: `${parseInt(month)}月${parseInt(day)}日の配置が更新されました。`,
      };

      const data = {
        type: "arrangement",
        arrangementNotificationId: notificationId,
        siteId: arrangementData.siteId,
        shiftType: arrangementData.shiftType,
      };

      // 4. sendMulticastNotification で送信
      const result = await sendMulticastNotification(
        allTokens,
        notification,
        data,
      );

      // 5. 送信結果を ArrangementNotification に記録
      await event.data.ref.update({
        notificationSentAt: FieldValue.serverTimestamp(),
        notificationError:
          result.failureCount > 0 ? `送信失敗: ${result.failureCount}件` : "",
      });

      // 6. 無効トークンをユーザードキュメントから削除
      if (result.invalidTokens && result.invalidTokens.length > 0) {
        const batch = db.batch();
        usersSnapshot.docs.forEach((doc) => {
          const userData = doc.data();
          if (userData.fcmTokens) {
            const validTokens = userData.fcmTokens.filter(
              (token) => !result.invalidTokens.includes(token),
            );
            if (validTokens.length !== userData.fcmTokens.length) {
              batch.update(doc.ref, { fcmTokens: validTokens });
            }
          }
        });
        await batch.commit();
      }

      console.log(
        `Notification sent: success=${result.successCount}, failure=${result.failureCount}`,
      );
    } catch (error) {
      console.error("Error sending notification:", error);
      await event.data.ref.update({
        notificationSentAt: FieldValue.serverTimestamp(),
        notificationError: error.message,
      });
    }
  },
);
