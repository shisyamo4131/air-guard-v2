import { operationDateTime } from "../../functions/shared/operationDateTime.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Vue from "vue";
import { SiteOperationSchedule, OperationResult, ArrangementNotification, User } from "@shisyamo4131/air-guard-v2-schemas";
import * as contract from "../../functions/shared/operationWriteContract.js";
import * as referenceContract from "../../functions/shared/operationReferences.js";
import * as employeeContract from "../../functions/shared/employeeContract.js";
import { operationUxAllowed } from "../../utils/auth/policies/operationActorPolicy.js";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
async function factory(path, name, bindings) { const code = (await source(path)).replace(/import[\s\S]*?;\s*/gu, "").replaceAll("export function", "function"); return new Function(...Object.keys(bindings), `${code}; return ${name};`)(...Object.values(bindings)); }
const flush = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve(); };
function schedule() { const model = new SiteOperationSchedule({ docId: "operation", siteId: "site", dateAt: new Date("2026-09-01"), startTime: "08:00", endTime: "17:00" }); model.addWorker({ id: "employee", isEmployee: true }, -1); return model.toObject(); }
function notification() { const worker = schedule().employees[0]; return { ...new ArrangementNotification(worker).toObject(), docId: `operation_${worker.workerId}`, unknown: { retained: true } }; }

test("submission prompts only the terminated destination and blocks uncertain retry and stale-scope responses", async () => {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, roles: ["controller"] }) });
  const calls = [], prompts = [], records = { operation: { siteId: "old" }, old: { isTemporary: false, status: "TERMINATED" }, target: { isTemporary: false, status: "TERMINATED" } };
  let fail = false, finish;
  const make = await factory("composables/application/operation/useOperationSubmission.js", "useOperationSubmission", { ...Vue, ...contract, operationUxAllowed, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {}, $functions: {} }), doc: (_, path) => ({ id: path.split("/").at(-1) }), getDocFromServer: async (ref) => ({ exists: () => !!records[ref.id], data: () => records[ref.id] }), confirmTerminatedScheduleSite: async (args) => { prompts.push(args.siteId); return true; }, httpsCallable: () => async (input) => { calls.push(input); if (fail) throw Object.assign(new Error(), { code: "functions/unavailable" }); return new Promise((resolve) => { finish = resolve; }); } });
  const effect = Vue.effectScope(); let submission; effect.run(() => { submission = make(); });
  const command = { kind: "schedule", action: "overview", documentId: "operation", changes: { siteId: "target" }, expected: {} };
  const saving = submission.submit([command]); for (let i = 0; i < 8 && !finish; i++) await flush();
  assert.deepEqual(prompts, ["target"]); assert.deepEqual(command.siteStatuses, { old: "TERMINATED", target: "TERMINATED" });
  auth.companyId = "other"; await flush(); finish({ data: { success: true } }); assert.equal(await saving, false);
  auth.companyId = "company"; await flush(); fail = true;
  assert.equal(await submission.submit([{ kind: "schedule", action: "order", documentId: "operation", changes: { displayOrder: 1 }, expected: {} }]), false);
  assert.equal(submission.uncertain.value, true); const count = calls.length; await submission.submit([command]); assert.equal(calls.length, count); effect.stop();
});

test("submission concurrent mode keeps ordinary background calls independent while reporting aggregate busy state", async () => {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, roles: ["controller"] }) });
  const calls = [], pending = [];
  const make = await factory("composables/application/operation/useOperationSubmission.js", "useOperationSubmission", { ...Vue, ...contract, operationUxAllowed, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {}, $functions: {} }), doc: () => ({}), getDocFromServer: async () => ({ exists: () => false }), confirmTerminatedScheduleSite: async () => true, httpsCallable: () => async (input) => { calls.push(input); return new Promise((resolve) => pending.push(resolve)); } });
  const effect = Vue.effectScope(); let submission; effect.run(() => { submission = make({ concurrent: true }); });
  const command = (id) => ({ kind: "schedule", action: "order", documentId: id, changes: { displayOrder: 1 }, expected: {} });
  const first = submission.submit([command("first")]), second = submission.submit([command("second")]);
  await flush(); assert.equal(calls.length, 2); assert.equal(submission.busy.value, true);
  pending[1]({ data: { success: true, updated: true } }); assert.equal((await second).success, true); assert.equal(submission.busy.value, true);
  pending[0]({ data: { success: true, updated: true } }); assert.equal((await first).success, true); assert.equal(submission.busy.value, false);
  effect.stop();
});

test("concurrent unknown result remains monotonic when an older known refusal finishes later", async () => {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, roles: ["controller"] }) });
  const pending = [];
  const make = await factory("composables/application/operation/useOperationSubmission.js", "useOperationSubmission", { ...Vue, ...contract, operationUxAllowed, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {}, $functions: {} }), doc: () => ({}), getDocFromServer: async () => ({ exists: () => false }), confirmTerminatedScheduleSite: async () => true, httpsCallable: () => async () => new Promise((resolve, reject) => pending.push({ resolve, reject })) });
  const effect = Vue.effectScope(); let submission; effect.run(() => { submission = make({ concurrent: true }); });
  const command = (id) => ({ kind: "schedule", action: "order", documentId: id, changes: { displayOrder: 1 }, expected: {} });
  const first = submission.submit([command("first")]), second = submission.submit([command("second")]);
  await flush();
  pending[1].reject(Object.assign(new Error(), { code: "functions/unavailable" }));
  assert.equal(await second, false); assert.equal(submission.uncertain.value, true);
  pending[0].reject(Object.assign(new Error(), { code: "functions/failed-precondition" }));
  assert.equal(await first, false); assert.equal(submission.uncertain.value, true);
  assert.match(submission.message.value, /保存結果を確認できません/u);
  effect.stop();
});

test("a request finishing preflight after another unknown result remains unsent", async () => {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, roles: ["controller"] }) });
  const records = { operation: { siteId: "active" }, active: { isTemporary: false, status: "ACTIVE" }, terminated: { isTemporary: false, status: "TERMINATED" } };
  const calls = [], pending = []; let resumePreflight;
  const snapshot = (value) => ({ exists: () => !!value, data: () => value });
  const make = await factory("composables/application/operation/useOperationSubmission.js", "useOperationSubmission", { ...Vue, ...contract, operationUxAllowed, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {}, $functions: {} }), doc: (_, path) => ({ id: path.split("/").at(-1) }), getDocFromServer: async (ref) => ref.id === "operation" ? new Promise((resolve) => { resumePreflight = () => resolve(snapshot(records[ref.id])); }) : snapshot(records[ref.id]), confirmTerminatedScheduleSite: async () => true, httpsCallable: () => async (input) => { calls.push(input); return new Promise((resolve, reject) => pending.push({ resolve, reject })); } });
  const effect = Vue.effectScope(); let submission; effect.run(() => { submission = make({ concurrent: true }); });
  const waiting = submission.submit([{ kind: "schedule", action: "overview", documentId: "operation", changes: { siteId: "terminated" }, expected: {} }]);
  for (let index = 0; index < 8 && !resumePreflight; index++) await flush();
  const unknown = submission.submit([{ kind: "schedule", action: "order", documentId: "other", changes: { displayOrder: 1 }, expected: {} }]);
  await flush(); assert.equal(calls.length, 1);
  pending[0].reject(Object.assign(new Error(), { code: "functions/unavailable" }));
  assert.equal(await unknown, false); assert.equal(submission.uncertain.value, true);
  resumePreflight();
  assert.equal(await waiting, false);
  assert.equal(calls.length, 1);
  assert.match(submission.message.value, /保存結果を確認できません/u);
  effect.stop();
});

test("concurrent terminated-site operations each require their own confirmation", async () => {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, roles: ["controller"] }) });
  const prompts = [], calls = [];
  const records = { operation: { siteId: "active" }, active: { isTemporary: false, status: "ACTIVE" }, terminated: { isTemporary: false, status: "TERMINATED" } };
  const make = await factory("composables/application/operation/useOperationSubmission.js", "useOperationSubmission", { ...Vue, ...contract, operationUxAllowed, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {}, $functions: {} }), doc: (_, path) => ({ id: path.split("/").at(-1) }), getDocFromServer: async (ref) => ({ exists: () => !!records[ref.id], data: () => records[ref.id] }), confirmTerminatedScheduleSite: async ({ siteId }) => { prompts.push(siteId); return true; }, httpsCallable: () => async (input) => { calls.push(input); return { data: { success: true, updated: true } }; } });
  const effect = Vue.effectScope(); let submission; effect.run(() => { submission = make({ concurrent: true }); });
  const command = () => ({ kind: "schedule", action: "overview", documentId: "operation", changes: { siteId: "terminated" }, expected: {} });
  const results = await Promise.all([submission.submit([command()]), submission.submit([command()])]);
  assert.equal(results.every((result) => result.success), true);
  assert.deepEqual(prompts, ["terminated", "terminated"]);
  assert.equal(calls.length, 2);
  effect.stop();
});

test("a terminated old Site reused as a later destination still requires one confirmation; cancel sends nothing and definite retry retains confirmation", async () => {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, roles: ["controller"] }) });
  const records = { first: { siteId: "a" }, second: { siteId: "c" }, a: { isTemporary: false, status: "TERMINATED" }, b: { isTemporary: false, status: "ACTIVE" }, c: { isTemporary: false, status: "ACTIVE" } };
  let accepted = false, denied = false; const prompts = [], calls = [];
  const make = await factory("composables/application/operation/useOperationSubmission.js", "useOperationSubmission", { ...Vue, ...contract, operationUxAllowed, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {}, $functions: {} }), doc: (_, path) => ({ id: path.split("/").at(-1) }), getDocFromServer: async (ref) => ({ exists: () => !!records[ref.id], data: () => records[ref.id] }), confirmTerminatedScheduleSite: async (args) => { prompts.push(args.siteId); return accepted; }, httpsCallable: () => async (input) => { calls.push(input); if (denied) throw Object.assign(new Error(), { code: "functions/failed-precondition" }); return { data: { success: true } }; } });
  const effect = Vue.effectScope(); let submission; effect.run(() => { submission = make(); });
  const commands = [empCommand("first", "b"), empCommand("second", "a")];
  function empCommand(documentId, siteId) { return { kind: "schedule", action: "overview", documentId, changes: { siteId }, expected: {} }; }
  assert.equal(await submission.submit(commands), false); assert.deepEqual(prompts, ["a"]); assert.equal(calls.length, 0);
  accepted = true; denied = true;
  assert.equal(await submission.submit(commands), false); assert.deepEqual(prompts, ["a", "a"]); assert.equal(calls.length, 1);
  denied = false; assert.equal((await submission.submit(commands)).success, true); assert.equal(prompts.length, 2, "same operation definite retry retains the confirmation");
  await submission.submit(commands); assert.equal(prompts.length, 3, "successful operation ends confirmation lifetime");
  effect.stop();
});

for (const kind of ["schedule", "result"]) test(`${kind} duplicator keeps a raw source expectation and fixed destination IDs; uncertain responses cannot auto-resubmit`, async () => {
  const sourceRaw = kind === "schedule" ? schedule() : new OperationResult({ ...schedule(), isLocked: false }).toObject();
  const calls = []; let nextId = 0;
  const submission = { allowed: Vue.ref(true), uncertain: Vue.ref(false), busy: Vue.ref(false), message: Vue.ref("unknown"), scope: () => "company/actor", read: async () => sourceRaw, submit: async (commands) => { calls.push(commands); submission.uncertain.value = true; return false; } };
  const make = await factory("composables/application/operation/useOperationDuplicator.js", "useOperationDuplicator", { ...Vue, ...contract, ...employeeContract, operationDateTime, SiteOperationSchedule, OperationResult, useOperationSubmission: () => submission, useNuxtApp: () => ({ $firestore: {} }), collection: (_, path) => ({ path }), doc: () => ({ id: `copy-${++nextId}` }) });
  const effect = Vue.effectScope(); let editor; effect.run(() => { editor = make(kind); });
  assert.equal(await editor.set(sourceRaw), true); editor.selectedDates.value = [new Date("2026-09-02")];
  assert.equal(await editor.save(), false); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0].changes, { dateAt: "2026-09-02" }); assert.equal(calls[0][0].sourceId, sourceRaw.docId);
  assert.deepEqual(calls[0][0].expected, contract.expectedForOperation(sourceRaw, calls[0][0]));
  assert.equal(editor.source.value, sourceRaw); assert.equal(editor.selectedDates.value.length, 1);
  await editor.save(); await editor.set(sourceRaw); assert.equal(calls.length, 1); assert.equal(nextId, 1);
  effect.stop(); assert.equal(editor.source.value, null); assert.equal(editor.opened.value, false);
});

test("legacy result duplicate writer cannot invoke Class persistence", async () => {
  const { duplicate } = await import("../../composables/domain/operationResult/duplicate.js");
  await assert.rejects(duplicate({ source: new OperationResult(), dates: [new Date()] }), /専用/u);
  assert.match(await source("components/OperationResult/Duplicator/index.vue"), /v-if="ui.error"/u);
});

async function scheduleActionsHarness({ developer = false } = {}) {
  const loadingEvents = [], errors = [], transaction = { id: "transaction" };
  const Schedule = {
    runTransaction: async (callback) => callback(transaction),
  };
  const make = await factory("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js", "useSiteOperationScheduleActions", {
    dayjs: { tz: (date) => ({ startOf: () => ({ toDate: () => new Date(`${date}T00:00:00.000Z`) }) }) },
    SiteOperationSchedule: Schedule,
    useAuthStore: () => ({ isDeveloper: developer }),
    useLoadingsStore: () => ({ add: (label) => { loadingEvents.push(["add", label]); return "key"; }, remove: (key) => loadingEvents.push(["remove", key]) }),
    useErrorsStore: () => ({}),
    useLogger: () => ({ error: (value) => errors.push(value) }),
  });
  return { actions: make(), errors, loadingEvents, transaction };
}
test("schedule actions call the model directly for update and notify", async () => {
  const events = [];
  const { actions, errors, loadingEvents } = await scheduleActionsHarness();
  const model = {
    update: async () => events.push("update"),
    notify: async () => events.push("notify"),
  };
  await actions.updateSchedule(model);
  await actions.notify(model);
  assert.deepEqual(events, ["update", "notify"]);
  assert.deepEqual(loadingEvents, [["add", "Creating notifications"], ["remove", "key"]]);
  assert.deepEqual(errors, []);
});

test("multi-schedule actions normalize the models and save them in one model transaction", async () => {
  const calls = [];
  const { actions, transaction } = await scheduleActionsHarness();
  const models = [0, 1].map((index) => ({
    docId: `schedule-${index}`,
    update: async (options) => calls.push([index, options]),
  }));
  await actions.updateSchedules(models, {
    date: "2026-09-01",
    siteId: "site",
    shiftType: "DAY",
  });
  assert.deepEqual(calls, [[0, { transaction }], [1, { transaction }]]);
  assert.deepEqual(models.map(({ siteId, shiftType, displayOrder }) => ({ siteId, shiftType, displayOrder })), [
    { siteId: "site", shiftType: "DAY", displayOrder: 0 },
    { siteId: "site", shiftType: "DAY", displayOrder: 1 },
  ]);
  assert.equal(models.every((model) => model.dateAt instanceof Date), true);
});

for (const kind of ["schedule", "result"]) for (const code of ["permission-denied", "unavailable"]) test(`${kind} duplicate holds the whole flight and ends known success after ${code} read failure`, async () => {
  const raw = kind === "schedule" ? schedule() : new OperationResult({ ...schedule(), isLocked: false }).toObject();
  let finish, calls = 0, callbacks = 0, readCalls = 0;
  const submission = { allowed: Vue.ref(true), uncertain: Vue.ref(false), busy: Vue.ref(false), message: Vue.ref(""), scope: () => "company/actor", submit: async () => { calls++; return { success: true }; }, read: async (_, id) => { readCalls++; if (id === raw.docId) return raw; return new Promise((resolve, reject) => { finish = { resolve, reject }; }); } };
  const make = await factory("composables/application/operation/useOperationDuplicator.js", "useOperationDuplicator", { ...Vue, ...contract, ...employeeContract, operationDateTime, SiteOperationSchedule, OperationResult, useOperationSubmission: () => submission, useNuxtApp: () => ({ $firestore: {} }), collection: (_, path) => ({ path }), doc: () => ({ id: "copy" }) });
  const effect = Vue.effectScope(); let editor; effect.run(() => { editor = make(kind, () => { callbacks++; }); });
  await editor.set(raw); editor.selectedDates.value = [new Date("2026-09-02")]; const saving = editor.save(); await flush();
  assert.equal(editor.busy.value, true); assert.equal(editor.disabled.value, true);
  assert.equal(await editor.save(), false); assert.equal(await editor.set(raw), false); editor.close(); assert.equal(editor.opened.value, true); assert.equal(calls, 1); assert.equal(readCalls, 2);
  finish.reject(Object.assign(new Error(), { code })); assert.equal(await saving, true);
  assert.equal(editor.busy.value, false); assert.equal(editor.uncertain.value, false); assert.equal(editor.source.value, null); assert.match(editor.error.value, /保存は完了/u);
  assert.equal(await editor.save(), false); assert.equal(calls, 1); assert.equal(callbacks, 0);
  editor.close(); assert.equal(editor.opened.value, false); assert.equal(await editor.set(raw), true); assert.equal(editor.error.value, ""); effect.stop();
});
for (const kind of ["schedule", "result"]) test(`${kind} duplicate discards an old post-read after scope reset and new set`, async () => {
  const raw = kind === "schedule" ? schedule() : new OperationResult({ ...schedule(), isLocked: false }).toObject();
  const scope = Vue.ref("company/actor"); let finish, callbacks = 0;
  const submission = { allowed: Vue.ref(true), uncertain: Vue.ref(false), busy: Vue.ref(false), message: Vue.ref(""), scope: () => scope.value, submit: async () => ({ success: true }), read: async (_, id) => id === raw.docId ? raw : new Promise((resolve) => { finish = resolve; }) };
  const make = await factory("composables/application/operation/useOperationDuplicator.js", "useOperationDuplicator", { ...Vue, ...contract, ...employeeContract, operationDateTime, SiteOperationSchedule, OperationResult, useOperationSubmission: () => submission, useNuxtApp: () => ({ $firestore: {} }), collection: (_, path) => ({ path }), doc: () => ({ id: "copy" }) });
  const effect = Vue.effectScope(); let editor; effect.run(() => { editor = make(kind, () => { callbacks++; }); });
  await editor.set(raw); editor.selectedDates.value = [new Date("2026-09-02")]; const saving = editor.save(); await flush();
  scope.value = "other/actor"; await flush(); assert.equal(await editor.set(raw), true); editor.selectedDates.value = [new Date("2026-09-03")];
  finish({ ...raw, docId: "copy" }); assert.equal(await saving, false); assert.equal(callbacks, 0); assert.equal(editor.source.value.docId, raw.docId); assert.equal(editor.opened.value, true); assert.equal(editor.error.value, ""); assert.equal(editor.selectedDates.value[0].getDate(), 3); effect.stop();
});
