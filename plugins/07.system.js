import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useRouter } from "vue-router";
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
  const { $firestore } = nuxtApp;
  const systemDocRef = doc($firestore, "System/system");
  const router = useRouter();
  const authStore = useAuthStore();

  // fetch `System/system` document
  try {
    const docSnapshot = await getDoc(systemDocRef);
    authStore.isMaintenance = docSnapshot.exists()
      ? docSnapshot.data()?.isMaintenance ?? false
      : false;
  } catch (error) {
    console.error("Failed to fetch System document:", error);
    authStore.isMaintenance = false;
  }

  // subscribe `System/system` document
  onSnapshot(systemDocRef, async (snapshot) => {
    const data = snapshot.data();
    authStore.isMaintenance = data?.isMaintenance ?? false;
    if (data?.isMaintenance) {
      if (router.currentRoute.value.path !== "/maintenance") {
        router.replace("/maintenance");
      }
    } else {
      // メンテナンス解除時、自動でトップページなどに戻したい場合
      if (router.currentRoute.value.path === "/maintenance") {
        router.replace("/");
      }
    }
  });
});
