import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Monitor the "System" document in Firestore to handle maintenance mode.
 * - There is a possibility that `System/system` document does not exist in Firestore.
 *   - `System/system` document is created at Admin SDK.
 * - This plugin tries to fetch `System/system` document before subscribing it because
 *   it initializes `isMaintenance` state synchronously.
 * - Redirects users to the maintenance page when maintenance mode is enabled.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const { initSystemStates } = useAuthStore();
  await initSystemStates();
});
