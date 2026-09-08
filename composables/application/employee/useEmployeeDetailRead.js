import { computed, ref, watch, onScopeDispose } from "vue";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { User } from "@/schemas";
import { rawForClass } from "@/composables/domain/shared/valueContract.js";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";

export function useEmployeeDetailRead(employeeId) {
  const reader = useFetchEmployee(), { $firestore } = useNuxtApp();
  const users = ref([]), userError = ref(""); let stop, generation = 0;
  const id = computed(employeeId), doc = computed(() => reader.canRead.value ? reader.cachedEmployees.value[id.value] || null : null);
  function clearUsers() { generation++; stop?.(); stop = null; users.value = []; userError.value = ""; }
  watch(() => [id.value, reader.scope.value], () => {
    clearUsers(); reader.clearCache();
    if (reader.canRead.value) void reader.fetchEmployee(id.value);
  }, { immediate: true, flush: "sync" });
  watch(() => [doc.value?.docId, reader.scope.value], () => {
    clearUsers(); if (!doc.value || !reader.canRead.value) return;
    const source = generation, companyId = JSON.parse(reader.scope.value)[0];
    stop = onSnapshot(query(collection($firestore, `Companies/${companyId}/Users`), where("employeeId", "==", id.value)), { includeMetadataChanges: true }, (snapshot) => {
      if (source !== generation || snapshot.metadata.fromCache) return;
      users.value = snapshot.docs.map((entry) => new User(rawForClass(entry.data())));
    }, () => { if (source === generation) { users.value = []; userError.value = "利用者情報を取得できません。再読込してください。"; } });
  }, { immediate: true, flush: "sync" });
  onScopeDispose(clearUsers);
  function excludeArchived(targetId) { if (targetId === id.value) { reader.acceptRaw(targetId, null, reader.captureScope()); clearUsers(); } }
  return { doc, users, userError, excludeArchived, canRead: reader.canRead, loading: reader.isLoading,
    error: reader.error, missing: computed(() => reader.getStatus(id.value) === "missing") };
}
