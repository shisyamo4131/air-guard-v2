import { computed, ref, shallowRef, watch, onScopeDispose } from "vue";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Insurance } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { employeeAllowed, rawForClass, equal, encodeExpected, dateInput } from "@/functions/shared/employeeContract.js";
import { insuranceVersions, validateInsuranceRaw, INSURANCE_ACTION_FIELDS, parseEmployeeInsuranceInput, prepareEmployeeInsurance } from "@/functions/shared/employeeInsuranceContract.js";

export function useEmployeeInsurance({ employeeId, kind }) {
  const auth = useAuthStore(); const { $firestore, $functions } = useNuxtApp();
  const opened = ref(false), busy = ref(false), loading = ref(false), conflict = ref(false), uncertain = ref(false), message = ref("");
  const baseline = shallowRef(null), draft = ref(null), action = ref(null);
  let reference, unsubscribe, owner, generation = 0, expectedResult;
  const identity = () => ({ uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser, actorUser: auth.user });
  const ownerKey = () => `${auth.companyId}/${auth.uid}`;
  const canWrite = computed(() => auth.isSuperUserClaimValid === true && employeeAllowed(identity()));
  function verify() { if (!canWrite.value || owner !== ownerKey()) throw new Error("permission-denied"); }
  function clear() { generation++; unsubscribe?.(); unsubscribe = null; reference = null; baseline.value = null; draft.value = null; expectedResult = null; opened.value = false; conflict.value = false; uncertain.value = false; loading.value = false; }
  function receive(raw) {
    if (raw.employmentStatus !== "ACTIVE") throw new Error("invalid-state");
    validateInsuranceRaw(raw[kind]); insuranceVersions(raw);
    baseline.value = raw; draft.value = new Insurance(rawForClass(raw[kind])).toObject(); conflict.value = false; uncertain.value = false;
  }
  function subscribe() {
    unsubscribe?.(); const ticket = generation;
    unsubscribe = onSnapshot(reference, (snapshot) => {
      if (ticket !== generation || snapshot.metadata.fromCache || busy.value) return;
      try {
        const raw = snapshot.data();
        if (!snapshot.exists() || raw.employmentStatus !== "ACTIVE" || !equal(raw[kind], baseline.value[kind]) || insuranceVersions(raw)[kind] !== insuranceVersions(baseline.value)[kind]) conflict.value = true;
      } catch { conflict.value = true; }
    }, () => { if (ticket === generation) { conflict.value = true; message.value = "最新情報を取得できません。再読込してください。"; } });
  }
  async function open(nextAction) {
    if (!canWrite.value || busy.value || !Object.hasOwn(INSURANCE_ACTION_FIELDS, nextAction)) return;
    clear(); owner = ownerKey(); action.value = nextAction; opened.value = true; loading.value = true; message.value = ""; const ticket = generation;
    try {
      const id = typeof employeeId === "function" ? employeeId() : employeeId;
      reference = doc($firestore, `Companies/${auth.companyId}/Employees/${id}`);
      const snapshot = await getDocFromServer(reference); if (ticket !== generation) return; verify();
      if (!snapshot.exists()) throw new Error("not-found"); receive(snapshot.data()); subscribe();
    } catch { if (ticket === generation) message.value = "保険の原本と保存世代を取得できません。権限と最新情報を確認してください。"; }
    finally { if (ticket === generation) loading.value = false; }
  }
  async function reload() {
    if (busy.value || !reference) return; loading.value = true; const ticket = generation;
    try {
      verify(); const snapshot = await getDocFromServer(reference); if (ticket !== generation) return; verify();
      if (!snapshot.exists()) throw new Error("not-found"); const raw = snapshot.data();
      if (uncertain.value) {
        if (expectedResult && raw.uid === auth.uid && insuranceVersions(raw)[kind] === expectedResult.versions[kind] && equal(raw[kind], expectedResult.nextMap)) { message.value = "保険の保存内容を確認しました。"; clear(); }
        else message.value = "現在の原本と保存世代から先の結果を確定できません。入力を保持しています。";
        return;
      }
      receive(raw); subscribe(); message.value = "原本と保存世代を一緒に読み直しました。現在の状態と入力内容を確認してください。";
    } catch { if (ticket === generation) { conflict.value = true; message.value = "原本と保存世代を確認できません。入力を保持しています。"; } }
    finally { if (ticket === generation) loading.value = false; }
  }
  function update(changes) { if (draft.value && !busy.value && !loading.value && !conflict.value && !uncertain.value) Object.assign(draft.value, changes); }
  async function save() {
    if (busy.value || loading.value || conflict.value || uncertain.value || !draft.value) return; verify(); busy.value = true; message.value = ""; let sent = false; const ticket = generation;
    try {
      const changes = Object.fromEntries(INSURANCE_ACTION_FIELDS[action.value].map((field) => [field, ["enrollmentDateAt", "lossDateAt"].includes(field) ? dateInput(draft.value[field]) : draft.value[field]]));
      const input = { employeeId: reference.id, kind, action: action.value, changes, expected: { map: encodeExpected(baseline.value[kind]), version: insuranceVersions(baseline.value)[kind] } };
      const parsed = parseEmployeeInsuranceInput(input); expectedResult = prepareEmployeeInsurance(baseline.value, parsed);
      verify(); sent = true; await httpsCallable($functions, "transitionEmployeeInsurance")(input);
      if (ticket !== generation) return; verify(); message.value = "保険情報を保存しました。"; clear();
    } catch (error) {
      if (ticket !== generation) return;
      const code = String(error?.code || "").replace("functions/", "");
      uncertain.value = sent && !["invalid-argument", "permission-denied", "unauthenticated", "failed-precondition", "not-found", "aborted"].includes(code);
      if (code === "aborted") conflict.value = true;
      message.value = uncertain.value ? "保存結果が不明です。再送せず保存結果を確認してください。入力を保持しています。" : "保存できませんでした。現在の状態、入力内容、権限と最新情報を確認してください。";
    } finally { busy.value = false; }
  }
  watch(() => [canWrite.value, auth.companyId, auth.uid], () => { if (opened.value && (!canWrite.value || owner !== ownerKey())) clear(); });
  onScopeDispose(clear);
  return { opened, busy, loading, conflict, uncertain, message, draft, action, canWrite, open, reload, update, save, close: () => { if (!busy.value) clear(); } };
}
