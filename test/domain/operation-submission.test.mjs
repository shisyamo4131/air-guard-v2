import { operationDateTime } from "../../functions/shared/operationDateTime.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Vue from "vue";
import { SiteOperationSchedule, OperationResult, ArrangementNotification, User } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp } from "firebase/firestore";
import * as contract from "../../functions/shared/operationWriteContract.js";
import * as referenceContract from "../../functions/shared/operationReferences.js";
import * as employeeContract from "../../functions/shared/employeeContract.js";
import { prepareNotificationState, expectedNotificationState, NOTIFICATION_STATE_PATCH } from "../../functions/shared/notificationStateContract.js";
import { operationUxAllowed } from "../../utils/auth/policies/operationActorPolicy.js";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
async function factory(path, name, bindings) { const code = (await source(path)).replace(/import[\s\S]*?;\s*/gu, "").replaceAll("export function", "function"); return new Function(...Object.keys(bindings), `${code}; return ${name};`)(...Object.values(bindings)); }
const flush = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve(); };
function schedule() { const model = new SiteOperationSchedule({ docId: "operation", siteId: "site", dateAt: new Date("2026-09-01"), startTime: "08:00", endTime: "17:00" }); model.addWorker({ id: "employee", isEmployee: true }, -1); return model.toObject(); }
function notification() { const worker = schedule().employees[0]; return { ...new ArrangementNotification(worker).toObject(), docId: `operation_${worker.workerId}`, unknown: { retained: true } }; }

for (const status of ["ARRANGED", "CONFIRMED", "ARRIVED", "LEAVED"]) test(`notification ${status} only owns status fields and retains installed transition semantics`, () => {
  const raw = notification(), now = new Date("2026-09-01T10:00:00Z"), nanos = new Timestamp(1788200000, 123456789);
  raw.arrivedAt = nanos;
  const input = { expected: expectedNotificationState(raw), changes: { targetStatus: status, actualStartTime: "09:00", actualEndTime: "18:00", actualIsStartNextDay: false, actualBreakMinutes: 0, isQualified: false, isOjt: true } };
  const patch = prepareNotificationState(raw, input, now), next = { ...raw, ...patch };
  assert.ok(Object.keys(patch).every((field) => NOTIFICATION_STATE_PATCH.includes(field))); assert.equal(next.status, status); assert.strictEqual(next.unknown, raw.unknown);
  assert.equal(next.actualStartTime, status === "LEAVED" ? "09:00" : "08:00"); assert.equal(next.actualBreakMinutes, status === "LEAVED" ? 0 : 60);
  assert.equal(next.isQualified, false); assert.equal(next.isOjt, true); assert.equal(next.employeeId, raw.employeeId);
  if (status === "LEAVED") { assert.strictEqual(next.arrivedAt, nanos); assert.deepEqual(next.leavedAt, now); }
  if (status === "ARRANGED") assert.equal(next.confirmedAt, null);
  assert.throws(() => prepareNotificationState({ ...raw, actualBreakMinutes: 40 }, input), { code: "aborted" });
  assert.throws(() => prepareNotificationState(raw, { ...input, changes: { ...input.changes, employeeId: "forged" } }), { code: "invalid-argument" });
});

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

test("Generator completes notify(false), rereads raw, waits for a server notification snapshot, and holds notification-only conflicts", async () => {
  const auth = Vue.reactive({ uid: "actor", companyId: "company" }), selected = Vue.ref(new SiteOperationSchedule(schedule()));
  const before = schedule(), after = { ...before, employees: before.employees.map((row) => ({ ...row, hasNotification: true })) }; after.workers = [...after.employees, ...after.outsourcers];
  const calls = [], reads = [], listeners = []; let converted = false, notifyFinish;
  const submission = { allowed: Vue.ref(true), uncertain: Vue.ref(false), busy: Vue.ref(false), message: Vue.ref("conflict"), read: async (collection, id) => { reads.push([collection, id]); return calls.length ? after : before; }, submit: async ([command]) => { calls.push(command); if (command.action === "notify") return new Promise((resolve) => { notifyFinish = resolve; }); converted = true; return false; } };
  const make = await factory("composables/application/operation/useOperationGenerator.js", "useOperationGenerator", { ...Vue, ...contract, ...referenceContract, ...employeeContract, operationDateTime, ArrangementNotification, SiteOperationSchedule, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {} }), useOperationSubmission: () => submission, collection: (_, path) => ({ path }), where: (...args) => args, query: (ref) => ref, onSnapshot: (_, options, next, error) => {
    assert.deepEqual(options, { includeMetadataChanges: true });
    const item = { next, error, stopped: false, emit(snapshot, metadataOnly = false) { if (!metadataOnly || options.includeMetadataChanges) next(snapshot); } };
    listeners.push(item); return () => { item.stopped = true; };
  } });
  const effect = Vue.effectScope(); let generator; effect.run(() => { generator = make(selected); }); await flush();
  assert.equal(calls[0].action, "notify"); assert.equal(calls[0].changes.shouldNotify, false); assert.equal(reads.length, 1); assert.equal(generator.ready.value, false);
  assert.equal(await generator.convert(), false); notifyFinish({ success: true }); await flush();
  assert.equal(reads.length, 2); assert.equal(listeners.length, 1); assert.equal(generator.ready.value, false);
  const rawNotice = { ...notification(), actualStartTime: "09:00", actualBreakMinutes: 0, isQualified: false };
  const noticeDocs = [{ id: rawNotice.docId, data: () => rawNotice }];
  const snapshot = (fromCache, hasPendingWrites) => ({ metadata: { fromCache, hasPendingWrites }, docs: noticeDocs });
  listeners[0].emit(snapshot(true, false)); assert.equal(generator.ready.value, false); assert.equal(generator.notifications.value.length, 0);
  listeners[0].emit(snapshot(false, true), true); assert.equal(generator.ready.value, false); assert.equal(generator.notifications.value.length, 0);
  listeners[0].emit(snapshot(false, false), true);
  assert.equal(generator.ready.value, true); assert.equal(generator.notifications.value[0].actualStartTime, "09:00");
  const published = generator.notifications.value;
  listeners[0].emit(snapshot(false, true), true); assert.strictEqual(generator.notifications.value, published);
  selected.value = null; await flush(); assert.equal(listeners[0].stopped, true); assert.equal(generator.ready.value, false);
  selected.value = new SiteOperationSchedule(after); await flush(); assert.equal(listeners.length, 2);
  listeners[1].emit(snapshot(true, false)); assert.equal(generator.ready.value, false);
  listeners[0].emit(snapshot(false, false), true); assert.equal(generator.ready.value, false); assert.equal(generator.notifications.value.length, 0);
  listeners[1].emit(snapshot(false, false), true); assert.equal(generator.ready.value, true);
  assert.equal(await generator.convert(), false); assert.equal(converted, true); assert.deepEqual(calls[1].notifications[rawNotice.docId], contract.notificationExpectation(rawNotice));
  assert.equal(generator.ready.value, false); assert.equal(generator.error.value, "conflict");
  submission.allowed.value = false; await flush();
  listeners[1].emit(snapshot(false, false), true); assert.equal(generator.notifications.value.length, 0); assert.equal(generator.ready.value, false); assert.equal(listeners[1].stopped, true); effect.stop();
});

async function notificationEditorHarness(options = {}) {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, roles: [] }) });
  const raw = { ...notification(), actualStartTime: "08:00", actualEndTime: "17:00" }, writes = [], reads = [];
  let transactions = 0;
  const make = await factory("composables/application/operation/useNotificationEditor.js", "useNotificationEditor", {
    ...Vue, ArrangementNotification, ...employeeContract, operationDateTime, ...contract, expectedNotificationState, prepareNotificationState,
    useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {} }), doc: (_, path) => ({ path, id: path.split("/").at(-1) }), serverTimestamp: () => new Date(),
    getDocFromServer: async (ref) => { reads.push(ref.id); if (transactions && options.postError) throw Object.assign(new Error(), { code: options.postError }); return { exists: () => true, data: () => raw }; },
    runTransaction: async (_, callback) => {
      transactions++; if (options.error) throw Object.assign(new Error(), { code: options.error });
      const transaction = { get: async (ref) => options.get ? options.get(ref) : ({ exists: () => true, data: () => raw }), update: (ref, patch) => { writes.push([ref.id, patch]); } };
      if (options.retry) { try { await callback(transaction); } catch { return callback(transaction); } }
      return callback(transaction);
    },
  });
  const effect = Vue.effectScope(); let editor; effect.run(() => { editor = make(); });
  return { editor, auth, raw, reads, writes, effect, transactions: () => transactions };
}

test("notification reset while tx.get is pending prevents the old write and its transaction retry in the same scope", async () => {
  let finish;
  const state = await notificationEditorHarness({ retry: true, get: () => new Promise((resolve) => { finish = resolve; }) });
  await state.editor.open(state.raw.docId); state.editor.update({ status: "LEAVED", actualStartTime: "09:00" });
  const saving = state.editor.save(); await flush();
  state.editor.reset(); await state.editor.open("other-notification"); state.editor.update({ actualStartTime: "10:00" });
  finish({ exists: () => true, data: () => state.raw }); assert.equal(await saving, false);
  assert.equal(state.writes.length, 0); assert.equal(state.editor.draft.value.actualStartTime, "10:00");
  assert.deepEqual(state.reads, [state.raw.docId, "other-notification"], "old commit path must not begin a post-commit read"); state.effect.stop();
});

for (const postError of ["permission-denied", "unavailable"]) test(`notification committed save with ${postError} reload reports saved and never resends`, async () => {
  const state = await notificationEditorHarness({ postError });
  await state.editor.open(state.raw.docId); state.editor.update({ status: "LEAVED", actualStartTime: "09:00" });
  assert.equal(await state.editor.save(), true); assert.equal(state.writes.length, 1);
  assert.match(state.editor.message.value, /保存は完了/u); assert.equal(state.editor.conflict.value, false); assert.equal(state.editor.uncertain.value, false);
  assert.equal(state.editor.draft.value, null); assert.equal(await state.editor.save(), false); assert.equal(state.transactions(), 1); state.effect.stop();
});

for (const error of ["permission-denied", "unavailable"]) test(`notification transaction ${error} retains independent draft, prevents blind retry, and clears on authority loss`, async () => {
  const state = await notificationEditorHarness({ error });
  await state.editor.open(state.raw.docId); state.editor.update({ status: "LEAVED", actualStartTime: "09:00" });
  assert.equal(await state.editor.save(), false); assert.equal(state.writes.length, 0); assert.equal(state.editor.draft.value.actualStartTime, "09:00"); assert.equal(state.raw.actualStartTime, "08:00");
  assert.equal(state.editor.uncertain.value, error === "unavailable"); await state.editor.save(); assert.equal(state.transactions(), 1);
  state.auth.isSuperUserClaimValid = false; await flush(); assert.equal(state.editor.draft.value, null); assert.equal(state.editor.baseline.value, null); state.effect.stop();
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

async function personalHarness(options = {}) {
  const state = await notificationEditorHarness(options);
  const definition = Vue.ref({ ARRANGED: { next: { status: "CONFIRMED" } }, CONFIRMED: { next: { status: "ARRIVED" } }, ARRIVED: { next: { status: "LEAVED" } }, LEAVED: { next: null } });
  const make = await factory("composables/application/operation/usePersonalNotification.js", "usePersonalNotification", {
    ...Vue, ...employeeContract, operationDateTime, SiteOperationSchedule, useAuthStore: () => state.auth, useNuxtApp: () => ({ $firestore: {} }), useNotificationEditor: () => state.editor,
    doc: (_, path) => ({ path }), getDocFromServer: options.scheduleRead || (async () => ({ exists: () => true, data: schedule })),
  });
  let personal; state.effect.run(() => { personal = make(definition); });
  return { ...state, personal };
}
for (const status of ["ARRANGED", "CONFIRMED", "ARRIVED"]) test(`personal ${status} retains opening raw through next/save, with nanos and unknown intact`, async () => {
  const state = await personalHarness(); state.raw.status = status; state.raw.createdAt = new Timestamp(1788200000, 123456789);
  const before = employeeContract.encodeExpected(state.raw);
  assert.equal(await state.personal.open(state.raw.docId), true); assert.strictEqual(state.editor.baseline.value, state.raw);
  if (status === "ARRIVED") state.editor.update({ actualStartTime: "09:00", actualEndTime: "18:00", actualBreakMinutes: 0 });
  assert.equal(await state.personal.saveNext(), true);
  const patch = state.writes[0][1], saved = { ...state.raw, ...patch };
  assert.equal(patch.status, { ARRANGED: "CONFIRMED", CONFIRMED: "ARRIVED", ARRIVED: "LEAVED" }[status]);
  assert.equal(Object.hasOwn(patch, "createdAt"), false); assert.equal(Object.hasOwn(patch, "unknown"), false);
  assert.equal(saved.createdAt.nanoseconds, 123456789); assert.deepEqual(employeeContract.encodeExpected(state.raw), before);
  if (status === "ARRIVED") assert.equal(saved.actualBreakMinutes, 0); state.effect.stop();
});
for (const outcome of ["cancel", "missing", "error", "authority", "other"]) test(`personal schedule ${outcome} rejects the old delayed response and draft`, async () => {
  const pending = [];
  const state = await personalHarness({ scheduleRead: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) });
  const opening = state.personal.open(state.raw.docId); for (let index = 0; index < 8 && !pending.length; index++) await flush();
  assert.equal(state.personal.disabled.value, true); assert.equal(await state.personal.saveNext(), false);
  if (outcome === "cancel") state.personal.close();
  if (outcome === "authority") { state.auth.isSuperUserClaimValid = false; await flush(); }
  let other;
  if (outcome === "other") { other = state.personal.open("other"); for (let index = 0; index < 8 && pending.length < 2; index++) await flush(); }
  if (outcome === "error") pending[0].reject(new Error()); else pending[0].resolve({ exists: () => outcome !== "missing", data: schedule });
  assert.equal(await opening, false); assert.equal(state.personal.schedule.value, null); assert.equal(state.writes.length, 0);
  if (outcome === "other") { pending[1].resolve({ exists: () => true, data: schedule }); assert.equal(await other, true); }
  else assert.equal(state.editor.draft.value, null); state.effect.stop();
});
for (const error of ["permission-denied", "unavailable"]) test(`personal ${error} retains leave input without repeating save`, async () => {
  const state = await personalHarness({ error }); state.raw.status = "ARRIVED";
  await state.personal.open(state.raw.docId); state.editor.update({ actualStartTime: "10:00" });
  assert.equal(await state.personal.saveNext(), false); assert.equal(state.editor.draft.value.actualStartTime, "10:00");
  assert.equal(await state.personal.saveNext(), false); assert.equal(state.transactions(), 1); assert.equal(state.raw.actualStartTime, "08:00");
  state.personal.close(); assert.equal(state.editor.draft.value, null); state.effect.stop();
});

test("schedule actions publish the current local model before waiting for Callable completion", async () => {
  const events = []; let finish;
  const submission = { allowed: Vue.ref(true), scope: () => "company/actor", uncertain: Vue.ref(false), message: Vue.ref(""), submit: async () => { events.push("call"); return new Promise((resolve) => { finish = resolve; }); } };
  const make = await factory("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js", "useSiteOperationScheduleActions", {
    ...Vue, operationDateTime, parseDate: employeeContract.parseDate, useOperationSubmission: () => submission, useMessagesStore: () => ({ add() {} }),
    scheduleCommands: (model) => [{ kind: "schedule", action: "overview", documentId: model.docId, changes: { remarks: model.remarks }, expected: {} }], operationRawFor: (model) => model, expectedForOperation: () => ({}),
  });
  const effect = Vue.effectScope(); let actions; effect.run(() => { actions = make({ publishSchedule: (model) => { events.push(`publish:${model.docId}`); return true; }, refreshSchedule: async () => { events.push("refresh"); return true; } }); });
  const saving = actions.updateSchedule({ docId: "schedule", remarks: "now" }); await flush();
  assert.deepEqual(events, ["publish:schedule", "call"]);
  finish({ success: true, updated: true }); assert.equal(await saving, true);
  assert.deepEqual(events, ["publish:schedule", "call"]); effect.stop();
});

test("schedule actions submit rapid ordinary edits independently without locking the UI", async () => {
  const calls = [], finishes = [], published = [];
  const submission = { allowed: Vue.ref(true), busy: Vue.ref(false), scope: () => "company/actor", uncertain: Vue.ref(false), message: Vue.ref(""), submit: async (commands) => { calls.push(commands); return new Promise((resolve) => finishes.push(resolve)); } };
  const make = await factory("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js", "useSiteOperationScheduleActions", {
    ...Vue, operationDateTime, parseDate: employeeContract.parseDate, useOperationSubmission: () => submission, useMessagesStore: () => ({ add() {} }),
    scheduleCommands: (model) => [{ kind: "schedule", action: "overview", documentId: model.docId, changes: { remarks: model.remarks }, expected: {} }], operationRawFor: (model) => model, expectedForOperation: () => ({}),
  });
  const effect = Vue.effectScope(); let actions; effect.run(() => { actions = make({ publishSchedule: (model) => { published.push(model.remarks); return true; } }); });
  const first = actions.updateSchedule({ docId: "schedule", remarks: "first" });
  const second = actions.updateSchedule({ docId: "schedule", remarks: "second" });
  assert.equal(calls.length, 2); assert.deepEqual(published, ["first", "second"]);
  finishes[1]({ success: true, updated: true }); assert.equal(await second, true);
  finishes[0]({ success: true, updated: true }); assert.equal(await first, true);
  effect.stop();
});

test("one schedule refusal refreshes only its document while another local edit remains displayed", async () => {
  const finishes = new Map(), displayed = new Map();
  const submission = { allowed: Vue.ref(true), scope: () => "company/actor", uncertain: Vue.ref(false), message: Vue.ref("refused"), submit: async ([command]) => new Promise((resolve) => finishes.set(command.documentId, resolve)) };
  const make = await factory("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js", "useSiteOperationScheduleActions", {
    ...Vue, operationDateTime, parseDate: employeeContract.parseDate, useOperationSubmission: () => submission, useMessagesStore: () => ({ add() {} }),
    scheduleCommands: (model) => [{ kind: "schedule", action: "overview", documentId: model.docId, changes: { remarks: model.remarks }, expected: {} }], operationRawFor: (model) => ({ ...model, remarks: `server-${model.docId}` }), expectedForOperation: () => ({}),
  });
  const effect = Vue.effectScope(); let actions;
  effect.run(() => { actions = make({
    publishSchedule: (model) => { displayed.set(model.docId, model.remarks); return true; },
    refreshSchedule: async (id) => { displayed.set(id, `server-${id}`); return true; },
  }); });
  const first = actions.updateSchedule({ docId: "a", remarks: "local-a" });
  const second = actions.updateSchedule({ docId: "b", remarks: "local-b" });
  finishes.get("a")(false); assert.equal(await first, false);
  assert.deepEqual(Object.fromEntries(displayed), { a: "server-a", b: "local-b" });
  finishes.get("b")({ success: true, updated: true }); assert.equal(await second, true);
  assert.deepEqual(Object.fromEntries(displayed), { a: "server-a", b: "local-b" });
  effect.stop();
});

test("schedule notify publishes local notification state immediately and the displayed state prevents a duplicate", async () => {
  const events = []; let finish;
  const submission = { allowed: Vue.ref(true), busy: Vue.ref(false), scope: () => "company/actor", uncertain: Vue.ref(false), message: Vue.ref(""), submit: async () => { events.push("call"); return new Promise((resolve) => { finish = resolve; }); } };
  const make = await factory("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js", "useSiteOperationScheduleActions", {
    ...Vue, operationDateTime, parseDate: employeeContract.parseDate, useOperationSubmission: () => submission, useMessagesStore: () => ({ add() {} }),
    scheduleCommands: () => [], operationRawFor: (model) => model, expectedForOperation: () => ({}),
  });
  const model = new SiteOperationSchedule(schedule());
  const effect = Vue.effectScope(); let actions; effect.run(() => { actions = make({ publishNotificationState: (value) => {
    events.push(`publish-notify:${value.docId}`);
    for (const array of ["employees", "outsourcers"]) for (const worker of value[array]) worker.hasNotification = true;
    return true;
  } }); });
  const saving = actions.notify(model); await flush();
  assert.deepEqual(events, [`publish-notify:${model.docId}`, "call"]);
  assert.equal(model.workers.every((worker) => worker.hasNotification), true);
  assert.equal(await actions.notify(model), false);
  assert.deepEqual(events, [`publish-notify:${model.docId}`, "call"]);
  finish({ success: true, updated: true }); assert.equal(await saving, true);
  effect.stop();
});

test("definite notify refusal resets provisional notifications and refreshes the schedule", async () => {
  const events = [], messages = [];
  const submission = { allowed: Vue.ref(true), busy: Vue.ref(false), scope: () => "company/actor", uncertain: Vue.ref(false), message: Vue.ref("refused"), submit: async () => false };
  const make = await factory("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js", "useSiteOperationScheduleActions", {
    ...Vue, operationDateTime, parseDate: employeeContract.parseDate, useOperationSubmission: () => submission, useMessagesStore: () => ({ add: (value) => messages.push(value) }),
    scheduleCommands: () => [], operationRawFor: (model) => model, expectedForOperation: () => ({}),
  });
  const effect = Vue.effectScope(); let actions; effect.run(() => { actions = make({ publishNotificationState: () => { events.push("publish-notify"); return true; }, resetNotifications: (ids) => events.push(`reset-notifications:${ids.join(",")}`), refreshSchedule: async (id) => { events.push(`refresh:${id}`); return true; } }); });
  assert.equal(await actions.notify({ docId: "schedule", workers: [{ workerId: "worker", hasNotification: false }] }), false);
  assert.deepEqual(events, ["publish-notify", "reset-notifications:schedule", "refresh:schedule"]);
  assert.equal(messages.length, 1); effect.stop();
});

test("multi-schedule refusal continues point refresh after one document read throws", async () => {
  const refreshed = [];
  const submission = { allowed: Vue.ref(true), scope: () => "company/actor", uncertain: Vue.ref(false), message: Vue.ref("refused"), submit: async () => false };
  const make = await factory("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js", "useSiteOperationScheduleActions", {
    ...Vue, operationDateTime, parseDate: employeeContract.parseDate, useOperationSubmission: () => submission, useMessagesStore: () => ({ add() {} }),
    scheduleCommands: (model) => [{ kind: "schedule", action: "overview", documentId: model.docId, changes: {}, expected: {} }], operationRawFor: (model) => model, expectedForOperation: () => ({}),
  });
  const effect = Vue.effectScope(); let actions; effect.run(() => { actions = make({
    publishSchedule: () => true,
    refreshSchedule: async (id) => { refreshed.push(id); if (id === "a") throw new Error("read failed"); return true; },
  }); });
  assert.equal(await actions.updateSchedules([{ docId: "a" }, { docId: "b" }], { date: "2026-09-01", siteId: "site", shiftType: "DAY" }), false);
  assert.deepEqual(refreshed, ["a", "b"]);
  effect.stop();
});

for (const outcome of ["success", "refusal", "dispose", "same-scope-refusal", "noop", "authority-success", "authority-refusal", "authority-return-success", "authority-return-refusal"]) test(`schedule ${outcome} keeps one multi-schedule change atomic and suppresses stale messages`, async () => {
  const scope = Vue.ref("company/actor"), calls = [], messages = [], published = [], refreshed = []; let finish;
  const submission = { allowed: Vue.ref(true), scope: () => scope.value, uncertain: Vue.ref(false), message: Vue.ref("refused"), submit: async (commands) => { calls.push(commands); return new Promise((resolve) => { finish = resolve; }); } };
  const make = await factory("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js", "useSiteOperationScheduleActions", {
    ...Vue, operationDateTime, parseDate: employeeContract.parseDate, useOperationSubmission: () => submission, useMessagesStore: () => ({ add: (value) => messages.push(value) }),
    scheduleCommands: (model) => [{ documentId: model.docId }], operationRawFor: (model) => model, expectedForOperation: () => ({}),
  });
  const effect = Vue.effectScope(); let actions; effect.run(() => { actions = make({ publishSchedule: (model) => { published.push(model.docId); return true; }, refreshSchedule: async (id) => { refreshed.push(id); return true; } }); });
  const models = [{ docId: "source" }, { docId: "target" }];
  const first = actions.updateSchedules(models, { date: "2026-09-01", siteId: "site", shiftType: "DAY" }); await flush();
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].map((item) => item.documentId), ["source", "target"]);
  if (["success", "refusal"].includes(outcome)) { scope.value = "other/actor"; scope.value = "company/actor"; }
  if (outcome === "dispose") effect.stop();
  if (outcome.startsWith("authority")) { submission.allowed.value = false; if (outcome.includes("return")) submission.allowed.value = true; }
  finish(outcome.includes("refusal") ? false : { success: true, updated: outcome !== "noop" }); await first;
  assert.deepEqual(published, ["source", "target"]);
  assert.deepEqual(refreshed, outcome === "same-scope-refusal" ? ["source", "target"] : []);
  assert.equal(messages.length, outcome === "same-scope-refusal" ? 1 : 0); effect.stop();
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
