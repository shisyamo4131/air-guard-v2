import { ref, computed, watch, onScopeDispose } from "vue";
import { httpsCallable } from "firebase/functions";
import { useAuthStore } from "@/stores/useAuthStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { archiveActorAllowed, archiveIdentifier, parseEmployeeArchiveInput } from "@/functions/shared/employeeArchiveContract.js";

export function useEmployeeArchive(employeeId, employee, onArchived) {
  const auth = useAuthStore(), messages = useMessagesStore(), { $functions } = useNuxtApp();
  const visible = ref(false), busy = ref(false), uncertain = ref(false), reason = ref(""), message = ref("");
  let generation = 0, attempt = null;
  const scope = computed(() => auth.isEmailVerified === true && auth.isSuperUserClaimValid === true && archiveIdentifier(employeeId.value)
    && archiveActorAllowed({ uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser }, auth.user)
    ? JSON.stringify([auth.companyId, auth.uid, employeeId.value, auth.isSuperUser, auth.user.isAdmin, auth.user.roles]) : null);
  function reset() { generation++; visible.value = false; busy.value = false; uncertain.value = false; reason.value = ""; message.value = ""; attempt = null; }
  watch(scope, reset, { flush: "sync" }); onScopeDispose(reset);
  const canStart = computed(() => !!scope.value && employee.value?.docId === employeeId.value && !uncertain.value);
  const canConfirm = computed(() => !!scope.value && uncertain.value);
  function open() {
    if (busy.value || (!canStart.value && !canConfirm.value)) return false;
    if (!attempt) attempt = { employeeId: employeeId.value, operationId: globalThis.crypto.randomUUID(), reason: "" };
    visible.value = true; return true;
  }
  function close() { if (busy.value) return false; visible.value = false; if (uncertain.value) message.value = "処理結果を確認できていません。「結果を確認」から同じ操作を確認してください。"; else { generation++; attempt = null; reason.value = ""; message.value = ""; } return true; }
  function setReason(value) { if (!busy.value && !uncertain.value) reason.value = value; }
  async function submit() {
    if (busy.value || !scope.value || !attempt || (!uncertain.value && !canStart.value)) return false;
    const owner = scope.value, ticket = generation;
    const current = () => owner === scope.value && ticket === generation;
    let input;
    try { input = parseEmployeeArchiveInput(uncertain.value ? attempt : { ...attempt, reason: reason.value }); }
    catch { message.value = "理由を1〜200文字で入力してください。"; return false; }
    attempt = input; reason.value = input.reason; busy.value = true; message.value = "";
    try {
      const response = await httpsCallable($functions, "archiveEmployee")(input);
      if (!current()) return false;
      if (response.data?.success !== true || response.data?.archived !== true) throw new Error("unknown result");
      reset(); messages.add("従業員をアーカイブしました。"); onArchived(input.employeeId); return true;
    } catch (error) {
      if (!current()) return false;
      const definite = ["functions/unauthenticated", "functions/permission-denied", "functions/invalid-argument", "functions/not-found", "functions/already-exists", "functions/failed-precondition"].includes(error.code);
      // A failed confirmation cannot establish the result of an older uncertain
      // attempt. Preserve that immutable request until a matching success.
      uncertain.value = uncertain.value || !definite;
      message.value = uncertain.value ? "アーカイブ結果が不明です。同じ操作を確認してください。" : ({ "functions/permission-denied": "権限または会社の利用条件を確認してください。", "functions/not-found": "従業員情報が見つかりません。", "functions/already-exists": "同じIDのアーカイブと競合しています。" }[error.code] || "参照や従業員情報の条件によりアーカイブできません。理由を保持しています。");
      return false;
    } finally { if (current()) busy.value = false; }
  }
  return { visible, busy, uncertain, reason, message, canStart, canConfirm, open, close, setReason, submit };
}
