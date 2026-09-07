import { ref, shallowRef, computed, watch, onScopeDispose } from "vue";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOperationSubmission } from "./useOperationSubmission";
import { rawForClass } from "@/functions/shared/employeeContract.js";
import { expectedForOperation, notificationExpectation } from "@/functions/shared/operationWriteContract.js";
import { operationEmployeeReferences, notificationEmployeeReferences } from "@/functions/shared/operationReferences.js";

export function useOperationGenerator(selectedSchedule) {
  const auth = useAuthStore(), { $firestore } = useNuxtApp();
  const submission = useOperationSubmission();
  const notifications = ref([]), raw = shallowRef(null), notificationRaw = shallowRef(null), preparing = ref(false), error = ref("");
  let generation = 0, unsubscribe = null;
  function clear() { generation++; unsubscribe?.(); unsubscribe = null; raw.value = null; notificationRaw.value = null; notifications.value = []; preparing.value = false; }
  async function prepare() {
    clear(); error.value = "";
    const id = selectedSchedule.value?.docId, ticket = generation;
    if (!submission.allowed.value) { selectedSchedule.value = null; return; }
    if (!id || submission.uncertain.value) return;
    preparing.value = true;
    try {
      let source = await submission.read("SiteOperationSchedules", id);
      if (ticket !== generation) return;
      operationEmployeeReferences(source, { scheduleId: id });
      if ([...source.employees, ...source.outsourcers].some((worker) => !worker.hasNotification)) {
        const command = { kind: "schedule", documentId: id, action: "notify", changes: { shouldNotify: false } };
        command.expected = expectedForOperation(source, command);
        if (!await submission.submit([command])) throw new Error();
        source = await submission.read("SiteOperationSchedules", id);
        if (ticket !== generation) return;
        operationEmployeeReferences(source, { scheduleId: id });
      }
      raw.value = source; selectedSchedule.value = new SiteOperationSchedule(rawForClass(source));
      const ids = new Set([...source.employees, ...source.outsourcers].map((worker) => `${id}_${worker.workerId}`));
      unsubscribe = onSnapshot(query(collection($firestore, `Companies/${auth.companyId}/ArrangementNotifications`), where("siteOperationScheduleId", "==", id)), { includeMetadataChanges: true }, (snapshot) => {
        if (ticket !== generation || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        try {
          const current = {};
          for (const item of snapshot.docs) {
            const value = item.data(); notificationEmployeeReferences(value);
            if (item.id !== value.docId || value.siteOperationScheduleId !== id) throw new Error();
            if (ids.has(item.id)) current[item.id] = value;
          }
          notificationRaw.value = Object.fromEntries([...ids].map((key) => [key, current[key] || null]));
          notifications.value = Object.values(current).map((value) => new ArrangementNotification(rawForClass(value)));
          preparing.value = false;
        } catch { notificationRaw.value = null; notifications.value = []; error.value = "通知の状態を確認できません。再読込してください。"; preparing.value = false; }
      }, () => { if (ticket === generation) { notificationRaw.value = null; notifications.value = []; error.value = "通知を取得できません。"; preparing.value = false; } });
    } catch { if (ticket === generation) { error.value = submission.message.value || "上下番確定の準備ができません。再読込してください。"; preparing.value = false; } }
  }
  const ready = computed(() => !!raw.value && notificationRaw.value !== null && !preparing.value && !submission.busy.value && !submission.uncertain.value && submission.allowed.value);
  async function convert() {
    if (!ready.value) return false;
    const ticket = generation, command = { kind: "schedule", action: "convert", documentId: raw.value.docId, changes: {}, notifications: Object.fromEntries(Object.entries(notificationRaw.value).map(([id, value]) => [id, notificationExpectation(value)])) };
    command.expected = expectedForOperation(raw.value, command);
    const result = await submission.submit([command]);
    if (ticket !== generation) return false;
    if (result) { selectedSchedule.value = null; clear(); return true; }
    notificationRaw.value = null; error.value = submission.message.value; return false;
  }
  watch([() => selectedSchedule.value?.docId, () => auth.uid, () => auth.companyId, () => submission.allowed.value], prepare, { immediate: true });
  watch([() => auth.uid, () => auth.companyId], () => { selectedSchedule.value = null; clear(); });
  onScopeDispose(clear);
  return { notifications, ready, preparing, error, busy: submission.busy, uncertain: submission.uncertain, prepare, convert };
}
