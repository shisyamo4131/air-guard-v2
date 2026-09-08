import { computed, ref, shallowRef, watch, onScopeDispose } from "vue";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Certification } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { rawForClass, equal, expectedFields, CERTIFICATION_FIELDS, DATE_FIELDS, dateInput, parseEmployeeInput, buildCertificationPatch } from "@/composables/domain/employee/employeeEditContract.js";
import { isEmployeeUxActorAllowed } from "@/utils/auth/policies/employeeActorPolicy.js";

export function useEmployeeCertifications({ employeeId }) {
  const auth = useAuthStore(); const { $firestore, $functions } = useNuxtApp();
  const opened = ref(false), busy = ref(false), loading = ref(false), conflict = ref(false), uncertain = ref(false), message = ref("");
  const baseline = shallowRef(null), draft = ref(null), action = ref("add"), position = ref(null);
  let reference, unsubscribe, generation = 0, owner, draftAtOpen, expectedResult;
  const identity = () => ({ uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser, actorUser: auth.user });
  const canWrite = computed(() => auth.isSuperUserClaimValid === true && isEmployeeUxActorAllowed(identity()));
  const ownerKey = () => `${auth.companyId}/${auth.uid}`;
  const rows = computed(() => (baseline.value?.securityCertifications || []).map((row, originalPosition) => ({ ...rawForClass(row), originalPosition })).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")) || a.originalPosition - b.originalPosition));
  function verify() { if (!canWrite.value || owner !== ownerKey()) throw new Error("permission-denied"); }
  function clear() { generation++; unsubscribe?.(); unsubscribe = null; reference = null; baseline.value = null; draft.value = null; draftAtOpen = null; expectedResult = null; opened.value = false; conflict.value = false; uncertain.value = false; loading.value = false; }
  function select(nextAction, originalPosition = null) {
    if (busy.value || conflict.value || uncertain.value || !baseline.value) return;
    action.value = nextAction; position.value = originalPosition;
    const raw = nextAction === "add" ? {} : baseline.value.securityCertifications[originalPosition];
    draft.value = new Certification(rawForClass(raw)).toObject(); draftAtOpen = rawForClass(draft.value);
    message.value = "";
  }
  function receive(raw) {
    if (raw.employmentStatus !== "ACTIVE" || (raw.securityCertifications !== undefined && !Array.isArray(raw.securityCertifications))) throw new Error("invalid-state");
    baseline.value = raw; conflict.value = false; uncertain.value = false; select("add");
  }
  function subscribe() {
    unsubscribe?.(); const ticket = generation;
    unsubscribe = onSnapshot(reference, (snapshot) => {
      if (ticket !== generation || snapshot.metadata.fromCache || busy.value) return;
      if (!snapshot.exists() || snapshot.data().employmentStatus !== "ACTIVE" || !equal(snapshot.data().securityCertifications, baseline.value?.securityCertifications)) conflict.value = true;
    }, () => { if (ticket === generation) { conflict.value = true; message.value = "最新情報を取得できません。再読込してください。"; } });
  }
  async function open() {
    if (!canWrite.value || busy.value) return; clear(); owner = ownerKey(); opened.value = true; loading.value = true; message.value = ""; const ticket = generation;
    try {
      const id = typeof employeeId === "function" ? employeeId() : employeeId;
      reference = doc($firestore, `Companies/${auth.companyId}/Employees/${id}`);
      const snapshot = await getDocFromServer(reference); if (ticket !== generation) return; verify();
      if (!snapshot.exists()) throw new Error("not-found"); receive(snapshot.data()); subscribe();
    } catch { if (ticket === generation) message.value = "資格情報を取得できません。権限と最新情報を確認してください。"; }
    finally { if (ticket === generation) loading.value = false; }
  }
  async function reload() {
    if (busy.value || !reference) return; loading.value = true; const ticket = generation;
    try {
      verify(); const snapshot = await getDocFromServer(reference); if (ticket !== generation) return; verify();
      if (!snapshot.exists()) throw new Error("not-found");
      if (uncertain.value) {
        if (snapshot.data().uid === auth.uid && expectedResult && equal(snapshot.data().securityCertifications, expectedResult)) { message.value = "資格の保存内容を確認しました。"; clear(); }
        else message.value = "現在の原本と入力が一致せず、保存結果は確定できません。入力を保持しています。";
        return;
      }
      receive(snapshot.data()); subscribe(); message.value = "最新値を読み直しました。対象の資格を選択してください。";
    } catch { if (ticket === generation) message.value = "最新情報を確認できません。入力を保持しています。"; }
    finally { if (ticket === generation) loading.value = false; }
  }
  function update(changes) { Object.assign(draft.value, changes); }
  async function save() {
    if (busy.value || loading.value || conflict.value || uncertain.value || !draft.value) return; verify(); busy.value = true; message.value = ""; let sent = false; const ticket = generation;
    try {
      const changes = {};
      if (action.value !== "remove") for (const field of CERTIFICATION_FIELDS) if (action.value === "add" || !equal(draftAtOpen[field], draft.value[field])) changes[field] = DATE_FIELDS.includes(field) ? dateInput(draft.value[field]) : draft.value[field];
      const input = { employeeId: reference.id, action: action.value, position: position.value, changes, expected: expectedFields(baseline.value, ["securityCertifications"]) };
      const parsed = parseEmployeeInput("certifications", input);
      const prepared = buildCertificationPatch(baseline.value, parsed.changes, parsed);
      expectedResult = prepared.patch.securityCertifications ?? baseline.value.securityCertifications;
      verify(); sent = true; await httpsCallable($functions, "updateEmployeeCertifications")(input);
      if (ticket !== generation) return; verify(); message.value = "資格情報を保存しました。"; clear();
    } catch (error) {
      if (ticket !== generation) return;
      const code = String(error?.code || "").replace("functions/", "");
      uncertain.value = sent && !["invalid-argument", "permission-denied", "unauthenticated", "failed-precondition", "not-found", "aborted"].includes(code);
      if (code === "aborted") conflict.value = true;
      message.value = uncertain.value ? "保存結果が不明です。再送せず保存結果を確認してください。入力を保持しています。" : "保存できませんでした。入力内容・権限・最新情報を確認してください。";
    } finally { busy.value = false; }
  }
  watch(() => [canWrite.value, auth.companyId, auth.uid], () => { if (opened.value && (!canWrite.value || owner !== ownerKey())) clear(); });
  onScopeDispose(clear);
  return { opened, busy, loading, conflict, uncertain, message, draft, action, rows, canWrite, open, select, reload, update, save, close: () => { if (!busy.value) clear(); } };
}
