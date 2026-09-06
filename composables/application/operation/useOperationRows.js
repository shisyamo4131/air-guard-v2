import { computed, shallowRef, ref, watch, onScopeDispose } from "vue";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuthStore } from "@/stores/useAuthStore";

export function useOperationRows(props, editor, onRaw = () => {}) {
  const auth = useAuthStore(), { $firestore } = useNuxtApp();
  const raw = shallowRef(null), readError = ref("");
  let unsubscribe = null, generation = 0;
  const scope = computed(() => auth.uid && auth.companyId && auth.isSuperUserClaimValid === true && auth.user?.docId === auth.uid && auth.user?.companyId === auth.companyId && auth.user?.disabled === false && auth.user?.isTemporary === false ? `${auth.companyId}/${auth.uid}` : null);
  function clear() { generation++; unsubscribe?.(); unsubscribe = null; raw.value = null; editor.reset(); }
  watch(() => [scope.value, props.documentId], ([owner, id]) => {
    clear(); readError.value = "";
    if (!owner || !id) return;
    const ticket = generation;
    unsubscribe = onSnapshot(doc($firestore, `Companies/${auth.companyId}/OperationResults/${id}`), (snapshot) => {
      if (ticket !== generation || owner !== scope.value || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists()) { clear(); readError.value = "稼働情報が見つかりません。"; return; }
      raw.value = snapshot.data(); onRaw(raw.value);
    }, () => { if (ticket === generation) { clear(); readError.value = "稼働情報を取得できません。"; } });
  }, { immediate: true });
  onScopeDispose(clear);
  return { raw, readError };
}
