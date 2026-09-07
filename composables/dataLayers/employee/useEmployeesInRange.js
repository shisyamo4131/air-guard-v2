import { computed, ref, watch, onScopeDispose } from "vue";
import { collection, query, where, onSnapshot, getDocsFromServer } from "firebase/firestore";
import { useFetch } from "@/composables/fetch/useFetch";
import { rangeIsRef, rangeIsValid } from "@/composables/validators/rangeValidator";

export function useEmployeesInRange({ from, to, snapshot = false } = {}) {
  rangeIsRef({ from, to });
  const { $firestore } = useNuxtApp(), { fetchEmployeeComposable: reader } = useFetch("useEmployeesInRange");
  const ids = ref([]), loading = ref(false);
  let generation = 0, stops = [];
  function clear() { generation++; stops.forEach((stop) => stop()); stops = []; ids.value = []; loading.value = false; }
  watch(() => [from.value, to.value, reader.scope.value, reader.generation.value, reader.canRead.value], async () => {
    clear(); if (!reader.canRead.value) return;
    const source = generation, cacheScope = reader.captureScope();
    const current = () => generation === source && reader.isCurrent(cacheScope);
    try {
      rangeIsValid({ from: from.value, to: to.value });
      const companyId = JSON.parse(reader.scope.value)[0], employees = collection($firestore, `Companies/${companyId}/Employees`);
      const queries = [query(employees, where("employmentStatus", "==", "ACTIVE"), where("dateOfHire", "<=", to.value)),
        query(employees, where("employmentStatus", "==", "RESIGNED"), where("dateOfHire", "<=", to.value), where("dateOfTermination", ">=", from.value))];
      loading.value = true; const parts = [null, null], checkpoints = queries.map(() => reader.captureScope());
      const accept = (index, result) => {
        if (!current()) return;
        const removed = (parts[index] || []).filter((record) => !result.docs.some((entry) => entry.id === record.id));
        parts[index] = result.docs;
        // A query removal can be a period edit. Read the original ID to distinguish it from deletion.
        if (removed.length) void reader.fetchEmployee(removed.map((record) => record.id));
        // Only ingest this response. Replaying the other query's old snapshot
        // could replace a newer document when ACTIVE/RESIGNED membership moves.
        for (const record of result.docs) if (!reader.acceptQueryRaw(record.id, record.data(), checkpoints[index])) return;
        checkpoints[index] = reader.captureScope();
        if (!parts.every((part) => part !== null)) return;
        const records = parts.flat();
        ids.value = [...new Set(records.map((record) => record.id))]; loading.value = false;
      };
      if (snapshot) await Promise.all(queries.map(async (reference, index) => { const result = await getDocsFromServer(reference); if (current()) accept(index, result); }));
      else stops = queries.map((reference, index) => onSnapshot(reference, { includeMetadataChanges: true }, (result) => { if (!result.metadata.fromCache) accept(index, result); }, () => { if (current()) { clear(); reader.failRead(); } }));
    } catch { if (current()) { clear(); reader.failRead(); } }
  }, { immediate: true, flush: "sync" });
  onScopeDispose(clear);
  const docs = computed(() => ids.value.map((id) => reader.cachedEmployees.value[id]).filter(Boolean));
  return { docs, loading };
}
