import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { Employee } from "@shisyamo4131/air-guard-v2-schemas";
import * as contract from "../../functions/shared/employeeContract.js";

function employee() { return new Employee({ docId: "employee", lastName: "合成", firstName: "太郎", lastNameKana: "ゴウセイ", firstNameKana: "タロウ", displayName: "合成太郎", displayNameKana: "ゴウセイタロウ", gender: "MALE", dateOfBirth: contract.parseDate("1990-01-01"), dateOfHire: contract.parseDate("2026-01-01"), zipcode: "1000001", prefCode: "13", city: "試験市", address: "合成住所" }).toObject(); }
async function harness(operation = "basic") {
  let raw = employee(), listener, authWatch, calls = [], messages = [], response = async () => ({ data: { success: true, employeeId: "employee" } });
  const auth = { uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: { docId: "actor", companyId: "company", disabled: false, isTemporary: false, isAdmin: true } };
  const ref = (value) => ({ value });
  const bindings = { ...contract, Employee, ref, shallowRef: ref, computed: (fn) => ({ get value() { return fn(); } }), watch: (_, fn) => { authWatch = fn; }, onScopeDispose() {},
    doc: (_, path) => ({ id: path ? path.split("/").at(-1) : "reserved-id" }), collection: () => ({}),
    getDocFromServer: async () => ({ exists: () => raw !== null, data: () => raw }),
    onSnapshot: (_, fn) => { listener = fn; return () => {}; },
    httpsCallable: (_, api) => async (input) => { calls.push({ api, input }); return response(input); },
    useAuthStore: () => auth, useMessagesStore: () => ({ add: (message) => messages.push(message) }), useNuxtApp: () => ({ $firestore: {}, $functions: {} }),
  };
  const source = (await readFile(new URL("../../composables/application/employee/useEmployeeEditor.js", import.meta.url), "utf8")).replace(/import[\s\S]*?;\s*/gu, "").replace("export function", "function");
  const factory = new Function(...Object.keys(bindings), `${source}; return useEmployeeEditor;`)(...Object.values(bindings));
  return { editor: factory({ operation, employeeId: "employee" }), auth, calls, messages, setResponse: (fn) => { response = fn; }, setRaw: (value) => { raw = value; }, raw: () => raw, notify: () => listener?.({ exists: () => raw !== null, data: () => raw, metadata: { fromCache: false } }), authWatch: () => authWatch() };
}
test("EMP02 editor keeps live immutable, ignores unrelated fields, and holds draft on rejection", async () => {
  const h = await harness(); await h.editor.open(); h.editor.update({ title: "主任" }); assert.equal(h.raw().title, null);
  h.setRaw({ ...h.raw(), remarks: "外部" }); h.notify(); assert.equal(h.editor.conflict.value, true);
  await h.editor.save(); assert.equal(h.calls.length, 0); assert.equal(h.editor.draft.value.title, "主任");
  await h.editor.reload(); assert.equal(h.editor.draft.value.remarks, "外部");
  h.editor.update({ title: "主任" }); h.setResponse(async () => { throw { code: "functions/permission-denied" }; }); await h.editor.save(); assert.equal(h.editor.draft.value.title, "主任"); assert.equal(h.editor.uncertain.value, false);
});
test("EMP02 editor never backfills missing optional fields merely on open", async () => {
  const h = await harness(); const raw = h.raw(); delete raw.remarks; delete raw.dateOfTermination; h.setRaw(raw); await h.editor.open(); h.editor.update({ title: "主任" }); await h.editor.save(); assert.deepEqual(h.calls[0].input.changes, { title: "主任" });
});
test("EMP02 editor preserves Timestamp nanos in membership expected", async () => {
  const h = await harness(); h.setRaw({ ...h.raw(), dateOfHire: { seconds: 1767193200, nanoseconds: 123, toDate: () => contract.parseDate("2026-01-01") } }); await h.editor.open(); h.editor.update({ dateOfHire: contract.parseDate("2026-01-02") }); await h.editor.save(); assert.deepEqual(h.calls[0].input.expected.dateOfHire, ["timestamp", 1767193200, 123]);
});
test("EMP02 uncertain update does not discard draft on unmatched reload", async () => {
  const h = await harness(); await h.editor.open(); h.editor.update({ title: "主任" }); h.setResponse(async () => { throw { code: "functions/unavailable" }; }); await h.editor.save(); await h.editor.reload(); assert.equal(h.editor.uncertain.value, true); assert.equal(h.editor.draft.value.title, "主任");
  h.setRaw({ ...h.raw(), title: "主任", uid: "actor" }); await h.editor.reload(); assert.equal(h.editor.opened.value, false); assert.match(h.editor.message.value, /確認しました/);
});
test("EMP02 create retry retains one ID and is single-flight", async () => {
  const h = await harness("create"); await h.editor.open(); h.editor.update(employee()); let reject; h.setResponse(() => new Promise((_, fail) => { reject = fail; })); const pending = h.editor.save(); await h.editor.save(); assert.equal(h.calls.length, 1); reject({ code: "functions/unavailable" }); await pending;
  h.setRaw(null); await h.editor.reload(); assert.equal(h.editor.canRetryCreate.value, true); h.setResponse(async () => ({ data: { success: true, employeeId: "reserved-id" } })); await h.editor.retryCreate(); assert.equal(h.calls[0].input.employeeId, h.calls[1].input.employeeId);
});
test("EMP02 auth loss discards memory and stops stale saves", async () => { const h = await harness(); await h.editor.open(); h.auth.user.disabled = true; h.authWatch(); assert.equal(h.editor.opened.value, false); assert.equal(h.editor.draft.value, null); });
test("EMP02 name auto generation and explicit display including original value are preserved", async () => {
  for (const explicit of [undefined, "指定名", "合成太郎"]) {
    const h = await harness(); await h.editor.open(); h.editor.update({ firstName: "次郎" });
    if (explicit !== undefined) h.editor.update({ displayName: explicit });
    await h.editor.save(); assert.equal(h.calls[0].input.changes.displayName, explicit ?? "合成次郎");
  }
});
test("EMP02 coordinate warning survives navigation in global queue exactly once", async () => {
  const h = await harness(); await h.editor.open(); h.editor.update({ address: "新住所" }); h.setResponse(async () => ({ data: { success: true, warning: "untrusted provider detail" } })); await h.editor.save();
  assert.deepEqual(h.messages, [{ text: "住所を保存しました。地図座標は取得できませんでした。", color: "warning" }]); assert.equal(h.editor.opened.value, false); assert.equal(h.editor.message.value, "");
});
test("EMP02 stay-limit clear transmits raw flag and date expectations", async () => {
  const h = await harness("nationality");
  const raw = { ...h.raw(), isForeigner: true, foreignName: "Synthetic", nationality: "試験国", residenceStatus: "試験資格", hasPeriodOfStayLimit: true, periodOfStay: contract.parseDate("2027-01-01") };
  h.setRaw(raw); await h.editor.open(); h.editor.update({ hasPeriodOfStayLimit: false }); await h.editor.save();
  assert.deepEqual(h.calls[0].input.expected, contract.expectedFields(raw, ["hasPeriodOfStayLimit", "periodOfStay"]));
});
test("EMP02 actual AirItemInput attrs feed the statically registered display-name slot", async () => {
  const source = await readFile(new URL("../../air-vuetify-v3/src/AirItemInput.vue", import.meta.url), "utf8");
  const { descriptor } = parse(source);
  const editorSource = await readFile(new URL("../../components/Employee/Editor.vue", import.meta.url), "utf8");
  const editor = parse(editorSource).descriptor;
  const compiled = compileTemplate({ source: editor.template.content, filename: "EmployeeEditor.vue", id: "employee-editor" });
  assert.deepEqual(compiled.errors, []);
  assert.match(compiled.code, /_resolveComponent\("v-text-field"\)/);
  assert.match(compiled.code, /"input\.displayName":/);
  assert.match(editor.template.content, /#input\.displayName="\{ attrs \}"[\s\S]*?<v-text-field v-bind="attrs"/);
  assert.match(descriptor.template.content, /:name="`input\.\$\{field\.key\}`"[\s\S]*?:attrs="field\.component\.attrs"/);
  const setup = descriptor.scriptSetup.content.replace(/import[\s\S]*?;\s*/gu, "");
  for (const operation of ["create", "basic"]) {
    const h = await harness(operation); await h.editor.open();
    const props = { schema: contract.operationSchema(operation), item: h.editor.draft.value, updateProperties: h.editor.update, editMode: operation === "create" ? "CREATE" : "UPDATE", disabled: false, includedKeys: null, excludedKeys: [] };
    const fields = new Function("computed", "useSlots", "defineOptions", "defineProps", `${setup}; return formFields;`)((fn) => ({ get value() { return fn(); } }), () => ({}), () => {}, () => props);
    const field = (key) => fields.value.find((item) => item.key === key);
    assert.equal(field("displayName").component.name, Employee.classProps.displayName.component.name);
    assert.equal(field("displayName").component.attrs.label, "表示名");
    assert.equal(field("displayName").component.attrs.required, true);
    assert.equal(field("lastName").component.name, Employee.classProps.lastName.component.name);
    for (const value of ["合", "合成"]) field("lastName").component.attrs["onUpdate:modelValue"](value);
    for (const value of ["確", "確認"]) field("firstName").component.attrs["onUpdate:modelValue"](value);
    assert.equal(field("displayName").component.attrs.modelValue, "合成確認");
    field("displayName").component.attrs["onUpdate:modelValue"]("明示名");
    field("firstName").component.attrs["onUpdate:modelValue"]("次郎");
    assert.equal(field("displayName").component.attrs.modelValue, "明示名");
  }
});
test("EMP02 changed Vue files compile", async () => {
  for (const file of ["components/Employee/Editor.vue", "components/Employees/Manager/index.vue", "components/Employee/Manager/index.vue", "components/Employee/Activator/Base.vue", "components/Employee/Activator/Nationality.vue", "components/Employee/Activator/SecurityGuard.vue", "components/Employee/Autocomplete.vue", "pages/employees/index.vue", "pages/employees/[id].vue"]) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8"); const { descriptor, errors } = parse(source, { filename: file }); assert.deepEqual(errors, [], file); const script = compileScript(descriptor, { id: file }); const result = compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } }); assert.deepEqual(result.errors, [], file);
  }
});
