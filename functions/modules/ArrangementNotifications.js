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
 * - User の uid から FcmToken コレクションを検索
 * - 該当する FcmTokens に対してプッシュ通知を送信
 * - 送信結果を ArrangementNotification ドキュメントに記録
 * - 無効なトークンを FcmTokens コレクションから削除
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

      // 2. User の uid から FcmToken コレクションを検索
      const allTokens = [];
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const fcmTokensSnapshot = await db
          .collection("FcmTokens")
          .where("uid", "==", userData.uid)
          .where("companyId", "==", companyId)
          .get();

        fcmTokensSnapshot.docs.forEach((doc) => {
          allTokens.push(doc.id); // ドキュメントID = トークン
        });
      }

      // 重複トークンを排除（同じデバイスに複数回送信されるのを防ぐ）
      const uniqueTokens = [...new Set(allTokens)];

      if (uniqueTokens.length === 0) {
        console.log(
          `No FCM tokens found for employeeId: ${arrangementData.employeeId}`,
        );
        await event.data.ref.update({
          notificationSentAt: FieldValue.serverTimestamp(),
          notificationError: "FCMトークンが登録されていません",
        });
        return;
      }

      console.log(
        `Found ${allTokens.length} tokens (${uniqueTokens.length} unique) for employeeId: ${arrangementData.employeeId}`,
      );

      // 3. ArrangementNotification インスタンスを作成して日付を取得
      const arrangement = new ArrangementNotification(arrangementData);

      // date プロパティから月日を取得 (formatJstDate で JST 変換済み)
      const [year, month, day] = arrangement.date.split("-");

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
        uniqueTokens,
        notification,
        data,
      );

      // デバッグ: 送信結果を詳細出力
      console.log("Send result:", JSON.stringify(result, null, 2));

      // 5. 送信結果を ArrangementNotification に記録
      // 1件でも成功していれば送信成功とする
      await event.data.ref.update({
        notificationSentAt: FieldValue.serverTimestamp(),
        notificationError:
          result.successCount === 0
            ? `全て送信失敗: ${result.failureCount}件`
            : "",
      });

      // 6. 無効トークンを FcmTokens コレクションから削除
      if (result.invalidTokens && result.invalidTokens.length > 0) {
        console.log(
          `Removing ${result.invalidTokens.length} invalid tokens:`,
          result.invalidTokens,
        );
        const batch = db.batch();
        result.invalidTokens.forEach((token) => {
          batch.delete(db.collection("FcmTokens").doc(token));
        });
        await batch.commit();
        console.log("Invalid tokens removed successfully");
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
