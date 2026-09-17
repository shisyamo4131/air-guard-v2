import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as Vue from "vue";
import { isEmployeeArchiveUxActorAllowed } from "../../composables/domain/employee/employeeArchiveContract.js";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";

function actorDefaults() {
  return { docId: "actor", companyId: "company", isAdmin: false, disabled: false, isTemporary: false, roles: ["manager"] };
}

async function setup(call = async () => ({ data: { success: true, allowed: true, employeeId: "employee" } })) {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isEmailVerified: true, isSuperUser: false, isSuperUserClaimValid: true, user: { docId: "actor", companyId: "company", isAdmin: false, disabled: false, isTemporary: false, roles: ["manager"] } });
  const employeeId = Vue.ref("employee"), employee = Vue.ref({ docId: "employee", employmentStatus: "ACTIVE" }), calls = [];
  const source = (await readFile(new URL("../../composables/application/employee/useEmployeeArchive.js", import.meta.url), "utf8")).replace(/import[\s\S]*?;\s*/gu, "").replace("export function", "function");
  const bindings = { ...Vue, isEmployeeArchiveUxActorAllowed, archiveIdentifier: (value) => typeof value === "string" && value.length > 0 && !value.includes("/"), useAuthStore: () => auth, useNuxtApp: () => ({ $functions: {} }), httpsCallable: (_, name) => { assert.equal(name, "archiveEmployee"); return async (input) => { calls.push(input); return call(input); }; } };
  const make = new Function(...Object.keys(bindings), `${source}; return useEmployeeArchive;`)(...Object.values(bindings));
  const effect = Vue.effectScope();
  let archive;
  effect.run(() => { archive = make(employeeId, employee); });
  return { archive, employeeId, employee, auth, calls, effect };
}

test("archive UX gate requires verified identity, allowed current actor, and active Employee", async () => {
  const state = await setup();
  assert.equal(state.archive.canStart.value, true);
  state.employee.value.employmentStatus = "RESIGNED";
  assert.equal(state.archive.canStart.value, false);
  state.employee.value.employmentStatus = "ACTIVE";
  for (const roles of [[], ["unknown"], ["manager"], ["human-resource"]]) {
    state.auth.user.roles = roles;
    assert.equal(state.archive.canStart.value, true);
  }
  state.auth.isSuperUser = true;
  state.auth.user.roles = [];
  assert.equal(state.archive.canStart.value, true);
  state.auth.isSuperUser = false;
  state.auth.isEmailVerified = false;
  assert.equal(state.archive.canStart.value, false);
  state.auth.isEmailVerified = true;
  for (const change of [{ disabled: true }, { isTemporary: true }, { companyId: "other-company" }, { docId: "other" }]) {
    state.auth.user = { ...state.auth.user, ...change };
    assert.equal(state.archive.canStart.value, false);
    state.auth.user = { ...state.auth.user, ...actorDefaults() };
  }
  state.effect.stop();
});

test("successful preflight sends exact employeeId and leaves archive write to the Manager", async () => {
  const state = await setup();
  assert.equal(await state.archive.preflight(), true);
  assert.deepEqual(state.calls, [{ employeeId: "employee" }]);
  assert.equal(state.archive.message.value, "");
  state.effect.stop();
});

test("preflight refusal or unknown result sends no second request and exposes a non-success state", async () => {
  const state = await setup(async () => { throw Object.assign(new Error("denied"), { code: "functions/failed-precondition" }); });
  assert.equal(await state.archive.preflight(), false);
  assert.equal(state.calls.length, 1);
  assert.match(state.archive.message.value, /確認/u);
  state.employee.value = null;
  assert.equal(await state.archive.preflight(), false);
  assert.equal(state.calls.length, 1);
  state.effect.stop();
});

test("preflight refusal leaves Manager deletion uncalled, while only a successful delete emits the page completion path", async () => {
  let deletes = 0;
  const preflightAndDelete = async (preflight, toDelete) => { if (await preflight()) toDelete(); };
  await preflightAndDelete(async () => false, () => { deletes += 1; });
  assert.equal(deletes, 0);
  await preflightAndDelete(async () => true, () => { deletes += 1; });
  assert.equal(deletes, 1);
});

test("EmployeeManager real delete handler propagates rejection and emits the page completion only after resolve", async () => {
  const component = await readFile(new URL("../../components/Employee/Manager/index.vue", import.meta.url), "utf8");
  const script = component.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  const factory = new Function(
    "Employee", "defineOptions", "defineProps", "defineEmits", "useBaseManager",
    `${script.replace(/^import[^;]+;\s*/gmu, "")}; return { handleDelete };`,
  );
  const emitted = [];
  const methods = factory(
    class Employee {}, () => {}, () => ({}), (events) => (name) => emitted.push([events, name]), () => ({ attrs: {} }),
  );
  let writes = 0, rejectDelete = true;
  const draft = { docId: "employee", async delete() { writes += 1; if (rejectDelete) throw new Error("blocked"); } };
  const managerDelete = async () => { await methods.handleDelete(draft); emitted.push(["delete", draft.docId]); };
  await assert.rejects(managerDelete(), /blocked/u);
  assert.equal(writes, 1);
  assert.deepEqual(emitted, []);
  rejectDelete = false;
  await managerDelete();
  assert.equal(writes, 2);
  assert.deepEqual(emitted, [["delete", "employee"]]);
});

test("scope change and duplicate preflight invalidate delayed results without stale success", async () => {
  let finish;
  const state = await setup(() => new Promise((resolve) => { finish = resolve; }));
  const pending = state.archive.preflight();
  assert.equal(state.archive.busy.value, true);
  assert.equal(await state.archive.preflight(), false);
  assert.equal(state.calls.length, 1);
  state.auth.companyId = "other-company";
  finish({ data: { success: true, allowed: true, employeeId: "employee" } });
  assert.equal(await pending, false);
  assert.equal(state.archive.message.value, "");
  state.effect.stop();
});

test("Employee detail uses successful preflight before Manager toDelete, and changed SFCs compile", async () => {
  const path = "pages/employees/[id].vue";
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  assert.match(source, /async function preflightAndDelete\(toDelete\)[\s\S]*?if \(await archive\.preflight\(\)\) toDelete\(\)/u);
  assert.match(source, /archive-mode/u);
  assert.doesNotMatch(source, /EmployeeArchiveDialog|reason|operationId|uncertain/u);
  const { descriptor, errors } = parse(source, { filename: path });
  assert.deepEqual(errors, []);
  const script = compileScript(descriptor, { id: path });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
});
