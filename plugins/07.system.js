import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Monitor the "System" document in Firestore to handle maintenance mode.
 * - System document will be created automatically if it does not exist.
 * - Redirect users to the maintenance page when maintenance mode is enabled.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { $firestore } = nuxtApp;
  const systemDocRef = doc($firestore, "System/system");
  const router = useRouter();
  const authStore = useAuthStore();

  let isRedirecting = false;

  onSnapshot(systemDocRef, async (snapshot) => {
    const data = snapshot.data();
    authStore.isMaintenance = data?.isMaintenance ?? false;
    if (data?.isMaintenance) {
      if (!isRedirecting && router.currentRoute.value.path !== "/maintenance") {
        isRedirecting = true;
        router.replace("/maintenance");
      }
    } else {
      // メンテナンス解除時、自動でトップページなどに戻したい場合
      if (router.currentRoute.value.path === "/maintenance") {
        router.replace("/");
      }
      isRedirecting = false;
    }
  });
});
