import { doc, getDoc } from "firebase/firestore";
import { computed, onScopeDispose, watch } from "vue";
import { Site } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSiteDetailAccessGuard } from "./useSiteDetailAccessGuard";
import { createSiteDetailReadSession } from "@/composables/domain/site/siteDetailAccessSession";

// Operation editors need a fresh, company-bound Site rather than a provider's
// display cache. Invalidate pending reads synchronously, including A -> B -> A.
export function useSiteOperationRead(getInputs) {
  const { $firestore } = useNuxtApp();
  const auth = useAuthStore();
  const { canRead } = useSiteDetailAccessGuard();
  const identity = computed(() => [auth.companyId, auth.uid, canRead.value]);
  const session = createSiteDetailReadSession({ clearProtectedReads: () => {} });

  watch(() => [...identity.value, ...getInputs()], session.revoke, { flush: "sync" });
  onScopeDispose(session.dispose);

  function begin(siteId) {
    if (!canRead.value || !auth.companyId || !auth.uid || !siteId) return null;
    const companyId = auth.companyId;
    const uid = auth.uid;
    const inputs = getInputs();
    const request = session.begin(siteId);
    return {
      companyId,
      siteId,
      isCurrent: () => request.isCurrent()
        && canRead.value
        && companyId === auth.companyId
        && uid === auth.uid
        && inputs.every((value, index) => Object.is(value, getInputs()[index])),
    };
  }

  async function read(request) {
    if (!request?.isCurrent()) return null;
    const reference = doc(
      $firestore, "Companies", request.companyId, "Sites", request.siteId,
    ).withConverter(Site.converter());
    const snapshot = await getDoc(reference);
    if (!request.isCurrent() || !snapshot.exists()) return null;
    const site = snapshot.data();
    return site?.docId === request.siteId ? site : null;
  }

  return { begin, identity, read };
}
