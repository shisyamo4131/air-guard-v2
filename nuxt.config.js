import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },

  /** firebase hosting を使用するので CSR モードに設定 */
  ssr: false,

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
      nuxt.hooks.hook("vite:extendConfig", (config) => {
        // @ts-expect-error
        config.plugins.push(vuetify({ autoImport: true }));
      });
    },
    // pinia
    "@pinia/nuxt",
  ],

  vite: {
    vue: {
      template: {
        transformAssetUrls, // vuetify 設定
      },
    },
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
    },
  },

  app: {
    /** トランジション設定 */
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
  },
});
