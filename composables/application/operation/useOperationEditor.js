import { operationDateTime } from "@/composables/domain/operation/operationDateTime";
import { computed, ref, shallowRef, watch, onScopeDispose } from "vue";
import { collection, doc, getDocFromServer } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { SiteOperationSchedule, OperationResult, OperationBilling, ArticleDetail } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { rawForClass, equal, dateInput } from "@/composables/domain/shared/valueContract";
import { expectedForOperation, OVERVIEW_FIELDS, WORKER_FIELDS, ADJUSTED_FIELDS } from "@/composables/domain/operation/operationCommandContract";
import { operationUxAllowed } from "@/utils/auth/policies/operationActorPolicy";
import { confirmTerminatedScheduleSite } from "@/composables/application/siteOperationSchedule/confirmTerminatedSite";
import { SITE_SCHEDULE_CONFIRMATION } from "@/utils/siteOperationSchedule/siteScheduleGuard";

export function useOperationEditor({ kind, defaultAction = "overview", fields: configuredFields, onSaved = () => {}, optimistic = null, allowDeleteFromUpdate = false }) {
  const auth = useAuthStore(), { $firestore, $functions } = useNuxtApp();
  const opened = ref(false), busy = ref(false), loading = ref(false), conflict = ref(false), uncertain = ref(false), message = ref("");
  const draft = ref(null), baseline = shallowRef(null), definition = shallowRef(null);
  const inputPending = ref(false);
  const deleteRequested = ref(false), canDeleteFromUpdate = ref(false);
  let owner = null, generation = 0, original = null, reference = null, rowOptions = null, displayedSource = null;
  const confirmedSites = new Set();
  const scope = () => `${auth.companyId}/${auth.uid}`;
  const allowed = () => auth.isSuperUserClaimValid === true && operationUxAllowed({ uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser }, auth.user?.toObject?.() || auth.user, { billing: kind === "billing" });
  const canWrite = computed(allowed);
  const disabled = computed(() => !canWrite.value || busy.value || loading.value || conflict.value || uncertain.value || !draft.value);
  const saveDisabled = computed(() => disabled.value || (!deleteRequested.value && inputPending.value));
  const Schema = kind === "schedule" ? SiteOperationSchedule : kind === "billing" ? OperationBilling : OperationResult;
  function clear() { generation++; opened.value = false; draft.value = null; baseline.value = null; original = null; owner = null; reference = null; rowOptions = null; displayedSource = null; definition.value = null; loading.value = false; conflict.value = false; uncertain.value = false; inputPending.value = false; deleteRequested.value = false; canDeleteFromUpdate.value = false; confirmedSites.clear(); }
  function verify() { if (!allowed() || scope() !== owner) throw new Error("編集権限を確認できません。"); }
  function fieldsFor(action) {
    if (configuredFields) { const fields = typeof configuredFields === "function" ? configuredFields() : configuredFields; if (fields) return fields; }
    if (action === "workers") return WORKER_FIELDS;
    if (action === "articles") return ["articleId", "price", "quantity"];
    if (action === "adjusted") return ADJUSTED_FIELDS;
    if (action === "agreement") return ["agreement", "billingDateAt"];
    if (action === "lock") return ["isLocked"];
    return kind === "billing" ? OVERVIEW_FIELDS.filter((key) => key !== "securityType") : OVERVIEW_FIELDS;
  }
  function initializeDraft(raw, command) {
    baseline.value = raw;
    let model;
    if (["workers", "articles"].includes(command.action)) {
      const RowSchema = command.action === "articles" ? ArticleDetail : Schema.classProps[command.array].customClass;
      model = new RowSchema(command.rowAction === "add" ? { ...rawForClass(raw), isEmployee: command.array === "employees", ...(kind === "schedule" ? { siteOperationScheduleId: reference.id, hasNotification: false } : {}) } : rawForClass(raw[command.array][command.position]));
      definition.value = RowSchema;
    } else { model = new Schema(rawForClass(raw || {})); definition.value = Schema; }
    operationDateTime(model);
    draft.value = model; original = rawForClass(model.toObject());
    conflict.value = false;
  }
  async function open(mode = "UPDATE", item = null, options = {}) {
    if (busy.value || !allowed()) return false;
    clear(); owner = scope(); const ticket = generation;
    opened.value = true; loading.value = true; message.value = "";
    const action = mode === "CREATE" ? "create" : mode === "DELETE" ? "delete" : defaultAction;
    rowOptions = { action, ...options };
    displayedSource = item && typeof item === "object" ? item : null;
    reference = mode === "CREATE" ? doc(collection($firestore, `Companies/${auth.companyId}/${kind === "schedule" ? "SiteOperationSchedules" : "OperationResults"}`)) : doc($firestore, `Companies/${auth.companyId}/${kind === "schedule" ? "SiteOperationSchedules" : "OperationResults"}/${item?.docId || item}`);
    try {
      let raw = options.raw;
      if (mode !== "CREATE" && !raw) {
        const snapshot = await getDocFromServer(reference);
        if (ticket !== generation) return false;
        verify(); if (!snapshot.exists()) throw new Error("原本が見つかりません。");
        raw = snapshot.data();
      }
      if (ticket !== generation) return false;
      initializeDraft(raw || null, rowOptions);
      canDeleteFromUpdate.value = allowDeleteFromUpdate && kind === "schedule" && mode === "UPDATE" && action === "overview"
        && raw?.operationResultId == null && draft.value?.operationResultId == null;
      if (mode === "CREATE" && item) {
        for (const field of fieldsFor(action)) if (item[field] !== undefined && !equal(draft.value[field], item[field])) draft.value[field] = rawForClass(item[field]);
      }
      return true;
    } catch { if (ticket === generation) { canDeleteFromUpdate.value = false; deleteRequested.value = false; message.value = "編集を開始できません。最新情報を確認してください。"; } return false; }
    finally { if (ticket === generation) loading.value = false; }
  }
  function request() {
    const action = canDeleteFromUpdate.value && deleteRequested.value ? "delete" : rowOptions.action;
    const changes = {};
    if (!(["delete"].includes(action) || ["remove", "move"].includes(rowOptions.rowAction))) for (const field of fieldsFor(action)) {
      const value = draft.value[field];
      if (action !== "create" && rowOptions.rowAction !== "add" && equal(original[field], value)) continue;
      if (field === "agreement") changes.agreementKey = value?.key ?? null;
      else if (field === "isLocked") changes.desiredLocked = value;
      else changes[field] = ["dateAt", "billingDateAt"].includes(field) ? dateInput(value) : value;
    }
    const command = { kind, documentId: reference.id, action, changes };
    for (const field of ["rowAction", "array", "position", "destination"]) if (Object.hasOwn(rowOptions, field)) command[field] = rowOptions[field];
    command.expected = expectedForOperation(baseline.value, command);
    return command;
  }
  async function guardSites(command, ticket) {
    if (kind !== "schedule" || !["create", "overview"].includes(command.action)) return;
    const changed = command.action === "create" || ["siteId", "dateAt"].some((field) => Object.hasOwn(command.changes, field));
    if (!changed) return;
    const companyId = auth.companyId, attemptOwner = owner, targetSiteId = draft.value.siteId;
    const siteIds = [...new Set([baseline.value?.siteId, targetSiteId].filter(Boolean))];
    const selected = draft.value[SITE_SCHEDULE_CONFIRMATION];
    const verifyAttempt = () => { if (ticket !== generation || companyId !== auth.companyId || attemptOwner !== owner) throw new Error("編集対象が変わりました。"); verify(); };
    command.siteStatuses = {};
    for (const id of siteIds) {
      verifyAttempt();
      const snapshot = await getDocFromServer(doc($firestore, `Companies/${companyId}/Sites/${id}`));
      verifyAttempt(); if (!snapshot.exists()) throw new Error("現場が見つかりません。");
      const raw = snapshot.data();
      if (raw.isTemporary !== false || !["ACTIVE", "TERMINATED"].includes(raw.status)) throw new Error("現場の状態を確認してください。");
      const fromSelection = selected?.companyId === companyId && selected.siteId === id && selected.status === "TERMINATED" && !!selected.operationId;
      if (raw.status === "TERMINATED" && id === targetSiteId && !confirmedSites.has(id) && !fromSelection) {
        verifyAttempt();
        const confirmed = await confirmTerminatedScheduleSite({ siteId: id, site: raw });
        verifyAttempt();
        if (!confirmed) { confirmedSites.clear(); throw new Error("保存を取り消しました。"); }
        confirmedSites.add(id);
      }
      command.siteStatuses[id] = raw.status;
    }
  }
  async function save() {
    if (saveDisabled.value) return false;
    const ticket = generation; busy.value = true; message.value = "";
    let sent = false, committed = false, locallyPublished = false;
    try {
      verify(); const command = request();
      await guardSites(command, ticket); verify();
      if (ticket !== generation) return false;
      if (kind === "schedule" && optimistic) {
        if (optimistic.publish({
          command,
          raw: baseline.value,
          source: displayedSource,
        }) !== true) throw new Error("表示を更新できませんでした。");
        locallyPublished = true;
      }
      sent = true;
      const response = await httpsCallable($functions, "saveOperation")({ operations: [command] });
      if (ticket !== generation) return false;
      verify();
      if (response.data?.success !== true) throw new Error("結果不明");
      committed = true;
      if (locallyPublished) {
        const saved = optimistic.currentSchedule(command.documentId);
        clear(); await onSaved(saved, response.data); return true;
      }
      const snapshot = await getDocFromServer(reference);
      if (ticket !== generation) return false;
      verify();
      const saved = snapshot.exists() ? new Schema(rawForClass(snapshot.data())) : null;
      clear(); await onSaved(saved, response.data); return true;
    } catch (error) {
      if (!committed && locallyPublished) {
        if (ticket !== generation) return false;
        try { await optimistic.refresh([reference.id]); } catch { /* listener fallback */ }
      }
      if (ticket !== generation) return false;
      if (committed) {
        if (!allowed() || scope() !== owner) return false;
        clear(); message.value = "保存は完了しましたが、最新情報を再取得できませんでした。再送せず、原本と閲覧権限を確認してください。";
        return true;
      }
      const code = String(error?.code || "").replace("functions/", "");
      uncertain.value = sent && !["aborted", "permission-denied", "unauthenticated", "invalid-argument", "failed-precondition", "not-found", "already-exists"].includes(code);
      conflict.value = ["aborted", "not-found", "already-exists"].includes(code);
      message.value = uncertain.value ? "保存結果を確認できません。入力を保持しています。自動再送はしません。原本を確認してください。" : "保存できませんでした。入力を保持しています。最新情報と権限を確認してください。";
      return false;
    } finally { if (ticket === generation || !opened.value) busy.value = false; }
  }
  async function reload() {
    if (busy.value || !reference) return;
    if (uncertain.value) { message.value = "先の保存結果は確定できません。入力を保持しています。別画面で原本を確認してください。"; return; }
    if (["workers", "articles"].includes(rowOptions?.action)) { clear(); message.value = "最新の一覧から対象行を選び直してください。"; return; }
    const id = reference.id; return open("UPDATE", id);
  }
  function close() { if (!busy.value) clear(); }
  function reset() { clear(); busy.value = false; message.value = ""; }
  const inputSchema = computed(() => fieldsFor(rowOptions?.action || defaultAction).filter((field) => definition.value?.classProps[field]).map((field) => ({ key: field, ...definition.value.classProps[field] })));
  watch(() => [auth.uid, auth.companyId, canWrite.value], () => { if (owner && (scope() !== owner || !canWrite.value)) { clear(); busy.value = false; } });
  onScopeDispose(clear);
  return { opened, busy, loading, conflict, uncertain, message, draft, baseline, definition, canWrite, disabled, saveDisabled, deleteRequested, canDeleteFromUpdate, setDeleteRequested: (value) => { if (canDeleteFromUpdate.value && !busy.value) deleteRequested.value = value === true; }, setInputPending: (value) => { inputPending.value = value === true; }, inputSchema, open, save, reload, close, reset, request, update: (changes) => { if (!disabled.value && !deleteRequested.value) Object.assign(draft.value, changes); }, get action() { return rowOptions?.action; }, get rowAction() { return rowOptions?.rowAction; } };
}
