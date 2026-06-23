import { logger } from "firebase-functions";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { createNotificationForArrangement } from "../modules/notifications/createNotificationForArrangement.js";
import { createNotificationForConfirmedArrangement } from "../modules/notifications/createNotificationForConfirmedArrangement.js";
import { createNotificationForArrivedArrangement } from "../modules/notifications/createNotificationForArrivedArrangement.js";
import { createNotificationForLeavedArrangement } from "../modules/notifications/createNotificationForLeavedArrangement.js";

/*****************************************************************************
 * ArrangementNotification 作成時のトリガー
 * - employeeId から該当する User を検索して recipientUserIds を収集
 * - Notification ドキュメントを作成（プッシュ通知は onNotificationCreated が処理）
 *****************************************************************************/
export const onArrangementNotificationCreated = onDocumentCreated(
  {
    document: "Companies/{companyId}/ArrangementNotifications/{notificationId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const arrangementData = event.data.data();

    /*****************************************************************************
     * 2026-06-19 不具合発生（Emulator 環境）
     * 配置管理画面で現場稼働予定に対して作業員（従業員）を配置し、その後当該作業員を
     * 削除すると、なぜか onArrangementNotificationCreated がトリガーされてしまう。
     * → そもそも ArrangementNotification ドキュメントの作成処理は行われていない。
     * 結果、arrangementData.shouldNotify が undefined となり、意図しないエラーが発生する。
     * Dev 環境にデプロイし、同様のエラーが発生するかどうかを確認する必要あり。
     * → Dev 環境では再現しなかったがめ、Emulator の不具合と断定。
     * → エラーログが煩わしいので arrangementData が undefined の場合はスキップするように修正。
     *****************************************************************************/
    if (arrangementData === undefined) {
      const message = `Skipping arrangementNotification because arrangementData is undefined: ${arrangementData ? arrangementData.docId : "unknown"}`;
      logger.log(message);
      return;
    }

    const shouldNotify = arrangementData.shouldNotify ?? true; // デフォルトは true
    if (shouldNotify) {
      await createNotificationForArrangement(
        arrangementData,
        event.params.companyId,
      );
    }
  },
);

/*****************************************************************************
 * ArrangementNotification ドキュメントの更新トリガー
 *****************************************************************************/
export const onArrangementNotificationUpdated = onDocumentUpdated(
  {
    document: "Companies/{companyId}/ArrangementNotifications/{notificationId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    /*****************************************************************************
     * `onArrangementNotificationCreated` ハンドラーと同じように、念のため
     * 更新前後の data が取れていなければ処理をスキップ
     *****************************************************************************/
    if (beforeData === undefined || afterData === undefined) {
      const message = `Skipping arrangementNotification because beforeData or afterData is undefined: ${afterData ? afterData.docId : "unknown"}`;
      logger.log(message);
      return;
    }

    // 1. `CONFIRMED` に変更された場合
    if (beforeData.status !== "CONFIRMED" && afterData.status === "CONFIRMED") {
      const message = `ArrangementNotification status changed to CONFIRMED: ${afterData.docId}`;
      logger.log(message);
      await createNotificationForConfirmedArrangement(
        afterData,
        event.params.companyId,
      );
    }

    // 2. `ARRIVED` に変更された場合
    if (beforeData.status !== "ARRIVED" && afterData.status === "ARRIVED") {
      const message = `ArrangementNotification status changed to ARRIVED: ${afterData.docId}`;
      logger.log(message);
      await createNotificationForArrivedArrangement(
        afterData,
        event.params.companyId,
      );
    }

    // 3. `LEAVED` に変更された場合
    if (beforeData.status !== "LEAVED" && afterData.status === "LEAVED") {
      const message = `ArrangementNotification status changed to LEAVED: ${afterData.docId}`;
      logger.log(message);
      await createNotificationForLeavedArrangement(
        afterData,
        event.params.companyId,
      );
    }
  },
);
