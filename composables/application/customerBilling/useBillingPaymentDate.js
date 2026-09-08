import { ref, shallowRef, computed, watch, onScopeDispose } from "vue";
import { doc, getDocFromServer } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useAuthStore } from "@/stores/useAuthStore";
import { dateInput } from "@/composables/domain/shared/valueContract.js";
import { billingIdentifier, isBillingPaymentUxActorAllowed, paymentExpected, paymentPatch, paymentMatches } from "@/composables/domain/customerBilling/billingPaymentContract.js";

export function useBillingPaymentDate(documentId) {
  const auth = useAuthStore(), { $firestore, $functions } = useNuxtApp();
  const visible = ref(false), busy = ref(false), uncertain = ref(false), conflict = ref(false), baseline = shallowRef(null), value = ref(null), message = ref("");
  let generation = 0, attempt = null;
  const scope = computed(() => auth.isSuperUserClaimValid === true && isBillingPaymentUxActorAllowed({ uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser }, auth.user ? { ...auth.user } : null) && billingIdentifier(documentId.value) ? `${auth.companyId}/${auth.uid}/${documentId.value}` : null);
  function reset() { generation++; visible.value = false; busy.value = false; uncertain.value = false; conflict.value = false; baseline.value = null; value.value = null; attempt = null; message.value = ""; }
  watch(scope, reset, { flush: "sync" }); onScopeDispose(reset);
  const current = (ticket, owner) => ticket === generation && owner !== null && scope.value === owner;
  async function read(id, company) { const snapshot = await getDocFromServer(doc($firestore, `Companies/${company}/Billings/${id}`)); if (!snapshot.exists()) throw new Error("missing"); const raw = snapshot.data(); if (raw.docId !== id) throw new Error("invalid"); return raw; }
  async function reload() {
    if (busy.value || !scope.value) return false;
    const ticket = generation, owner = scope.value, id = documentId.value, company = auth.companyId;
    busy.value = true;
    try {
      const raw = await read(id, company); if (!current(ticket, owner)) return false;
      if (uncertain.value && attempt) {
        if (!paymentMatches(raw, attempt.patch)) { message.value = "保存結果は不明です。現在値が入力と異なります。"; return false; }
        message.value = "現在値は入力した入金予定日と一致しています。";
      } else message.value = "";
      baseline.value = raw; value.value = dateInput(raw.paymentDueDateAt); uncertain.value = false; conflict.value = false; attempt = null; return true;
    } catch { if (current(ticket, owner)) { baseline.value = null; message.value = "請求情報を取得できません。再読込してください。"; } return false; }
    finally { if (current(ticket, owner)) busy.value = false; }
  }
  async function open() { if (busy.value || !scope.value) return false; visible.value = true; if (uncertain.value) return true; return reload(); }
  function close() { if (busy.value) return false; visible.value = false; if (!uncertain.value) { generation++; baseline.value = null; attempt = null; } return true; }
  function setValue(next) { if (busy.value || uncertain.value || conflict.value) return; value.value = next === "" ? null : next; }
  async function save() {
    if (busy.value || uncertain.value || conflict.value || !baseline.value || !scope.value) return false;
    const ticket = generation, owner = scope.value, id = documentId.value, company = auth.companyId;
    try { attempt = { patch: paymentPatch(baseline.value, value.value), input: { documentId: id, paymentDueDate: value.value, expected: paymentExpected(baseline.value) } }; }
    catch { message.value = "入金予定日は請求日以降の有効な日付を指定してください。"; return false; }
    busy.value = true; message.value = "";
    try {
      const result = await httpsCallable($functions, "updateBillingPaymentDate")(attempt.input);
      if (!current(ticket, owner)) return false;
      if (result.data?.success !== true) throw new Error("unknown result");
    } catch (error) {
      if (current(ticket, owner)) {
        const definite = ["functions/aborted", "functions/invalid-argument", "functions/permission-denied", "functions/unauthenticated", "functions/not-found", "functions/failed-precondition"].includes(error.code);
        conflict.value = definite; uncertain.value = !definite;
        message.value = definite ? "保存できませんでした。入力を保持しています。再読込してください。" : "保存結果が不明です。再送せず、再読込で現在値を確認してください。";
        busy.value = false;
      }
      return false;
    }
    // A confirmed commit stays successful even if its subsequent read fails.
    try { await read(id, company); if (!current(ticket, owner)) return false; message.value = "入金予定日を保存しました。"; }
    catch { if (!current(ticket, owner)) return false; message.value = "入金予定日は保存済みです。最新表示の取得に失敗しました。"; }
    if (!current(ticket, owner)) return false;
    busy.value = false; visible.value = false; baseline.value = null; attempt = null; generation++; return true;
  }
  return { visible, busy, uncertain, conflict, baseline, value, message, allowed: computed(() => !!scope.value), open, close, reload, setValue, save };
}
