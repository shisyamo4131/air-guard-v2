import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
/*****************************************************************************
 * 配置通知が "上番" に更新されたことを通知するための Notification ドキュメントを
 * 作成します。
 *****************************************************************************/
export async function createNotificationForArrivedArrangement(
  arrangementData,
  companyId,
) {
  const db = getFirestore();
  try {
    // 1. employeeId から Employee を取得
    // → 該当する Employee が存在しない場合は処理を終了
    const employeeSnapshot = await db
      .collection(`Companies/${companyId}/Employees`)
      .doc(arrangementData.employeeId)
      .get();
    if (!employeeSnapshot.exists) {
      const message = `No employee found for employeeId: ${arrangementData.employeeId}`;
      logger.log(message);
      return;
    }
    const employeeName = employeeSnapshot.data()?.displayName ?? "Unknown";

    // 2. siteId から Site を取得
    // → 該当する Site が存在しない場合は処理を終了
    const siteSnapshot = await db
      .collection(`Companies/${companyId}/Sites`)
      .doc(arrangementData.siteId)
      .get();
    if (!siteSnapshot.exists) {
      const message = `No site found for siteId: ${arrangementData.siteId}`;
      logger.log(message);
      return;
    }
    const siteName = siteSnapshot.data()?.name ?? "Unknown";

    // 3. recipientUserIds を収集
    // → User ドキュメントのうち、`receiveArrivedArrangementNotification` が true のものを対象とする
    const usersSnapshot = await db
      .collection(`Companies/${companyId}/Users`)
      .where("receiveArrivedArrangementNotification", "==", true)
      .get();
    if (usersSnapshot.empty) {
      const message = `No users found who receive arrived arrangement notifications.`;
      logger.log(message);
      return;
    }
    const recipientUserIds = usersSnapshot.docs.map((doc) => doc.id);

    // 4. Notification ドキュメントを作成
    await db.collection(`Companies/${companyId}/Notifications`).add({
      title: siteName,
      body: `${employeeName}さんが上番しました。`,
      data: {
        type: "arrangement",
        arrangementNotificationId: arrangementData.docId,
        siteId: arrangementData.siteId,
        shiftType: arrangementData.shiftType,
      },
      recipientUserIds,
      totalCount: recipientUserIds.length,
      successCount: 0,
      failureCount: 0,
      status: "pending",
      sourceType: "arrangement",
      sourceId: arrangementData.docId,
      createdBy: "",
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.log(
      `Notification document created for arrived arrangement: ${arrangementData.docId}`,
    );
  } catch (error) {
    const message = `[createNotificationForArrivedArrangement] Error creating notification for arrangementNotification: ${arrangementData.docId}`;
    logger.error(message, error);
    throw error;
  }
}
