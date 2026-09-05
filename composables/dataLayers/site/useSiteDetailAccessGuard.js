import { doc, onSnapshot } from "firebase/firestore";
import { computed, onScopeDispose, readonly, ref, watch } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "@/composables/useLogger";
import { createSiteDetailAccessSession } from "@/composables/domain/site/siteDetailAccessSession";

export function useSiteDetailAccessGuard() {
  const { $firestore } = useNuxtApp();
  const auth = useAuthStore();
  const logger = useLogger("useSiteDetailAccessGuard");
  const canRead = ref(false);

  const context = computed(() => ({
    uid: auth.uid,
    companyId: auth.companyId,
    isEmailVerified: auth.isEmailVerified,
    user: {
      docId: auth.user?.docId,
      companyId: auth.user?.companyId,
      isTemporary: auth.user?.isTemporary,
      disabled: auth.user?.disabled,
    },
  }));

  const session = createSiteDetailAccessSession({
    listenToUser(identity, listener) {
      const reference = doc(
        $firestore,
        "Companies",
        identity.companyId,
        "Users",
        identity.uid,
      );
      return onSnapshot(
        reference,
        (snapshot) => {
          if (!snapshot.exists()) {
            listener.next(null);
            return;
          }
          listener.next({ ...snapshot.data(), docId: snapshot.id });
        },
        (error) => {
          logger.warn({
            message: "Current User access verification failed for Site detail.",
            error,
          });
          listener.error();
        },
      );
    },
    onAccessChanged: (allowed) => { canRead.value = allowed; },
  });

  watch(context, session.start, { deep: true, flush: "sync", immediate: true });
  onScopeDispose(session.dispose);

  return { canRead: readonly(canRead) };
}
