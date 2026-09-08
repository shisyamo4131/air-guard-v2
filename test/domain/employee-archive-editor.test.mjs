import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Vue from "vue";
import { User } from "@shisyamo4131/air-guard-v2-schemas";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import * as contract from "../../functions/shared/employeeArchiveContract.js";
import { rawForClass } from "../../functions/shared/employeeContract.js";

test("known archive success excludes the current Employee and stops User reads without affecting another route", async () => {
  const id = Vue.ref("employee"), cachedEmployees = Vue.ref({}), scope = Vue.ref(JSON.stringify(["company", "actor"]));
  const listeners = [], accepts = [], token = { generation: 1 };
  const reader = { cachedEmployees, scope, canRead: Vue.ref(true), clearCache() {}, fetchEmployee() {}, captureScope: () => token,
    acceptRaw(targetId, value, owner) { accepts.push([targetId, value, owner]); delete cachedEmployees.value[targetId]; }, getStatus: () => "missing" };
  const source = (await readFile(new URL("../../composables/application/employee/useEmployeeDetailRead.js", import.meta.url), "utf8")).replace(/import[\s\S]*?;\s*/gu, "").replace("export function", "function");
  const bindings = { ...Vue, User, rawForClass, useFetchEmployee: () => reader, useNuxtApp: () => ({ $firestore: {} }), collection: (...args) => args, query: (...args) => args, where: (...args) => args,
    onSnapshot: (_query, _options, next) => { const listener = { next, stopped: false }; listeners.push(listener); return () => { listener.stopped = true; }; } };
  const make = new Function(...Object.keys(bindings), `${source}; return useEmployeeDetailRead;`)(...Object.values(bindings));
  const effect = Vue.effectScope(); let detail; effect.run(() => { detail = make(() => id.value); });
  cachedEmployees.value.employee = { docId: "employee" }; const old = listeners.at(-1);
  old.next({ metadata: { fromCache: false }, docs: [{ data: () => ({ docId: "linked", employeeId: "employee" }) }] }); assert.equal(detail.users.value.length, 1);
  detail.excludeArchived("other"); assert.equal(accepts.length, 0);
  detail.excludeArchived("employee"); assert.deepEqual(accepts, [["employee", null, token]]); assert.equal(detail.doc.value, null); assert.equal(old.stopped, true); assert.deepEqual(detail.users.value, []);
  old.next({ metadata: { fromCache: false }, docs: [{ data: () => ({ docId: "stale" }) }] }); assert.deepEqual(detail.users.value, []); effect.stop();
});

async function setup(call = async () => ({ data: { success: true, archived: true } })) {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isEmailVerified: true, isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isAdmin: false, disabled: false, isTemporary: false, roles: ["manager"] }) });
  const employeeId = Vue.ref("employee"), employee = Vue.ref({ docId: "employee", lastName: "合成" }), calls = [], messages = [], successes = [];
  const source = (await readFile(new URL("../../composables/application/employee/useEmployeeArchive.js", import.meta.url), "utf8")).replace(/import[\s\S]*?;\s*/gu, "").replace("export function", "function");
  const bindings = { ...Vue, ...contract, isEmployeeArchiveUxActorAllowed: contract.archiveActorAllowed, useAuthStore: () => auth, useMessagesStore: () => ({ add: (message) => messages.push(message) }), useNuxtApp: () => ({ $functions: {} }), httpsCallable: (_, name) => { assert.equal(name, "archiveEmployee"); return async (input) => { calls.push(input); return call(input); }; } };
  const make = new Function(...Object.keys(bindings), `${source}; return useEmployeeArchive;`)(...Object.values(bindings));
  const effect = Vue.effectScope(); let editor; effect.run(() => { editor = make(employeeId, employee, (id) => successes.push(id)); });
  return { editor, employeeId, employee, calls, messages, successes, auth, effect };
}
test("archive uses actual User actor and independent reason; cancel sends zero", async () => {
  const state = await setup(); assert.equal(state.editor.canStart.value, true); state.editor.open(); state.editor.setReason("重複"); state.editor.close(); assert.equal(state.calls.length, 0); assert.equal(state.employee.value.lastName, "合成");
  state.auth.user.roles = ["human-resource"]; assert.equal(state.editor.open(), false); state.effect.stop();
});
test("archive unknown survives raw loss and dialog close; explicit confirm sends only original request", async () => {
  let count = 0; const state = await setup(async () => { if (++count === 1) throw Object.assign(new Error(), { code: "functions/unavailable" }); return { data: { success: true, archived: true } }; });
  state.editor.open(); state.editor.setReason(" 重複 "); assert.equal(await state.editor.submit(), false);
  state.employee.value = null; state.editor.setReason("変更不可"); assert.equal(state.editor.reason.value, "重複");
  assert.equal(state.editor.canStart.value, false); assert.equal(state.editor.canConfirm.value, true); assert.equal(state.calls.length, 1);
  assert.equal(state.editor.close(), true); assert.match(state.editor.message.value, /確認できていません/u); assert.equal(state.editor.open(), true);
  assert.equal(await state.editor.submit(), true); assert.deepEqual(state.calls[1], state.calls[0]); assert.equal(state.messages.length, 1); assert.deepEqual(state.successes, ["employee"]);
  assert.equal(state.editor.canConfirm.value, false); state.effect.stop();
});
test("archive busy locks close, reason, and duplicate submission even when raw disappears", async () => {
  let finish; const state = await setup(() => new Promise((resolve) => { finish = resolve; }));
  state.editor.open(); state.editor.setReason("誤登録"); const pending = state.editor.submit(); state.employee.value = null;
  assert.equal(state.editor.close(), false); state.editor.setReason("変更不可"); assert.equal(await state.editor.submit(), false); assert.equal(state.calls.length, 1);
  finish({ data: { success: true, archived: true } }); assert.equal(await pending, true); assert.equal(state.messages.length, 1); state.effect.stop();
});
test("archive definite refusal retains reason; does not claim success from nonexistent original", async () => {
  const state = await setup(async () => { throw Object.assign(new Error(), { code: "functions/failed-precondition" }); });
  state.editor.open(); state.editor.setReason("誤登録"); assert.equal(await state.editor.submit(), false); assert.equal(state.editor.reason.value, "誤登録"); assert.equal(state.editor.uncertain.value, false);
  state.employee.value = null; assert.equal(state.editor.canConfirm.value, false); assert.equal(state.messages.length, 0); assert.equal(await state.editor.submit(), false); assert.equal(state.calls.length, 1); state.effect.stop();
});
for (const change of ["route", "tenant", "actor", "claim", "email", "role", "allowed-role", "admin", "dispose"]) for (const failed of [false, true]) test(`archive ${change} invalidates delayed ${failed ? "error" : "success"} and attempt`, async () => {
  let finish, reject; const state = await setup(() => new Promise((resolve, fail) => { finish = resolve; reject = fail; }));
  state.editor.open(); state.editor.setReason("誤登録"); const pending = state.editor.submit();
  if (change === "route") state.employeeId.value = "other";
  if (change === "tenant") state.auth.companyId = "other";
  if (change === "actor") state.auth.uid = "other";
  if (change === "claim") { state.auth.isSuperUserClaimValid = false; state.auth.isSuperUserClaimValid = true; }
  if (change === "email") { state.auth.isEmailVerified = false; state.auth.isEmailVerified = true; }
  if (change === "role") { state.auth.user.roles = ["human-resource"]; state.auth.user.roles = ["manager"]; }
  if (change === "allowed-role") state.auth.user.roles = ["manager", "human-resource"];
  if (change === "admin") state.auth.user.isAdmin = true;
  if (change === "dispose") state.effect.stop();
  if (failed) reject(Object.assign(new Error(), { code: "functions/unavailable" })); else finish({ data: { success: true, archived: true } });
  assert.equal(await pending, false); assert.equal(state.messages.length, 0); assert.equal(state.successes.length, 0); assert.equal(state.editor.reason.value, ""); assert.equal(state.editor.canConfirm.value, false); state.effect.stop();
});
test("archive dialog stays outside live conditional and offers readonly confirmation; both SFCs compile", async () => {
  for (const path of ["components/Employee/ArchiveDialog.vue", "pages/employees/[id].vue"]) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8"), { descriptor } = parse(source), script = compileScript(descriptor, { id: path });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
    if (path.startsWith("pages")) assert.ok(source.indexOf("<EmployeeArchiveDialog") < source.indexOf('<v-row v-if="doc">'));
    else { assert.match(source, /:readonly="archive.uncertain.value"/u); assert.match(source, /結果を確認/u); }
  }
});
