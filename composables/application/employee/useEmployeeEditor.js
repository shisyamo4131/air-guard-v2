import { computed, ref, shallowRef, watch, onScopeDispose } from "vue";
import { doc, collection, getDocFromServer, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Employee } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { operationFields, BASIC_FIELDS, NATIONALITY_FIELDS, SECURITY_FIELDS, DATE_FIELDS, employeeAllowed, rawForClass, equal, expectedFields, dateInput, buildEmployeePatch, parseEmployeeInput } from "@/functions/shared/employeeContract.js";

export function useEmployeeEditor({ operation, employeeId }) {
  const auth = useAuthStore();
  const messages = useMessagesStore();
  const { $firestore, $functions } = useNuxtApp();
  const opened = ref(false), busy = ref(false), loading = ref(false), conflict = ref(false), uncertain = ref(false);
  const canRetryCreate = ref(false);
  const message = ref(""), draft = ref(null), baseline = shallowRef(null);
  let reference = null, unsubscribe = null, generation = 0, owner = null, draftAtOpen = null, pendingComparison = null, displayEdited = false;
  const id = () => typeof employeeId === "function" ? employeeId() : employeeId;
  const decision = () => auth.isSuperUserClaimValid === true && employeeAllowed({ uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser, actorUser: auth.user });
  const canWrite = computed(decision);
  const ownedFields = operationFields(operation);
  function clear() {
    generation++; unsubscribe?.(); unsubscribe = null; reference = null; owner = null;
    opened.value = false; baseline.value = null; draft.value = null; draftAtOpen = null; pendingComparison = null; displayEdited = false; conflict.value = false; uncertain.value = false; canRetryCreate.value = false; loading.value = false;
  }
  function currentOwner() { return `${auth.companyId}/${auth.uid}`; }
  function verifyOwner() { if (!decision() || currentOwner() !== owner) throw new Error("編集権限を確認できません。"); }
  function setRaw(raw) {
    if (raw.employmentStatus !== "ACTIVE") throw new Error("在職中の従業員だけを編集できます。");
    baseline.value = raw;
    draft.value = rawForClass(new Employee(rawForClass(raw)).toObject());
    draftAtOpen = rawForClass(draft.value);
    displayEdited = false;
    conflict.value = false; uncertain.value = false;
  }
  function subscribe() {
    unsubscribe?.(); const ticket = generation;
    unsubscribe = onSnapshot(reference, (snapshot) => {
      if (ticket !== generation || snapshot.metadata.fromCache || busy.value) return;
      if (!snapshot.exists() || snapshot.data().employmentStatus !== "ACTIVE" || ownedFields.some((field) => !equal(snapshot.data()[field], baseline.value?.[field]))) conflict.value = true;
    }, () => { if (ticket === generation) { conflict.value = true; message.value = "最新情報を取得できません。再読込してください。"; } });
  }
  async function open() {
    if (!decision() || busy.value) return;
    clear(); owner = currentOwner(); const ticket = generation;
    opened.value = true; loading.value = true; message.value = "";
    try {
      reference = operation === "create" ? doc(collection($firestore, `Companies/${auth.companyId}/Employees`)) : doc($firestore, `Companies/${auth.companyId}/Employees/${id()}`);
      if (operation === "create") { baseline.value = new Employee().toObject(); draft.value = rawForClass(baseline.value); draftAtOpen = rawForClass(draft.value); }
      else {
        const snapshot = await getDocFromServer(reference);
        if (ticket !== generation) return;
        verifyOwner();
        if (!snapshot.exists()) throw new Error("従業員情報が見つかりません。");
        setRaw(snapshot.data()); subscribe();
      }
    } catch { if (ticket === generation) message.value = "編集を開始できません。権限と最新情報を確認してください。"; }
    finally { if (ticket === generation) loading.value = false; }
  }
  async function reload() {
    if (busy.value || !reference) return;
    const ticket = generation; loading.value = true;
    try {
      verifyOwner(); const snapshot = await getDocFromServer(reference);
      if (ticket !== generation) return;
      verifyOwner();
      if (!snapshot.exists()) {
        canRetryCreate.value = uncertain.value && operation === "create";
        message.value = canRetryCreate.value ? "現在の原本はありません。同じ登録先にだけ再送できます。先の要求と重なっても既存原本を上書きしません。" : "従業員情報が見つかりません。先の保存結果は確定できません。";
        return;
      }
      if (uncertain.value && pendingComparison && snapshot.data().uid === auth.uid && Object.entries(pendingComparison).every(([field, value]) => equal(snapshot.data()[field], value))) {
        message.value = "入力した内容が保存されていることを確認しました。"; clear(); return;
      }
      if (uncertain.value) { canRetryCreate.value = false; message.value = "現在の原本と入力が一致せず、保存結果は確定できません。入力を保持しています。原本を別画面で確認してください。"; return; }
      if (operation === "create") { message.value = "この登録先に原本が存在します。一覧で確認してください。再登録はできません。"; uncertain.value = true; return; }
      setRaw(snapshot.data()); message.value = "最新値を読み直しました。"; subscribe();
    } catch { if (ticket === generation) message.value = "最新値を確認できませんでした。入力を保持しています。"; }
    finally { if (ticket === generation) loading.value = false; }
  }
  function update(changes) {
    if (Object.hasOwn(changes, "displayName")) displayEdited = true;
    Object.assign(draft.value, changes);
    if (!displayEdited && ["lastName", "firstName"].some((field) => Object.hasOwn(changes, field))) draft.value.displayName = `${draft.value.lastName || ""}${draft.value.firstName || ""}`.trim();
  }
  function requestInput() {
    const changes = {};
    for (const field of ownedFields) {
      const value = draft.value[field];
      if (operation === "create" || (field === "displayName" && displayEdited) || !equal(draftAtOpen[field], value)) changes[field] = DATE_FIELDS.includes(field) ? dateInput(value) : value;
    }
    const expected = {};
    if (operation === "basic" && Object.hasOwn(changes, "dateOfHire")) Object.assign(expected, expectedFields(baseline.value, ["dateOfHire"]));
    if (operation === "nationality" && changes.isForeigner === false) Object.assign(expected, expectedFields(baseline.value, NATIONALITY_FIELDS));
    else if (operation === "nationality" && changes.hasPeriodOfStayLimit === false) Object.assign(expected, expectedFields(baseline.value, ["hasPeriodOfStayLimit", "periodOfStay"]));
    if (operation === "security" && changes.hasSecurityGuardRegistration === false) Object.assign(expected, expectedFields(baseline.value, SECURITY_FIELDS));
    return { employeeId: reference.id, changes, expected };
  }
  async function save() {
    if (busy.value || loading.value || conflict.value || uncertain.value || !draft.value) return null;
    verifyOwner(); busy.value = true; message.value = ""; const ticket = generation; let sent = false;
    try {
      const input = requestInput();
      // Validate the exact operation candidate, without mutating the listener model.
      const parsed = parseEmployeeInput(operation, input);
      const prepared = buildEmployeePatch(baseline.value, parsed.changes, operation);
      pendingComparison = operation === "create" ? Object.fromEntries(Object.entries(prepared.model.toObject()).filter(([field]) => !["docId", "uid", "createdAt", "updatedAt", "location", "geopoint"].includes(field))) : prepared.patch;
      verifyOwner();
      const api = { create: "createEmployee", basic: "updateEmployeeBasic", nationality: "updateEmployeeNationality", security: "updateEmployeeSecurity" }[operation];
      sent = true;
      const result = (await httpsCallable($functions, api)(input)).data;
      if (ticket !== generation) return null;
      verifyOwner();
      if (result.warning) messages.add({ text: "住所を保存しました。地図座標は取得できませんでした。", color: "warning" });
      message.value = result.warning ? "" : "保存しました。";
      clear();
      return result;
    } catch (error) {
      if (ticket !== generation) return null;
      const code = String(error?.code || "").replace("functions/", "");
      uncertain.value = sent && !["invalid-argument", "permission-denied", "unauthenticated", "failed-precondition", "not-found", "aborted"].includes(code);
      if (code === "aborted") conflict.value = true;
      message.value = uncertain.value ? "保存結果が不明です。入力を保持しています。再送せず登録結果を確認してください。" : "保存できませんでした。入力を保持しています。入力内容・権限・最新値を確認してください。";
      return null;
    } finally { busy.value = false; }
  }
  watch(() => [canWrite.value, auth.companyId, auth.uid], () => { if (opened.value && (!decision() || currentOwner() !== owner)) clear(); });
  onScopeDispose(clear);
  async function retryCreate() { if (operation !== "create" || !canRetryCreate.value || busy.value) return null; uncertain.value = false; canRetryCreate.value = false; return save(); }
  return { opened, busy, loading, conflict, uncertain, canRetryCreate, message, draft, canWrite, open, close: () => { if (!busy.value) clear(); }, reload, update, save, retryCreate };
}
