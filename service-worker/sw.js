/**
 * Custom Service Worker with Workbox and FCM
 * @vite-pwa/nuxt injectManifest モードで使用
 */

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging/sw";

// Workbox のログを無効化
self.__WB_DISABLE_DEV_LOGS = true;

// プリキャッシュの設定（Vite PWA が自動注入）
precacheAndRoute(self.__WB_MANIFEST);

// 古いキャッシュをクリーンアップ
cleanupOutdatedCaches();

// SPA のルーティング設定（開発環境ではスキップ）
if (self.__WB_MANIFEST && self.__WB_MANIFEST.length > 0) {
  try {
    const handler = createHandlerBoundToURL("/");
    const navigationRoute = new NavigationRoute(handler);
    registerRoute(navigationRoute);
    console.log("[SW] SPA routing configured");
  } catch (e) {
    console.warn(
      "[SW] SPA routing setup failed (development mode):",
      e.message,
    );
  }
}

console.log("[SW] Workbox initialized");

/**
 * Firebase の設定
 *
 * 注意: 現在はDev環境の値をハードコードしています
 */
const firebaseConfig = {
  apiKey: "AIzaSyCHe-sbpgqvoLpiIdjNv_RbfqXQJomyKi4",
  authDomain: "air-guard-v2-dev.firebaseapp.com",
  projectId: "air-guard-v2-dev",
  storageBucket: "air-guard-v2-dev.firebasestorage.app",
  messagingSenderId: "813992458987",
  appId: "1:813992458987:web:baff452d1d4c3bc1c5dcae",
};

console.log("[SW] Firebase config loaded for:", firebaseConfig.projectId);

// Firebase 初期化
const app = initializeApp(firebaseConfig);
console.log("[SW] Firebase initialized");

// FCM の初期化（バックグラウンド通知は FCM が自動表示）
isSupported().then((supported) => {
  if (supported) {
    const messaging = getMessaging(app);
    console.log(
      "[SW] FCM ready - background notifications handled automatically by FCM",
    );
  } else {
    console.log("[SW] Push notification is not supported on this browser");
  }
});

// Push イベントのデバッグログ
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event);
  if (event.data) {
    console.log("[SW] Push data:", event.data.text());
  }
});

// Notification click イベント
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);
  event.notification.close();
});
