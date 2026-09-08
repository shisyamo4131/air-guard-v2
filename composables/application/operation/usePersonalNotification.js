import { computed, shallowRef, ref, watch, onScopeDispose } from "vue";
import { doc, getDocFromServer } from "firebase/firestore";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { rawForClass } from "@/composables/domain/shared/valueContract";
import { useNotificationEditor } from "./useNotificationEditor";

export function usePersonalNotification(definition) {
  const auth = useAuthStore(), { $firestore } = useNuxtApp();
  const editor = useNotificationEditor(), schedule = shallowRef(null), preparing = ref(false);
  let generation = 0;
  const invalidate = () => { generation++; schedule.value = null; preparing.value = false; };
  watch(editor.baseline, invalidate, { flush: "sync" });
  const next = computed(() => definition.value?.[editor.baseline.value?.status]?.next || null);
  const disabled = computed(() => preparing.value || !schedule.value || editor.disabled.value);
  async function open(item) {
    if (editor.busy.value) return false;
    invalidate();
    if (!await editor.open(item)) return false;
    const ticket = generation, baseline = editor.baseline.value;
    preparing.value = true;
    try {
      const snapshot = await getDocFromServer(doc($firestore, `Companies/${auth.companyId}/SiteOperationSchedules/${baseline.siteOperationScheduleId}`));
      if (ticket !== generation || baseline !== editor.baseline.value) return false;
      if (!snapshot.exists()) throw new Error();
      schedule.value = new SiteOperationSchedule(rawForClass(snapshot.data()));
      return true;
    } catch {
      if (ticket === generation) { editor.reset(); editor.message.value = "現場稼働予定を取得できません。通知を開き直してください。"; }
      return false;
    } finally { if (ticket === generation) preparing.value = false; }
  }
  async function saveNext() {
    if (disabled.value || !next.value) return false;
    editor.update({ status: next.value.status });
    return editor.save();
  }
  async function reload() {
    if (editor.uncertain.value) return editor.reload();
    const id = editor.baseline.value?.docId;
    if (id) return open(id);
  }
  const close = () => { if (!editor.busy.value) { invalidate(); editor.close(); } };
  onScopeDispose(invalidate);
  return { editor, schedule, preparing, next, disabled, open, saveNext, reload, close };
}
