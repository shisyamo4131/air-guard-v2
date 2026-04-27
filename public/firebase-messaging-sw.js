/**
 * Firebase Cloud Messaging Service Worker
 *
 * バックグラウンドでプッシュ通知を受信するためのService Worker
 * アプリがフォアグラウンドにない時に通知を表示します
 */

// Firebase SDKをCDNからインポート
// Service WorkerではimportScriptが必要 (グローバルスコープに firebase が定義される)
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js",
);

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyCHe-sbpgqvoLpiIdjNv_RbfqXQJomyKi4",
  authDomain: "air-guard-v2-dev.firebaseapp.com",
  projectId: "air-guard-v2-dev",
  storageBucket: "air-guard-v2-dev.firebasestorage.app",
  messagingSenderId: "813992458987",
  appId: "1:813992458987:web:baff452d1d4c3bc1c5dcae",
};

// Firebaseアプリを初期化
firebase.initializeApp(firebaseConfig);

// Firebase Messagingインスタンスを取得
const messaging = firebase.messaging();

// バックグラウンド通知の受信処理
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message:",
    payload,
  );

  // 通知のタイトルと本文を取得
  const notificationTitle = payload.notification?.title || "新しい通知";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: payload.notification?.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
    // 通知をクリックした時のアクション
    actions: [
      {
        action: "open",
        title: "開く",
      },
    ],
  };

  // 通知を表示
  return self.registration.showNotification(
    notificationTitle,
    notificationOptions,
  );
});

// 通知クリック時の処理
self.addEventListener("notificationclick", (event) => {
  console.log("[firebase-messaging-sw.js] Notification clicked:", event);

  // 通知を閉じる
  event.notification.close();

  // 通知データからリンク先を取得
  const urlToOpen = event.notification.data?.clickAction || "/dashboard";

  // アプリを開く
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 既に開いているウィンドウがあればフォーカス
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // なければ新しいウィンドウを開く
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});
