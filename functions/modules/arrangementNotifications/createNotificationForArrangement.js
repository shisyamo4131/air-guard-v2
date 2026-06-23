import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { ArrangementNotification } from "../../schemas/index.js";
/**
 * Create a notification document for an arrangement notification.
 * @param {Object} arrangementData
 * @param {string} companyId
 * @returns {Promise<void>}
 */
export async function createNotificationForArrangement(
  arrangementData,
  companyId,
) {
  const db = getFirestore();
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
        arrangementNotificationId: arrangementData.id,
        siteId: arrangementData.siteId,
        shiftType: arrangementData.shiftType,
      },
      recipientUserIds,
      totalCount: recipientUserIds.length,
      successCount: 0,
      failureCount: 0,
      status: "pending",
      sourceType: "arrangement",
      sourceId: arrangementData.id,
      createdBy: "",
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(
      `Notification document created for arrangementNotification: ${arrangementData.id}`,
    );
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}
