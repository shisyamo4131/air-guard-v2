import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { createNotificationForArrangement } from "../modules/arrangementNotifications/createNotificationForArrangement.js";

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
      console.log(
        `Skipping arrangementNotification because arrangementData is undefined: ${arrangementData ? arrangementData.id : "unknown"}`,
      );
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
