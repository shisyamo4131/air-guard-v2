import { ref, computed, watch, onScopeDispose } from "vue";
import { doc, getDocFromServer } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useAuthStore } from "@/stores/useAuthStore";
import { operationUxAllowed } from "@/utils/auth/policies/operationActorPolicy";
import { confirmTerminatedScheduleSite } from "@/composables/application/siteOperationSchedule/confirmTerminatedSite";

export function useOperationSubmission({ billing = false, concurrent = false } = {}) {
  const auth = useAuthStore(), { $firestore, $functions } = useNuxtApp();
  const busy = ref(false), uncertain = ref(false), message = ref("");
  let generation = 0, active = 0;
  let confirmationSignature = null;
  const confirmations = new Set();
  const scope = () => `${auth.companyId}/${auth.uid}`;
  const allowed = computed(() => auth.isSuperUserClaimValid === true && operationUxAllowed({ uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser }, auth.user?.toObject?.() || auth.user, { billing }));
  function clearConfirmations() { confirmationSignature = null; confirmations.clear(); }
  function reset() { generation++; active = 0; busy.value = false; uncertain.value = false; message.value = ""; clearConfirmations(); }
  function verify(owner, ticket) { if (ticket !== generation || owner !== scope() || !allowed.value) throw new Error("操作の対象が変わりました。"); }
  async function read(collection, id) {
    const owner = scope(), ticket = generation;
    verify(owner, ticket);
    const snapshot = await getDocFromServer(doc($firestore, `Companies/${auth.companyId}/${collection}/${id}`));
    verify(owner, ticket);
    return snapshot.exists() ? snapshot.data() : null;
  }
  async function submit(operations) {
    if ((!concurrent && busy.value) || uncertain.value || !allowed.value) return false;
    if (!operations.length) return { success: true, updated: false, results: [] };
    const owner = scope(), ticket = generation; let sent = false;
    const signature = JSON.stringify(operations.map(({ siteStatuses, ...command }) => command));
    let requestConfirmations;
    if (concurrent) {
      requestConfirmations = new Set();
    } else {
      if (signature !== confirmationSignature) { clearConfirmations(); confirmationSignature = signature; }
      requestConfirmations = confirmations;
    }
    const clearRequestConfirmations = () => concurrent ? requestConfirmations.clear() : clearConfirmations();
    active++; busy.value = true; message.value = "";
    try {
      const siteStatuses = new Map();
      for (const command of operations) if (command.kind === "schedule" && ["create", "duplicate", "overview"].includes(command.action)
        && (command.action === "create" || ["siteId", "dateAt"].some((field) => Object.hasOwn(command.changes, field)))) {
        const current = command.action === "create" ? null : await read("SiteOperationSchedules", command.action === "duplicate" ? command.sourceId : command.documentId);
        const ids = [...new Set([current?.siteId, command.changes.siteId || current?.siteId].filter(Boolean))];
        command.siteStatuses = {};
        for (const id of ids) {
          if (!siteStatuses.has(id)) {
            const site = await read("Sites", id);
            if (site?.isTemporary !== false || !["ACTIVE", "TERMINATED"].includes(site.status)) throw new Error("現場の状態を確認してください。");
            siteStatuses.set(id, site.status);
          }
          if (siteStatuses.get(id) === "TERMINATED" && id === (command.changes.siteId || current?.siteId) && !requestConfirmations.has(id)) {
            const site = await read("Sites", id);
            if (!await confirmTerminatedScheduleSite({ siteId: id, site })) { clearRequestConfirmations(); throw new Error("保存を取り消しました。"); }
            verify(owner, ticket); requestConfirmations.add(id);
          }
          command.siteStatuses[id] = siteStatuses.get(id);
        }
      }
      verify(owner, ticket);
      if (uncertain.value) return false;
      sent = true;
      const result = await httpsCallable($functions, "saveOperation")({ operations });
      verify(owner, ticket);
      if (result.data?.success !== true) throw new Error("保存結果不明");
      clearRequestConfirmations();
      return result.data;
    } catch (error) {
      if (ticket !== generation) return false;
      const code = String(error?.code || "").replace("functions/", "");
      const resultIsUncertain = sent && !["aborted", "permission-denied", "unauthenticated", "invalid-argument", "failed-precondition", "not-found", "already-exists"].includes(code);
      if (resultIsUncertain) uncertain.value = true;
      message.value = uncertain.value ? "保存結果を確認できません。再送せず、画面を再読み込みして原本を確認してください。" : "保存できませんでした。最新情報と権限を確認してください。";
      return false;
    } finally {
      if (ticket === generation) {
        active = Math.max(0, active - 1);
        busy.value = active > 0;
      }
    }
  }
  watch(() => [auth.uid, auth.companyId, allowed.value], reset);
  onScopeDispose(reset);
  return { busy, uncertain, message, allowed, submit, read, reset, scope };
}
