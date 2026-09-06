import { ref, computed, watch, onScopeDispose } from "vue";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuthStore } from "@/stores/useAuthStore";
import { employeeAllowed, identifier } from "@/functions/shared/employeeContract.js";

export function useEmployeeReadAccess() {
  const auth = useAuthStore(), { $firestore } = useNuxtApp();
  const scope = ref(null), loading = ref(false);
  let generation = 0, stop;
  function clear() { generation++; stop?.(); stop = null; scope.value = null; loading.value = false; }
  watch(() => JSON.stringify([auth.uid, auth.companyId, auth.isEmailVerified, auth.isSuperUserClaimValid, auth.isSuperUser,
    auth.user?.docId, auth.user?.companyId, auth.user?.isAdmin, auth.user?.disabled, auth.user?.isTemporary, auth.user?.roles]), () => {
    clear();
    if (!identifier(auth.uid) || !identifier(auth.companyId) || auth.isEmailVerified !== true || auth.isSuperUserClaimValid !== true || typeof auth.isSuperUser !== "boolean") return;
    const context = { uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser };
    if (!employeeAllowed({ ...context, actorUser: auth.user }, false)) return;
    const source = generation; loading.value = true;
    stop = onSnapshot(doc($firestore, `Companies/${context.companyId}/Users/${context.uid}`), { includeMetadataChanges: true }, (snapshot) => {
      if (source !== generation || snapshot.metadata.fromCache) return;
      const raw = snapshot.exists() ? snapshot.data() : null;
      scope.value = employeeAllowed({ ...context, actorUser: raw }, false)
        ? JSON.stringify([context.companyId, context.uid, context.isSuperUser, raw.isAdmin, raw.roles]) : null;
      loading.value = false;
    }, () => { if (source === generation) { scope.value = null; loading.value = false; } });
  }, { immediate: true, flush: "sync" });
  onScopeDispose(clear);
  return { scope, loading, canRead: computed(() => scope.value !== null), companyId: computed(() => auth.companyId) };
}
