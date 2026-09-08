import { ref, shallowRef, computed, watch, onScopeDispose } from "vue";
import { collection, doc } from "firebase/firestore";
import { SiteOperationSchedule, OperationResult } from "@/schemas";
import { rawForClass, dateInput } from "@/composables/domain/shared/valueContract";
import { expectedForOperation } from "@/composables/domain/operation/operationCommandContract";
import { useOperationSubmission } from "./useOperationSubmission";

export function useOperationDuplicator(kind, onSaved = () => {}) {
  const submission = useOperationSubmission(), { $firestore } = useNuxtApp();
  const opened = ref(false), loading = ref(false), source = shallowRef(null), selectedDates = ref([]), error = ref("");
  const saving = ref(false), busy = computed(() => saving.value || submission.busy.value);
  const collectionName = kind === "schedule" ? "SiteOperationSchedules" : "OperationResults", Schema = kind === "schedule" ? SiteOperationSchedule : OperationResult;
  let generation = 0; const ids = new Map();
  function clear() { generation++; source.value = null; selectedDates.value = []; opened.value = false; loading.value = false; saving.value = false; ids.clear(); }
  async function set(item) {
    if (busy.value || submission.uncertain.value || !submission.allowed.value) return false;
    clear(); const ticket = generation; opened.value = true; loading.value = true; error.value = "";
    try {
      const raw = await submission.read(collectionName, item?.docId || item);
      if (ticket !== generation) return false;
      if (!raw || (kind === "result" && raw.isLocked !== false)) throw new Error();
      source.value = raw; return true;
    } catch { if (ticket === generation) error.value = "複製元を確認できません。最新情報とロック状態を確認してください。"; return false; }
    finally { if (ticket === generation) loading.value = false; }
  }
  const dates = computed(() => [...new Set(selectedDates.value.map(dateInput))].filter((date) => kind !== "schedule" || date !== source.value?.date));
  const disabled = computed(() => !source.value || loading.value || busy.value || submission.uncertain.value || !submission.allowed.value || !dates.value.length || dates.value.length > (kind === "schedule" ? 20 : 1));
  async function save() {
    if (disabled.value) return false;
    const ticket = generation;
    saving.value = true;
    try {
    const operations = dates.value.map((dateAt) => {
      if (!ids.has(dateAt)) ids.set(dateAt, doc(collection($firestore, collectionName)).id);
      const command = { kind, action: "duplicate", documentId: ids.get(dateAt), sourceId: source.value.docId, changes: { dateAt } };
      command.expected = expectedForOperation(source.value, command); return command;
    });
    const result = await submission.submit(operations);
    if (ticket !== generation) return false;
    if (!result) { error.value = submission.message.value; return false; }
    try {
      const saved = await Promise.all(operations.map(async ({ documentId }) => { const raw = await submission.read(collectionName, documentId); return raw ? new Schema(rawForClass(raw)) : null; }));
      if (ticket !== generation) return false;
      clear(); await onSaved(saved.filter(Boolean)); return true;
    } catch {
      if (ticket !== generation) return false;
      clear(); opened.value = true;
      error.value = "複製の保存は完了しましたが、最新情報を取得できませんでした。再送せず、原本を確認してください。";
      return true;
    }
    } finally { if (ticket === generation || !opened.value) saving.value = false; }
  }
  watch(() => [submission.scope(), submission.allowed.value], clear);
  onScopeDispose(clear);
  return { opened, loading, source, selectedDates, error, disabled, busy, uncertain: submission.uncertain, set, save, close: () => { if (!busy.value) clear(); } };
}
