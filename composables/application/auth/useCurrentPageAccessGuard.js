import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  buildPageAccessContext,
  createCurrentPageAccessGuardRunner,
  getPageAccessContextKey,
} from "@/utils/auth/pageAccessContext";
import { isPageAllowed } from "@/utils/pageSettings";

/**
 * 表示中に利用者の状態・claim・roleが変わった場合も現在pageを再認可します。
 */
export function useCurrentPageAccessGuard() {
  const auth = useAuthStore();
  const route = useRoute();
  const router = useRouter();
  const runner = createCurrentPageAccessGuardRunner({
    isAllowed(path, accessContext) {
      return isPageAllowed(
        path,
        accessContext.userRoles,
        accessContext,
      );
    },
    replace(path) {
      return router.replace(path);
    },
    reportError(error) {
      console.error("[current-page-access] Redirect failed.", error);
    },
  });

  watch(
    () => [route.path, getPageAccessContextKey(auth)],
    async () => {
      const targetPath = route.path;
      const accessContext = buildPageAccessContext(auth);
      try {
        await runner.evaluate({
          isReady: auth.isReady,
          path: targetPath,
          accessContext,
          isCurrent: (path) => route.path === path,
          getIsReady: () => auth.isReady,
          getAccessContext: () => buildPageAccessContext(auth),
        });
      } catch (error) {
        console.error("[current-page-access] Guard evaluation failed.", error);
      }
    },
    { immediate: true, flush: "post" },
  );
}
