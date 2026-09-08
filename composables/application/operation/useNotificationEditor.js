import { computed, ref, shallowRef, watch, onScopeDispose } from "vue";
import { doc, getDocFromServer, runTransaction, serverTimestamp } from "firebase/firestore";
import { ArrangementNotification } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { rawForClass } from "@/composables/domain/shared/valueContract";
import { NOTIFICATION_VALUES } from "@/composables/domain/operation/operationCommandContract";
import { expectedNotificationState, prepareNotificationState } from "@/composables/domain/operation/notificationStateContract";

export function useNotificationEditor({ onSaved = () => {} } = {}) {
  const auth = useAuthStore(), { $firestore } = useNuxtApp();
  const opened = ref(false), busy = ref(false), loading = ref(false), conflict = ref(false), uncertain = ref(false), message = ref("");
  const draft = ref(null), baseline = shallowRef(null);
  let reference = null, generation = 0, owner = null;
  const scope = () => `${auth.companyId}/${auth.uid}`;
  const allowed = () => !!auth.uid && !!auth.companyId && auth.isSuperUserClaimValid === true && auth.user?.docId === auth.uid && auth.user?.companyId === auth.companyId && auth.user?.disabled === false && auth.user?.isTemporary === false;
  const canWrite = computed(allowed), disabled = computed(() => !canWrite.value || !draft.value || busy.value || loading.value || conflict.value || uncertain.value);
  function clear() { generation++; owner = null; opened.value = false; draft.value = null; baseline.value = null; reference = null; loading.value = false; conflict.value = false; uncertain.value = false; }
  function verify() { if (!allowed() || scope() !== owner) throw new Error("閲覧権限を確認できません。"); }
  async function open(item) {
    if (busy.value || !allowed()) return false;
    clear(); owner = scope(); const ticket = generation;
    reference = doc($firestore, `Companies/${auth.companyId}/ArrangementNotifications/${item?.docId || item}`);
    opened.value = true; loading.value = true; message.value = "";
    try {
      const snapshot = await getDocFromServer(reference);
      if (ticket !== generation) return false;
      verify(); if (!snapshot.exists()) throw new Error("通知がありません。");
      baseline.value = snapshot.data(); draft.value = new ArrangementNotification(rawForClass(baseline.value)); return true;
    } catch { if (ticket === generation) message.value = "通知を取得できません。最新情報を確認してください。"; return false; }
    finally { if (ticket === generation) loading.value = false; }
  }
  function request() { return { expected: expectedNotificationState(baseline.value), changes: { targetStatus: draft.value.status, ...Object.fromEntries(NOTIFICATION_VALUES.map((field) => [field, draft.value[field]])) } }; }
  async function save() {
    if (disabled.value) return false;
    const ticket = generation, input = request(), target = reference;
    const verifyAttempt = () => { if (ticket !== generation) throw Object.assign(new Error(), { code: "aborted" }); verify(); };
    busy.value = true;
    let committed = false;
    try {
      verifyAttempt();
      await runTransaction($firestore, async (transaction) => {
        verifyAttempt();
        const snapshot = await transaction.get(target);
        verifyAttempt();
        if (!snapshot.exists()) throw Object.assign(new Error(), { code: "not-found" });
        const patch = prepareNotificationState(snapshot.data(), input);
        verifyAttempt();
        if (Object.keys(patch).length) transaction.update(target, { ...patch, uid: auth.uid, updatedAt: serverTimestamp() });
      });
      verifyAttempt(); committed = true;
      const snapshot = await getDocFromServer(target);
      if (ticket !== generation) return false;
      verify(); clear(); await onSaved(snapshot.exists() ? new ArrangementNotification(rawForClass(snapshot.data())) : null); return true;
    } catch (error) {
      if (ticket !== generation) return false;
      if (committed) {
        if (!allowed() || scope() !== owner) return false;
        clear(); message.value = "保存は完了しましたが、最新情報を再取得できませんでした。再送せず、閲覧権限と原本を確認してください。";
        return true;
      }
      const code = String(error?.code || "");
      uncertain.value = !["aborted", "permission-denied", "invalid-argument", "failed-precondition", "not-found"].includes(code);
      conflict.value = !uncertain.value;
      message.value = uncertain.value ? "保存結果を確認できません。再送せず、原本を確認してください。" : "通知を保存できませんでした。入力を保持しています。最新値を読み直してください。";
      return false;
    } finally { if (ticket === generation || !opened.value) busy.value = false; }
  }
  async function reload() { if (busy.value || !reference) return; if (uncertain.value) { message.value = "先の処理結果は未確認です。入力を保持しています。別画面で原本を確認してください。"; return; } return open(reference.id); }
  const inputSchema = computed(() => ["status", ...NOTIFICATION_VALUES].map((field) => ({ key: field, ...ArrangementNotification.classProps[field] })));
  watch(() => [auth.uid, auth.companyId, canWrite.value], () => { if (owner && (!allowed() || scope() !== owner)) { clear(); busy.value = false; } });
  onScopeDispose(clear);
  return { opened, busy, loading, conflict, uncertain, message, draft, baseline, canWrite, disabled, inputSchema, open, save, reload, reset: () => { clear(); busy.value = false; message.value = ""; }, close: () => { if (!busy.value) clear(); }, update: (changes) => { if (!disabled.value) Object.assign(draft.value, changes); }, action: "notification" };
}
