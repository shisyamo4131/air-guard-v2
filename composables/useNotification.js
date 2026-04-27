/*****************************************************************************
 * @file ./composables/useNotification.js
 * @description プッシュっ通知に関するコンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

export const NOTIFICATION_STATUS = {
  DEFAULT: "default",
  DENIED: "denied",
  GRANTED: "granted",
  NOT_SUPPORTED: "not-supported",
};

export const NOTIFICATION_STATUS_LABEL = {
  default: "未設定",
  denied: "拒否",
  granted: "許可",
  "not-supported": "非対応",
};
export function useNotification() {
  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  /**
   * 通知権限の状態を保持するリアクティブな変数
   * - default: 未設定
   * - denied: 拒否済み
   * - granted: 許可済み
   * - not-supported: ブラウザが通知をサポートしていない場合
   */
  const permission = Vue.ref(null);

  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useNotification", useErrorsStore());
  const isDev = ref(process.env.NODE_ENV === "development"); // Development environment flag

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * ブラウザの通知権限をリフレッシュして permission に反映させます。
   * - ブラウザが通知をサポートしていない場合は NOT_SUPPORTED を設定します。
   * - 通知がサポートされている場合は Notification.permission を permission に設定します。
   * @returns {void}
   */
  function refreshPermission() {
    if ("Notification" in window) {
      permission.value = Notification.permission;
    } else {
      permission.value = NOTIFICATION_STATUS.NOT_SUPPORTED;
    }
  }

  /**
   * 通知の許可をユーザーにリクエストする
   * @returns {Promise<string>} 許可の結果（granted/denied/default）
   */
  async function requestPermission() {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      permission.value = result;
      return result;
    } else {
      permission.value = NOTIFICATION_STATUS.NOT_SUPPORTED;
      return NOTIFICATION_STATUS.NOT_SUPPORTED;
    }
  }

  /**
   * FCM トークンを取得し、User ドキュメントの fcmTokens 配列に保存します。
   * - ブラウザがプッシュ通知に対応していない場合、または通知の許可が得られていない場合 ('granted' でない場合) は処理を中止します。
   * - Service Worker は plugins/08.firebase-messaging.client.js で登録済み
   * - フォアグラウンドメッセージのハンドリングも plugins/08.firebase-messaging.client.js で行われます
   *
   * @param {*} userInstance - ユーザーインスタンス
   * @returns {Promise<void>}
   */
  async function registFCMToken(userInstance) {
    try {
      // 開発環境であればログを出力
      if (isDev.value) {
        logger.info({
          message: "registFCMToken called.",
          data: { user: toRaw(userInstance) },
        });
      }

      // messaging モジュールを動的インポートして使用
      const { $app } = useNuxtApp();
      const { getMessaging, getToken } = await import("firebase/messaging");
      const messaging = getMessaging($app);

      // messaging インスタンスがない場合は終了
      if (!messaging) {
        logger.warn({ message: "Messaging is not available" });
        return;
      }

      // 通知がサポートされていない場合は終了
      if (!("Notification" in window)) {
        logger.warn({
          message: "This browser does not support notifications.",
        });
        return;
      }

      // 通知権限が許可されていない場合は終了（拒否された場合も含む）
      if (Notification.permission !== NOTIFICATION_STATUS.GRANTED) {
        logger.info({ message: "Notification permission not granted" });
        return;
      }

      // Service Worker の登録を取得（Plugin で既に登録されている）
      const registration = await navigator.serviceWorker.ready;

      // FCMトークンを取得
      const config = useRuntimeConfig();
      const vapidKey = config.public.firebaseVapidKey;

      const currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      // 開発環境であればログを出力
      if (isDev.value) {
        logger.info({
          message: `The current token has been obtained.`,
          data: { currentToken },
        });
      }

      if (!currentToken) {
        logger.warn({ message: "No FCM token available" });
        return;
      }

      // 取得したトークンをユーザードキュメントの fcmTokens 配列に保存
      userInstance.fcmTokens.add(currentToken);
      await userInstance.update();

      // 開発環境であればログを出力
      if (isDev.value) {
        logger.info({ message: "FCM token registered successfully" });
      }
    } catch (error) {
      logger.error({
        message: `Failed to register FCM token: ${error.message}`,
        error,
      });
    }
  }

  return {
    permission,
    refreshPermission,
    requestPermission,
    registFCMToken,
  };
}
