import { ref, computed, watch, onScopeDispose } from "vue";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuthStore } from "@/stores/useAuthStore";
import { identifier } from "@/composables/domain/shared/valueContract.js";
import { isEmployeeNormalUxActorAllowed } from "@/utils/auth/policies/employeeActorPolicy.js";

export function useEmployeeReadAccess() {
  const auth = useAuthStore(), { $firestore } = useNuxtApp();
  const scope = ref(null), loading = ref(false), error = ref("");
  let generation = 0, stop, disposed = false;
  function clear() { generation++; stop?.(); stop = null; scope.value = null; loading.value = false; error.value = ""; }
  function reload() {
    clear();
    if (disposed || !identifier(auth.uid) || !identifier(auth.companyId) || auth.isEmailVerified !== true || auth.isSuperUserClaimValid !== true || typeof auth.isSuperUser !== "boolean") return;
    const context = { uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser };
    if (!isEmployeeNormalUxActorAllowed({ ...context, actorUser: auth.user })) return;
    const source = generation; loading.value = true;
    const fail = () => {
      if (source !== generation) return;
      clear();
      error.value = "従業員情報を取得できません。再読込してください。";
    };
    try {
      const unsubscribe = onSnapshot(doc($firestore, `Companies/${context.companyId}/Users/${context.uid}`), { includeMetadataChanges: true }, (snapshot) => {
        if (source !== generation || snapshot.metadata.fromCache) return;
        const raw = snapshot.exists() ? snapshot.data() : null;
        scope.value = isEmployeeNormalUxActorAllowed({ ...context, actorUser: raw })
          ? JSON.stringify([context.companyId, context.uid]) : null;
        loading.value = false;
      }, fail);
      if (source === generation) stop = unsubscribe;
      else unsubscribe?.();
    } catch { fail(); }
  }
  watch(() => JSON.stringify([auth.uid, auth.companyId, auth.isEmailVerified, auth.isSuperUserClaimValid, auth.isSuperUser,
    auth.user?.docId, auth.user?.companyId, auth.user?.isAdmin, auth.user?.disabled, auth.user?.isTemporary, auth.user?.roles]), reload, { immediate: true, flush: "sync" });
  onScopeDispose(() => { disposed = true; clear(); });
  return { scope, loading, error, reload, canRead: computed(() => scope.value !== null), companyId: computed(() => auth.companyId) };
}
