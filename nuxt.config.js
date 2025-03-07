// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  /** firebase hosting を使用するので CSR モードに設定 */
  ssr: false,

  /** TypeScript を使用しない */
  typescript: {
    strict: false,
    shim: false,
  },
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },

  /** vuetify */
  css: ["vuetify/styles"],
  build: {
    transpile: ["vuetify"],
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
    },
  },
});
