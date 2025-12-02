import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { System } from "@/schemas";

/**
 * Monitor the "System" document in Firestore to handle maintenance mode.
 * - There is a possibility that `System/system` document does not exist in Firestore.
 *   - `System/system` document is created at Admin SDK.
 * - This plugin tries to fetch `System/system` document before subscribing it because
 *   it initializes `isMaintenance` state synchronously.
 * - Redirects users to the maintenance page when maintenance mode is enabled.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const router = useRouter();
  const auth = useAuthStore();

  const systemInstance = new System();

  // fetch `System/system` document and initialize `isMaintenance` state
  try {
    const docExists = await systemInstance.fetch({ docId: "system" });
    auth.isMaintenance = docExists
      ? systemInstance.isMaintenance ?? false
      : false;
  } catch (error) {
    console.error("Failed to fetch System document:", error);
    auth.isMaintenance = false;
  }

  systemInstance.subscribe({ docId: "system" }, (data) => {
    auth.isMaintenance = data?.isMaintenance ?? false;
    if (data?.isMaintenance) {
      if (router.currentRoute.value.path !== "/maintenance") {
        router.replace("/maintenance");
      }
    } else {
      // メンテナンスが解除されたらトップページへリダイレクト
      if (router.currentRoute.value.path === "/maintenance") {
        router.replace("/");
      }
    }
  });
});
