/*****************************************************************************
 * @file ./modules/ArrangementNotifications.js
 * @description ArrangementNotification ドキュメント作成時に Notification ドキュメントを作成するトリガー
 * プッシュ通知の送信は Notification 作成トリガー（onNotificationCreated）が担う
 *****************************************************************************/
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { ArrangementNotification } from "../schemas/index.js";

/**
 * ArrangementNotification 作成時のトリガー
 * - employeeId から該当する User を検索して recipientUserIds を収集
 * - Notification ドキュメントを作成（プッシュ通知は onNotificationCreated が処理）
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
        return;
      }

      // 2. recipientUserIds を収集（Firestore ドキュメント ID がユーザーID）
      const recipientUserIds = usersSnapshot.docs.map((doc) => doc.id);

      // 3. ArrangementNotification インスタンスから日付を取得
      const arrangement = new ArrangementNotification(arrangementData);
      const [, month, day] = arrangement.date.split("-");

      // 4. Notification ドキュメントを作成（onNotificationCreated がプッシュ通知を送信）
      await db.collection(`Companies/${companyId}/Notifications`).add({
        title: "配置通知",
        body: `${parseInt(month)}月${parseInt(day)}日の配置が更新されました。`,
        data: {
          type: "arrangement",
          arrangementNotificationId: notificationId,
          siteId: arrangementData.siteId,
          shiftType: arrangementData.shiftType,
        },
        recipientUserIds,
        totalCount: recipientUserIds.length,
        successCount: 0,
        failureCount: 0,
        status: "pending",
        sourceType: "arrangement",
        sourceId: notificationId,
        createdBy: "",
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `Notification document created for arrangementNotification: ${notificationId}`,
      );
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  },
);
