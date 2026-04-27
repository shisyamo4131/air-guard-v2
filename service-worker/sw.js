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

// Workbox のログを無効化
self.__WB_DISABLE_DEV_LOGS = true;

// プリキャッシュの設定（Vite PWA が自動注入）
precacheAndRoute(self.__WB_MANIFEST);

// 古いキャッシュをクリーンアップ
cleanupOutdatedCaches();

// SPA のルーティング設定
const handler = createHandlerBoundToURL("/");
const navigationRoute = new NavigationRoute(handler);
registerRoute(navigationRoute);

console.log("[SW] Workbox initialized");

// Firebase Messaging を importScripts で読み込む
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js",
);

// Firebase の設定
const firebaseConfig = {
  apiKey: "AIzaSyBPh8VjvMJZe__AmnNRsLHOwDh2oLUIrYQ",
  authDomain: "air-guard-v2-dev.firebaseapp.com",
  projectId: "air-guard-v2-dev",
  storageBucket: "air-guard-v2-dev.firebasestorage.app",
  messagingSenderId: "743839913303",
  appId: "1:743839913303:web:2e0730d9f7c833056ff73c",
};

// Firebase 初期化
firebase.initializeApp(firebaseConfig);

console.log("[SW] Firebase initialized");

// FCM の初期化（バックグラウンド通知は FCM が自動表示）
const isSupported = firebase.messaging.isSupported();

if (isSupported) {
  const messaging = firebase.messaging();
  console.log(
    "[SW] FCM ready - background notifications handled automatically by FCM",
  );
} else {
  console.log("[SW] Push notification is not supported on this browser");
}
