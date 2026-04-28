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
import { getMessaging } from "firebase/messaging/sw";

// Workbox のログを無効化
self.__WB_DISABLE_DEV_LOGS = true;

// プリキャッシュの設定（Vite PWA が自動注入）
precacheAndRoute(self.__WB_MANIFEST);

// 古いキャッシュをクリーンアップ
cleanupOutdatedCaches();

// SPA のルーティング設定
try {
  const handler = createHandlerBoundToURL("/");
  const navigationRoute = new NavigationRoute(handler);
  registerRoute(navigationRoute);
  console.log("[SW] SPA routing configured");
} catch (e) {
  console.warn("[SW] SPA routing setup failed:", e.message);
}

console.log("[SW] Workbox initialized");

/**
 * Firebase の設定
 *
 * プレースホルダーはビルド時に Vite プラグインで環境変数に置換されます
 */
const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
};

console.log("[SW] Firebase config loaded for:", firebaseConfig.projectId);

// Firebase 初期化
const app = initializeApp(firebaseConfig);
console.log("[SW] Firebase initialized");

// FCM の初期化（バックグラウンド通知は FCM が自動表示）
// Service Worker では常にサポートされているので isSupported() チェック不要
const messaging = getMessaging(app);
console.log(
  "[SW] FCM ready - background notifications handled automatically by FCM",
);

// カスタム Push イベントハンドラー（デバッグ用、FCM が自動処理するので通常は不要）
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event);
});

// Notification click イベント
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);
  event.notification.close();
});
