/*****************************************************************************
 * @file ./plugins/08.firebase-messaging.client.js
 * @description FCM フォアグラウンドメッセージハンドリングと Service Worker 登録
 *
 * 処理内容:
 * 1. Service Worker を登録（@vite-pwa/nuxt の injectManifest モードでは手動登録が必要）
 * 2. フォアグラウンドメッセージのハンドラーを登録（アプリがアクティブな時の通知）
 *
 * 注意:
 * - injectManifest モードでは Service Worker の自動登録スクリプトが生成されないため手動登録
 * - Service Worker には Workbox と Firebase Messaging が統合されている
 *****************************************************************************/
export default defineNuxtPlugin(async () => {
  // ブラウザ環境のみで実行
  if (typeof window === "undefined") return;

  // 通知がサポートされていない場合は終了
  if (!("Notification" in window)) return;

  // Service Worker がサポートされていない場合は終了
  if (!("serviceWorker" in navigator)) return;

  // Service Worker を登録
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("[SW] Service Worker registered:", registration.scope);
  } catch (error) {
    console.error("[SW] Service Worker registration failed:", error);
    return;
  }

  // 通知権限が許可されていない場合は終了
  if (Notification.permission !== "granted") {
    console.log("[FCM] Notification permission not granted yet");
    return;
  }

  try {
    // Service Worker の準備を待つ
    const registration = await navigator.serviceWorker.ready;

    // Firebase Messaging を動的インポート
    const { $app } = useNuxtApp();
    const { getMessaging, onMessage } = await import("firebase/messaging");
    const messaging = getMessaging($app);

    // フォアグラウンドメッセージのハンドリング
    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message received:", payload);

      const notificationTitle = payload.notification?.title || "通知";
      const notificationOptions = {
        body: payload.notification?.body || "",
        icon: payload.notification?.icon || "/icon-192.png",
        data: payload.data || {},
      };

      registration.showNotification(notificationTitle, notificationOptions);
    });

    console.log("[FCM] Foreground message handler registered");
  } catch (error) {
    console.error("[FCM] Error:", error);
  }
});
