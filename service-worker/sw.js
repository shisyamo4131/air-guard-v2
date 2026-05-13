/**
 * Service Worker for Push Notifications Only
 * Nuxt3 SPA + Firebase Hosting 構成
 *
 * このSWの役割:
 * - Firebase Cloud Messaging (プッシュ通知)
 * - PWA installability
 *
 * やらないこと:
 * - fetch event の intercept (Firebase Hosting rewrites に任せる)
 * - navigation request のキャッシュ (白画面の原因)
 * - 静的アセットのキャッシュ (HTTP cache で十分)
 */

import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";

/**
 * Firebase の設定
 * プレースホルダーはビルド時に環境変数に置換されます
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

// FCM の初期化
const messaging = getMessaging(app);
console.log("[SW] FCM ready - background notifications handled automatically");

// Push イベント
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event);
});

// Notification click イベント
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);
  event.notification.close();

  // アプリを開く
  event.waitUntil(clients.openWindow("/"));
});

// Install イベント（即座にアクティブ化）
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  self.skipWaiting();
});

// Activate イベント
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(clients.claim());
});

console.log("[SW] Service Worker initialized (Push Notifications Only)");
