import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import { createCodexPostalIsolationPlugin } from "./scripts/vite-codex-postal-isolation.mjs";

const isCodexDedicatedUi =
  process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID ===
  "demo-air-guard-v2-codex";

function createFirebaseConfigSwPlugin() {
  return {
    name: "inject-firebase-config-to-sw",
    transform(code, id) {
      const sourcePath = id.replace(/\\/g, "/").split("?")[0];
      if (
        sourcePath !== "service-worker/sw.js" &&
        !sourcePath.endsWith("/service-worker/sw.js")
      ) {
        return code;
      }
      // Replace complete string literals once, preserving quotes and escapes.
      return code.replace(
        /"__FIREBASE_(API_KEY|AUTH_DOMAIN|PROJECT_ID|STORAGE_BUCKET|MESSAGING_SENDER_ID|APP_ID)__"/g,
        (_placeholder, key) =>
          JSON.stringify(process.env[`NUXT_PUBLIC_FIREBASE_${key}`] || ""),
      );
    },
  };
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },

  /** firebase hosting を使用するので CSR モードに設定 */
  ssr: false,

  /** Vue アプリの起動が完了するまで SPA ローディング画面を表示 */
  spaLoadingTemplate: true,

  /** TypeScript を使用しない */
  typescript: {
    strict: false,
    shim: false,
  },

  build: {
    transpile: ["vuetify"], // vuetify 設定
  },

  css: ["@/assets/css/utilities.css"],

  modules: [
    // vuetify 設定
    (_options, nuxt) => {
      nuxt.hooks.hook("vite:extendConfig", (config, { isClient }) => {
        // @ts-expect-error
        config.plugins.push(vuetify({ autoImport: true }));
        if (isCodexDedicatedUi && isClient) {
          config.plugins.push(createCodexPostalIsolationPlugin({
            projectRoot: nuxt.options.rootDir,
          }));
        }
      });
    },
    // pinia
    "@pinia/nuxt",
    // Codex専用UIではService Workerと外部通知経路をbuild時から無効化
    ...(!isCodexDedicatedUi ? ["@vite-pwa/nuxt"] : []),
  ],

  // PWA 設定（FCM とインストール機能のみ）
  pwa: {
    strategies: "injectManifest",
    srcDir: "service-worker",
    filename: "sw.js",
    // registerType を削除（手動制御）
    manifest: {
      name: "AirGuard",
      short_name: "AirGuard",
      description: "警備業務管理アプリケーション",
      theme_color: "#1976D2",
      background_color: "#ffffff",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    injectManifest: {
      // プリキャッシュを無効化（Workbox不使用）
      globPatterns: [],
      globIgnores: [],
      // SWはapplicationと独立buildのため、専用plugin instanceを渡す。
      buildPlugins: {
        vite: [createFirebaseConfigSwPlugin()],
      },
      rollupOptions: {
        output: {
          format: "es",
        },
      },
    },
    devOptions: {
      enabled: true,
      type: "module",
    },
  },

  vite: {
    vue: {
      template: {
        transformAssetUrls, // vuetify 設定
      },
    },
    // 環境変数を VITE_ プレフィックスで Service Worker でも使用可能にする
    envPrefix: ["NUXT_", "VITE_"],
    // 開発時の依存関係最適化（本番ビルドには影響しない）
    optimizeDeps: {
      include: [
        "@shisyamo4131/air-guard-v2-schemas/constants",
        "@shisyamo4131/air-firebase-v2/utils/tokenMap",
        "vuedraggable",
        "pdfmake/build/pdfmake",
        "@holiday-jp/holiday_jp",
        "firebase/messaging/sw",
        "browser-image-compression",
        "vue-chartjs",
      ],
    },
    // dev serverで読むSWにも注入する（build用とはinstanceを共有しない）。
    plugins: [createFirebaseConfigSwPlugin()],
  },

  runtimeConfig: {
    public: {
      firebaseUseEmulator: process.env.NUXT_PUBLIC_FIREBASE_USE_EMULATOR,
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseDatabaseURL: process.env.NUXT_PUBLIC_FIREBASE_DATABASE_URL,
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId:
        process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
      firebaseRegion: process.env.NUXT_PUBLIC_FIREBASE_REGION,
      firebaseVapidKey: process.env.NUXT_PUBLIC_FIREBASE_VAPID_KEY,
      firebaseEmulatorHost: process.env.NUXT_PUBLIC_FIREBASE_EMULATOR_HOST,
      firebaseAuthEmulatorPort:
        process.env.NUXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT,
      firebaseFirestoreEmulatorPort:
        process.env.NUXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT,
      firebaseDatabaseEmulatorPort:
        process.env.NUXT_PUBLIC_FIREBASE_DATABASE_EMULATOR_PORT,
      firebaseStorageEmulatorPort:
        process.env.NUXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT,
      firebaseFunctionsEmulatorPort:
        process.env.NUXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT,
    },
  },

  app: {
    /** トランジション設定 */
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
  },
});
