import { operationDateTime } from "../../functions/shared/operationDateTime.js";
import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import * as Vue from "vue";
import { Timestamp } from "firebase/firestore";
import { ArrangementNotification, SiteOperationSchedule, OperationResult, OperationBilling, ArticleDetail, User } from "@shisyamo4131/air-guard-v2-schemas";
import * as contract from "../../functions/shared/operationWriteContract.js";
import * as employeeContract from "../../functions/shared/employeeContract.js";
import { createOperationRawContext, operationRawFor, inheritOperationRaw, operationRowPosition, restoreOperationRaw } from "../../composables/domain/operation/operationRawContext.js";
import { rangeIsRef, rangeIsValid } from "../../composables/validators/rangeValidator.js";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { SITE_SCHEDULE_CONFIRMATION } from "../../utils/siteOperationSchedule/siteScheduleGuard.js";
import { operationUxAllowed } from "../../utils/auth/policies/operationActorPolicy.js";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
async function factory(path, name, bindings) {
  const code = (await source(path)).replace(/import[\s\S]*?;\s*/gu, "").replaceAll("export function", "function");
  return new Function(...Object.keys(bindings), `${code}; return ${name};`)(...Object.values(bindings));
}
const flush = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve(); };
function operation() {
  const model = new SiteOperationSchedule({ docId: "operation", siteId: "site", dateAt: new Date("2026-09-01"), startTime: "08:00", endTime: "17:00" });
  model.addWorker({ id: "first", isEmployee: true }, -1); model.addWorker({ id: "second", isEmployee: true }, -1);
  return model.toObject();
}

test("raw context preserves full precision and original row positions across card and draggable copies without persisting metadata", () => {
  const context = createOperationRawContext(), ticket = context.reset("company/actor");
  const raw = operation(); raw.employees[0].updatedAt = new Timestamp(1788200000, 123456789);
  const displayed = Vue.reactive(new SiteOperationSchedule(employeeContract.rawForClass(raw)));
  assert.equal(context.remember(displayed, raw, ticket), true);
  const card = Vue.reactive(new SiteOperationSchedule(displayed)); inheritOperationRaw(displayed, card);
  const drag = Vue.reactive(new SiteOperationSchedule(card)); inheritOperationRaw(card, drag);
  const second = drag.employees[1]; drag.employees.reverse();
  assert.deepEqual(operationRowPosition(displayed, second, "company/actor"), { array: "employees", position: 1 });
  assert.strictEqual(operationRawFor(drag, "company/actor"), raw);
  assert.equal(operationRawFor(drag, "company/actor").employees[0].updatedAt.nanoseconds, 123456789);
  assert.equal(Object.keys(drag.toObject()).some((key) => /context|generation|position/i.test(key)), false);
  context.reset("other/actor");
  for (const model of [displayed, card, drag]) assert.throws(() => operationRawFor(model, "company/actor"));
  assert.equal(context.remember(displayed, raw, ticket), false);
  assert.equal(restoreOperationRaw(card, drag), false);
});

test("actual Card/Draggable handlers retain original positions, immediately display edits and accept fresh canonical props", async () => {
  const scope = "company/actor";
  const base = { Vue, SiteOperationSchedule, inheritOperationRaw };
  const makeCard = await factory("components/SiteOperationSchedule/Card/useIndex.js", "useIndex", base);
  const makeDrag = await factory("components/Draggable/Workers/useIndex.js", "useIndex", { ...base, useBaseManager: () => ({ logger: { info() {}, error(error) { throw error; } }, isDev: false }), useTimedSet: () => ({ add() {}, has: () => false }), createDraggableFallbackOptions: () => ({}) });
  const makeCommands = await factory("composables/domain/operation/scheduleCommands.js", "scheduleCommands", { ...contract, ...employeeContract, operationDateTime, operationEmployeeReferences: (await import("../../functions/shared/operationReferences.js")).operationEmployeeReferences, operationRawFor, operationRowPosition });
  const raw = operation(), context = createOperationRawContext(); context.reset(scope);
  const source = Vue.reactive(new SiteOperationSchedule(raw)); context.remember(source, raw);
  const props = Vue.reactive({ schedule: source, disabled: false, isDraggable: true, showActions: true });
  const effect = Vue.effectScope(); let card, drag, emitted;
  effect.run(() => {
    card = makeCard(props, (_, value) => { emitted = value; });
    const dragProps = Vue.reactive({ get modelValue() { return card.defaultSlotProps.value.modelValue; }, disabled: false });
    drag = makeDrag(dragProps, (_, value) => card.defaultSlotProps.value["onUpdate:modelValue"](value));
  });
  drag.attrs.value.onChange({ moved: { oldIndex: 1, newIndex: 0, element: { isEmployee: true } } });
  assert.deepEqual(card.defaultSlotProps.value.modelValue.employeeIds, ["second", "first"]);
  const moved = makeCommands(emitted, scope);
  assert.deepEqual(moved.map(({ action, rowAction, position, destination }) => ({ action, rowAction, position, destination })), [{ action: "workers", rowAction: "move", position: 1, destination: 0 }]);
  const fresh = { ...raw, remarks: "fresh" }, freshModel = Vue.reactive(new SiteOperationSchedule(fresh)); context.remember(freshModel, fresh);
  props.schedule = freshModel; await flush();
  assert.deepEqual(card.defaultSlotProps.value.modelValue.employeeIds, ["first", "second"]);
  assert.deepEqual(drag.attrs.value.modelValue.map((worker) => worker.id), ["first", "second"]);
  assert.equal(drag.attrs.value.disabled, false);
  assert.deepEqual(operationRowPosition(freshModel, drag.attrs.value.modelValue[0], scope), { array: "employees", position: 0 });
  drag.attrs.value.onChange({ added: { newIndex: 1, element: { id: "third", isEmployee: true } } });
  assert.deepEqual(makeCommands(emitted, scope).map(({ rowAction, position, changes }) => ({ rowAction, position, id: changes.id })), [{ rowAction: "add", position: 1, id: "third" }]);
  context.clear(); assert.throws(() => makeCommands(emitted, scope)); assert.equal(restoreOperationRaw(source, emitted), false);
  effect.stop();
});

test("empty editable DraggableWorkers keeps a drop target without changing disabled empty layout", async () => {
  const code = await source("components/Draggable/Workers/index.vue");
  assert.match(code, /!attrs\.value\.disabled\s*&&\s*attrs\.value\.modelValue\.length\s*===\s*0/u);
  assert.doesNotMatch(code, /!props\.disabled\s*&&\s*props\.modelValue\.workers\.length/u);
  assert.match(code, /'draggable-workers--empty-drop-target':\s*hasEmptyDropTarget/u);
  assert.match(code, /\.draggable-workers--empty-drop-target\s*\{\s*min-height:\s*48px;/u);
  const { descriptor, errors } = parse(code, { filename: "components/Draggable/Workers/index.vue" });
  assert.deepEqual(errors, []);
  const compiled = compileScript(descriptor, { id: "draggable-workers" });
  const template = compileTemplate({ source: descriptor.template.content, filename: "components/Draggable/Workers/index.vue", id: "draggable-workers", compilerOptions: { bindingMetadata: compiled.bindings } });
  assert.deepEqual(template.errors, []);
});

test("period listener publishes metadata-only server confirmation on reentry while rejecting cache, pending writes and stale scope", async () => {
  const listeners = [], related = [];
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUserClaimValid: true, user: { docId: "actor", companyId: "company", disabled: false, isTemporary: false } });
  const make = await factory("composables/dataLayers/siteOperationSchedule/useSiteOperationSchedulesInRange.js", "useSiteOperationSchedulesInRange", {
    ...Vue, SiteOperationSchedule, rawForClass: employeeContract.rawForClass, createOperationRawContext, rangeIsRef, rangeIsValid,
    useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {} }),
    useFetch: () => ({ fetchSiteComposable: { fetchSite: (id) => related.push(id) }, fetchEmployeeComposable: { fetchEmployee() {} }, fetchOutsourcerComposable: { fetchOutsourcer() {} } }),
    collection: (_, path) => ({ path }), where: (...args) => args, query: (ref, ...constraints) => ({ ...ref, constraints }),
    onSnapshot: (request, options, next) => {
      assert.deepEqual(options, { includeMetadataChanges: true });
      const entry = { request, stopped: false, emit(snapshot, metadataOnly = false) { if (!metadataOnly || options.includeMetadataChanges) next(snapshot); } };
      listeners.push(entry); return () => { entry.stopped = true; };
    },
  });
  const from = Vue.ref(new Date("2026-09-01")), to = Vue.ref(new Date("2026-09-30"));
  const raw = operation(); raw.updatedAt = new Timestamp(1788200000, 123456789);
  const documents = [{ data: () => raw }];
  const snapshot = (fromCache, hasPendingWrites) => ({ metadata: { fromCache, hasPendingWrites }, docs: documents });
  const enter = () => { const effect = Vue.effectScope(); let reader; effect.run(() => { reader = make({ from, to }); }); return { effect, reader }; };
  const first = enter();
  listeners[0].emit(snapshot(true, false));
  assert.equal(first.reader.docs.value.length, 0); assert.equal(related.length, 0);
  listeners[0].emit(snapshot(false, true), true);
  assert.equal(first.reader.docs.value.length, 0); assert.equal(related.length, 0);
  listeners[0].emit(snapshot(false, false), true);
  const displayed = first.reader.docs.value[0];
  assert.ok(displayed instanceof SiteOperationSchedule); assert.strictEqual(operationRawFor(displayed, "company/actor"), raw);
  assert.equal(operationRawFor(displayed, "company/actor").updatedAt.nanoseconds, 123456789);
  assert.equal(related.length, 1);
  first.effect.stop(); assert.equal(listeners[0].stopped, true); assert.equal(first.reader.docs.value.length, 0);
  assert.throws(() => operationRawFor(displayed, "company/actor"));
  const second = enter(); assert.deepEqual(listeners[1].request, listeners[0].request);
  listeners[1].emit(snapshot(true, false)); assert.equal(second.reader.docs.value.length, 0);
  listeners[0].emit(snapshot(false, false), true); assert.equal(first.reader.docs.value.length, 0); assert.equal(second.reader.docs.value.length, 0);
  listeners[1].emit(snapshot(false, false), true); assert.equal(second.reader.docs.value.length, 1); assert.equal(related.length, 2);
  const confirmed = second.reader.docs.value[0];
  listeners[1].emit(snapshot(false, true), true); assert.strictEqual(second.reader.docs.value[0], confirmed); assert.equal(related.length, 2);
  auth.isSuperUserClaimValid = false; await flush();
  assert.equal(listeners[1].stopped, true); assert.equal(second.reader.docs.value.length, 0); assert.throws(() => operationRawFor(confirmed, "company/actor"));
  listeners[1].emit(snapshot(false, false), true); assert.equal(second.reader.docs.value.length, 0); assert.equal(related.length, 2);
  second.effect.stop();
});

test("period listener pairs each fresh Class with its raw, rejects old range/tenant responses, and disposes reads", async () => {
  const listeners = []; let pointSnapshot;
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUserClaimValid: true, user: { docId: "actor", companyId: "company", disabled: false, isTemporary: false } });
  const make = await factory("composables/dataLayers/siteOperationSchedule/useSiteOperationSchedulesInRange.js", "useSiteOperationSchedulesInRange", {
    ...Vue, SiteOperationSchedule, rawForClass: employeeContract.rawForClass, createOperationRawContext, rangeIsRef, rangeIsValid,
    useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {} }),
    useFetch: () => ({ fetchSiteComposable: { fetchSite() {} }, fetchEmployeeComposable: { fetchEmployee() {} }, fetchOutsourcerComposable: { fetchOutsourcer() {} } }),
    doc: (_, path) => ({ path }), getDocFromServer: async () => pointSnapshot,
    collection: (_, path) => ({ path }), where: (...args) => args, query: (ref, ...constraints) => ({ ...ref, constraints }),
    onSnapshot: (ref, options, next, error) => { const entry = { ref, options, next, error, stopped: false }; listeners.push(entry); return () => { entry.stopped = true; }; },
  });
  const from = Vue.ref(new Date("2026-09-01")), to = Vue.ref(new Date("2026-09-30")), effect = Vue.effectScope();
  let reader; effect.run(() => { reader = make({ from, to }); });
  const snapshot = (raw) => ({ metadata: { fromCache: false }, docs: [{ data: () => raw }] });
  const firstRaw = operation(); listeners[0].next(snapshot(firstRaw));
  const firstModel = reader.docs.value[0]; assert.ok(firstModel instanceof SiteOperationSchedule);
  const updated = { ...firstRaw, remarks: "updated" }; listeners[0].next(snapshot(updated));
  assert.notStrictEqual(reader.docs.value[0], firstModel);
  assert.strictEqual(operationRawFor(firstModel, "company/actor"), firstRaw);
  assert.strictEqual(operationRawFor(reader.docs.value[0], "company/actor"), updated);
  const pointRaw = { ...updated, remarks: "point refresh" };
  pointSnapshot = { exists: () => true, data: () => pointRaw };
  const point = await reader.refresh(firstRaw.docId);
  assert.equal(point.exists, true); assert.equal(point.value.remarks, "point refresh");
  assert.equal(reader.docs.value[0].remarks, "updated");
  from.value = new Date("2026-09-02"); await flush();
  assert.equal(listeners[0].stopped, true); assert.equal(reader.docs.value.length, 0);
  listeners[0].next(snapshot(firstRaw)); assert.equal(reader.docs.value.length, 0);
  assert.throws(() => operationRawFor(firstModel, "company/actor"));
  auth.companyId = "other"; auth.user.companyId = "other"; await flush();
  listeners[1].next(snapshot(firstRaw)); assert.equal(reader.docs.value.length, 0);
  effect.stop(); assert.ok(listeners.every((entry) => entry.stopped));
});

test("arrangement point refresh preserves another schedule's local edit and notification reset is target-only", async () => {
  const chain = (value) => {
    let date = new Date(value);
    const api = {
      tz: () => api,
      subtract: (amount) => { date = new Date(date.getTime() - amount * 86400000); return api; },
      add: (amount) => { date = new Date(date.getTime() + amount * 86400000); return api; },
      toDate: () => new Date(date),
      format: () => date.toISOString().slice(0, 10),
    };
    return api;
  };
  const dayjs = Object.assign((value) => chain(value), { tz: (value) => chain(value) });
  const rawA = operation(); rawA.docId = "a";
  const rawB = operation(); rawB.docId = "b"; rawB.displayOrder = 1;
  for (const raw of [rawA, rawB]) {
    raw.employees = raw.employees.map((worker) => ({ ...worker, hasNotification: false }));
    raw.workers = [...raw.employees, ...raw.outsourcers];
  }
  const canonicalSchedules = Vue.shallowRef([
    Vue.reactive(new SiteOperationSchedule(employeeContract.rawForClass(rawA))),
    Vue.reactive(new SiteOperationSchedule(employeeContract.rawForClass(rawB))),
  ]);
  const notification = (raw, worker, shouldNotify = false) => Vue.reactive(new ArrangementNotification({
    ...employeeContract.rawForClass(worker),
    docId: `${raw.docId}_${worker.workerId}`,
    siteOperationScheduleId: raw.docId,
    actualStartTime: worker.startTime,
    actualEndTime: worker.endTime,
    actualBreakMinutes: worker.breakMinutes,
    actualIsStartNextDay: worker.isStartNextDay,
    shouldNotify,
  }));
  const canonicalNotifications = Vue.shallowRef([
    notification(rawA, rawA.employees[0]),
    notification(rawB, rawB.employees[0]),
  ]);
  const serverA = { ...rawA, remarks: "server-a" };
  const make = await factory("composables/dataLayers/arrangement/useArrangementsInRange.js", "useArrangementsInRange", {
    Vue, dayjs, ArrangementNotification, SiteOperationSchedule,
    useEmployeesInRange: () => ({ docs: Vue.ref([]) }), useOutsourcersInRange: () => ({ docs: Vue.ref([]) }),
    useSiteOperationSchedulesInRange: () => ({ docs: canonicalSchedules, refresh: async (id) => ({ exists: true, value: Vue.reactive(new SiteOperationSchedule(employeeContract.rawForClass(id === "a" ? serverA : rawB))) }) }),
    useArrangementNotificationsInRange: () => ({ docs: canonicalNotifications }),
    useSiteShiftTypeOrderEnriched: () => ({ siteShiftTypeOrder: Vue.ref([]) }), ORDER_TYPE: { ARRANGEMENT: "arrangement" },
    rangeIsRef: () => {}, useSecurityReportIndexesInRange: () => ({ docs: Vue.ref([]) }),
    inheritOperationRaw: () => false, applyOperationProjection: (raw) => raw,
    WORKER_PARENT_FIELDS: contract.WORKER_PARENT_FIELDS, operationDateTime,
    equal: employeeContract.equal, parseDate: employeeContract.parseDate, rawForClass: employeeContract.rawForClass,
  });
  const effect = Vue.effectScope(); let arrangements;
  effect.run(() => { arrangements = make({ from: Vue.ref(new Date("2026-09-01")), to: Vue.ref(new Date("2026-09-30")) }); });
  const parentChangedA = new SiteOperationSchedule(employeeContract.rawForClass(rawA)); parentChangedA.startTime = "09:00";
  assert.equal(arrangements.publishSchedule(parentChangedA, rawA), true);
  assert.equal(arrangements.getNotification({ siteOperationScheduleId: "a", workerId: rawA.employees[0].workerId }), null);
  assert.ok(arrangements.getNotification({ siteOperationScheduleId: "b", workerId: rawB.employees[0].workerId }));

  canonicalNotifications.value = [
    notification(rawA, rawA.employees[0]), notification(rawA, rawA.employees[1]),
    notification(rawB, rawB.employees[0]),
  ];
  await flush();
  const workerChangedA = new SiteOperationSchedule(employeeContract.rawForClass(rawA)); workerChangedA.employees[0].startTime = "09:30";
  assert.equal(arrangements.publishSchedule(workerChangedA, rawA), true);
  assert.equal(arrangements.getNotification({ siteOperationScheduleId: "a", workerId: rawA.employees[0].workerId }), null);
  assert.ok(arrangements.getNotification({ siteOperationScheduleId: "a", workerId: rawA.employees[1].workerId }));
  assert.ok(arrangements.getNotification({ siteOperationScheduleId: "b", workerId: rawB.employees[0].workerId }));

  const localB = new SiteOperationSchedule(employeeContract.rawForClass(rawB)); localB.remarks = "local-b";
  assert.equal(arrangements.publishSchedule(localB, rawB), true);
  const localA = new SiteOperationSchedule(employeeContract.rawForClass(rawA)); localA.remarks = "local-a";
  assert.equal(arrangements.publishSchedule(localA, rawA), true);
  await arrangements.refreshSchedule("a");
  assert.equal(arrangements.getSchedule("a").remarks, "server-a");
  assert.equal(arrangements.getSchedule("b").remarks, "local-b");

  const notifyA = new SiteOperationSchedule(employeeContract.rawForClass(rawA));
  const notifyB = new SiteOperationSchedule(employeeContract.rawForClass(rawB));
  const notifyContext = createOperationRawContext(); notifyContext.reset("company/actor"); notifyContext.remember(notifyA, rawA);
  assert.equal(arrangements.publishNotificationState(notifyA), true);
  assert.equal(notifyA.workers.every((worker) => worker.hasNotification), true);
  assert.strictEqual(operationRawFor(notifyA, "company/actor"), rawA);
  assert.deepEqual(operationRowPosition(notifyA, notifyA.employees[0], "company/actor"), { array: "employees", position: 0 });
  assert.equal(arrangements.publishNotificationState(notifyB), true);
  assert.equal(arrangements.getNotification({ siteOperationScheduleId: "a", workerId: rawA.employees[0].workerId }).shouldNotify, true);
  assert.equal(arrangements.getNotification({ siteOperationScheduleId: "b", workerId: rawB.employees[0].workerId }).shouldNotify, true);
  arrangements.resetNotifications(["a"]);
  assert.equal(arrangements.getNotification({ siteOperationScheduleId: "a", workerId: rawA.employees[0].workerId }).shouldNotify, false);
  assert.equal(arrangements.getNotification({ siteOperationScheduleId: "b", workerId: rawB.employees[0].workerId }).shouldNotify, true);
  effect.stop();
});

test("arrangement local schedule changes cancel only the same notification scope", async () => {
  const code = await source("composables/dataLayers/arrangement/useArrangementsInRange.js");
  assert.match(code, /WORKER_PARENT_FIELDS\.some/u);
  assert.match(code, /item\.siteOperationScheduleId\s*!==\s*documentId/u);
  assert.match(code, /affected\.has\(item\.workerId\)/u);
  assert.match(code, /hasNotification:\s*false/u);
  assert.doesNotMatch(code, /pending|revision|predecessor|token/iu);
});

async function editorHarness(options = {}) {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, disabled: false, roles: ["controller"] }) });
  const raw = operation(), calls = [];
  const make = await factory("composables/application/operation/useOperationEditor.js", "useOperationEditor", {
    ...Vue, ...contract, ...employeeContract, operationDateTime, operationUxAllowed, SiteOperationSchedule, OperationResult, OperationBilling, ArticleDetail,
    useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {}, $functions: {} }),
    collection: (_, path) => ({ path }), doc: (_, path) => ({ path: path || "new-operation", id: path?.split("/").at(-1) || "new-operation" }),
    getDocFromServer: async (ref) => options.read ? options.read(ref, raw) : ({ exists: () => true, data: () => raw }),
    httpsCallable: () => async (request) => { calls.push(request); if (options.call) return options.call(request); if (options.error) throw Object.assign(new Error(), { code: options.error }); return { data: { success: true } }; },
    confirmTerminatedScheduleSite: options.confirm || (async () => true), SITE_SCHEDULE_CONFIRMATION,
  });
  const effect = Vue.effectScope(); let editor; effect.run(() => { editor = make({ kind: "schedule", ...options.editor }); });
  return { editor, auth, raw, calls, effect };
}

test("ArrayManager no-argument CREATE provides an independent preset to the actual Site callback and cancel writes nothing", async () => {
  const state = await editorHarness();
  const { descriptor } = parse(await source("components/Operation/ArrayManager.vue"));
  const script = descriptor.scriptSetup.content.replace(/import[\s\S]*?;\s*/gu, "");
  const callbacks = [], props = { kind: "schedule", docs: [], beforeEdit: (editMode, item) => { callbacks.push([editMode, item]); item.siteId = "site-from-page"; }, tableProps: {} };
  const bindings = { ...Vue, rawForClass: employeeContract.rawForClass, defineOptions() {}, defineProps: () => props, defineEmits: () => () => {}, defineExpose() {}, useOperationEditor: () => state.editor };
  const manager = new Function(...Object.keys(bindings), `${script}; return { toCreate };`)(...Object.values(bindings));
  await manager.toCreate(); assert.equal(callbacks[0][0], "CREATE"); assert.equal(state.editor.draft.value.siteId, "site-from-page");
  assert.equal(state.editor.request().changes.siteId, "site-from-page");
  state.editor.close(); assert.equal(state.calls.length, 0);
  const supplied = { siteId: "untouched", nested: { kept: true } }; await manager.toCreate(supplied);
  assert.equal(supplied.siteId, "untouched"); assert.notStrictEqual(callbacks[1][1], supplied);
  state.editor.close(); assert.equal(state.calls.length, 0); state.effect.stop();
});

test("editor uses independent draft and raw expectations; cancel never mutates displayed data", async () => {
  const state = await editorHarness(); assert.equal(state.editor.canWrite.value, true, "a displayed User Class is converted only for UI role policy");
  await state.editor.open("UPDATE", "operation");
  state.editor.update({ remarks: "draft" });
  assert.equal(state.raw.remarks, null);
  const request = state.editor.request();
  assert.deepEqual(request.changes, { remarks: "draft" });
  assert.deepEqual(request.expected, contract.expectedForOperation(state.raw, request));
  state.editor.close(); assert.equal(state.calls.length, 0); assert.equal(state.raw.remarks, null);
  state.effect.stop();
});

test("dedicated operation editor keeps its opt-in UPDATE delete behavior", async () => {
  const events = [];
  const optimistic = {
    publish: ({ command }) => { events.push(["publish", command.action]); return true; },
    currentSchedule: () => null,
  };
  const state = await editorHarness({ editor: { allowDeleteFromUpdate: true, optimistic } });
  await state.editor.open("UPDATE", "operation");
  assert.equal(state.editor.canDeleteFromUpdate.value, true);
  assert.equal(state.editor.deleteRequested.value, false);
  assert.equal(state.editor.request().action, "overview", "unchecked UPDATE keeps the normal update contract");
  state.editor.setInputPending(true);
  assert.equal(state.editor.saveDisabled.value, true);
  state.editor.setDeleteRequested(true);
  assert.equal(state.editor.saveDisabled.value, false, "input validation cannot block an opted-in delete");
  assert.deepEqual(state.editor.request().action, "delete");
  assert.deepEqual(state.editor.request().changes, {});
  assert.equal(await state.editor.save(), true);
  assert.deepEqual(events, [["publish", "delete"]]);
  assert.equal(state.calls[0].operations[0].action, "delete");

  await state.editor.open("UPDATE", "operation");
  assert.equal(state.editor.deleteRequested.value, false, "open clears the prior selection");
  state.editor.setDeleteRequested(true);
  await state.editor.reload();
  assert.equal(state.editor.deleteRequested.value, false, "reload clears the prior selection");
  state.editor.close();
  assert.equal(state.editor.deleteRequested.value, false, "close clears the prior selection");
  await state.editor.open("DELETE", "operation");
  assert.equal(state.editor.canDeleteFromUpdate.value, false);
  assert.equal(state.editor.action, "delete");
  state.effect.stop();

  for (const editor of [
    { kind: "schedule" },
    { kind: "schedule", allowDeleteFromUpdate: true, defaultAction: "workers" },
    { kind: "result", allowDeleteFromUpdate: true },
    { kind: "billing", allowDeleteFromUpdate: true },
  ]) {
    const isolated = await editorHarness({ editor });
    await isolated.editor.open("UPDATE", "operation");
    assert.equal(isolated.editor.canDeleteFromUpdate.value, false);
    isolated.effect.stop();
  }

  assert.doesNotMatch(await source("components/Operation/Manager.vue"), /allowDeleteFromUpdate:\s*\{[^}]*default:\s*true/u);
  assert.match(await source("components/Operation/Editor.vue"), /label="このデータを削除する"/u);
});

test("authoritative converted raw disables UPDATE delete even when a passed item looks editable", async () => {
  const state = await editorHarness({
    editor: { allowDeleteFromUpdate: true },
    read: async (_, raw) => ({ exists: () => true, data: () => ({ ...raw, operationResultId: "result" }) }),
  });
  const passedItem = { docId: "operation", operationResultId: null };
  assert.equal(await state.editor.open("UPDATE", passedItem), true);
  assert.equal(state.editor.draft.value.operationResultId, "result");
  assert.equal(state.editor.canDeleteFromUpdate.value, false);
  state.editor.setDeleteRequested(true);
  assert.equal(state.editor.deleteRequested.value, false);
  state.effect.stop();
});

for (const outcome of ["failed-precondition", "deadline-exceeded"]) test(`checked UPDATE delete ${outcome} refreshes once and retains the draft without blind retry`, async () => {
  let rejectCall;
  const events = [];
  const optimistic = {
    publish: ({ command }) => { events.push(["publish", command.action]); return true; },
    refresh: async (ids) => events.push(["refresh", ids]),
    currentSchedule: () => null,
  };
  const state = await editorHarness({
    editor: { allowDeleteFromUpdate: true, optimistic },
    call: () => new Promise((_, reject) => { rejectCall = reject; }),
  });
  await state.editor.open("UPDATE", "operation");
  state.editor.setDeleteRequested(true);
  const saving = state.editor.save();
  await flush();
  assert.equal(state.editor.busy.value, true);
  assert.equal(await state.editor.save(), false, "busy state suppresses a duplicate Callable");
  assert.equal(state.calls.length, 1);
  rejectCall(Object.assign(new Error(), { code: `functions/${outcome}` }));
  assert.equal(await saving, false);
  assert.equal(state.editor.draft.value.docId, "operation");
  assert.equal(state.editor.deleteRequested.value, true);
  assert.deepEqual(events, [["publish", "delete"], ["refresh", ["operation"]]]);
  assert.equal(state.editor.uncertain.value, outcome === "deadline-exceeded");
  if (outcome === "deadline-exceeded") {
    const calls = state.calls.length;
    assert.equal(await state.editor.save(), false);
    assert.equal(state.calls.length, calls, "an uncertain result cannot be resubmitted");
  }
  state.effect.stop();
});

test("arrangement editor publishes local state before Callable and closes without waiting for a post-read", async () => {
  const events = []; let finish;
  const optimistic = {
    publish: ({ command }) => { events.push(["publish", command.changes.remarks]); return true; },
    refresh: async () => events.push(["refresh"]),
    currentSchedule: () => ({ docId: "operation", remarks: "optimistic" }),
  };
  let reads = 0, saved = null;
  const state = await editorHarness({
    editor: { optimistic, onSaved: (item) => { saved = item; } },
    read: async (_, raw) => { reads++; return { exists: () => true, data: () => raw }; },
    call: async () => { events.push(["call"]); return new Promise((resolve) => { finish = resolve; }); },
  });
  await state.editor.open("UPDATE", "operation"); state.editor.update({ remarks: "optimistic" });
  const saving = state.editor.save(); await flush();
  assert.deepEqual(events, [["publish", "optimistic"], ["call"]]);
  finish({ data: { success: true, updated: true } }); assert.equal(await saving, true);
  assert.deepEqual(events, [["publish", "optimistic"], ["call"]]);
  assert.equal(reads, 1, "only the edit-open read runs; success does not block on another read");
  assert.equal(saved.remarks, "optimistic"); assert.equal(state.editor.opened.value, false); state.effect.stop();
});

test("arrangement editor refreshes local state after a definite Callable refusal", async () => {
  const events = [];
  const optimistic = {
    publish: () => { events.push("publish"); return true; },
    refresh: async ([id]) => events.push(`refresh:${id}`),
    currentSchedule: () => null,
  };
  const state = await editorHarness({
    editor: { optimistic },
    error: "functions/failed-precondition",
  });
  await state.editor.open("UPDATE", "operation"); state.editor.update({ remarks: "optimistic" });
  assert.equal(await state.editor.save(), false);
  assert.deepEqual(events, ["publish", "refresh:operation"]);
  assert.equal(state.editor.draft.value.remarks, "optimistic"); state.effect.stop();
});

for (const error of ["functions/aborted", "functions/unavailable"]) test(`editor ${error} retains draft and prevents blind resubmission`, async () => {
  const state = await editorHarness({ error });
  await state.editor.open("UPDATE", "operation"); state.editor.update({ remarks: "draft" });
  assert.equal(await state.editor.save(), false); assert.equal(state.editor.draft.value.remarks, "draft");
  assert.equal(state.editor.disabled.value, true);
  await state.editor.save(); assert.equal(state.calls.length, 1);
  state.auth.companyId = "other"; await flush(); assert.equal(state.editor.draft.value, null); assert.equal(state.editor.opened.value, false);
  state.effect.stop();
});

test("row reload closes stale selection instead of applying old raw position to a different row", async () => {
  const state = await editorHarness({ editor: { defaultAction: "workers" } });
  await state.editor.open("UPDATE", "operation", { action: "workers", rowAction: "update", array: "employees", position: 1, raw: state.raw });
  state.editor.update({ startTime: "10:00" });
  assert.equal(state.editor.request().position, 1); assert.equal(state.raw.employees[1].startTime, "08:00");
  await state.editor.reload(); assert.equal(state.editor.opened.value, false); assert.equal(state.editor.draft.value, null);
  state.effect.stop();
});

test("single editor binds terminated confirmation to its draft and retains it only for a definite retry", async () => {
  let prompts = 0, denied = true;
  const state = await editorHarness({
    read: async (ref, raw) => ({ exists: () => true, data: () => ref.path.includes("/Sites/") ? { isTemporary: false, status: "TERMINATED" } : raw }),
    confirm: async () => { prompts++; return true; },
    call: async () => { if (denied) throw Object.assign(new Error(), { code: "functions/failed-precondition" }); return { data: { success: true } }; },
  });
  await state.editor.open("UPDATE", "operation"); state.editor.update({ dateAt: new Date("2026-09-02") });
  assert.equal(await state.editor.save(), false); assert.equal(prompts, 1);
  denied = false; assert.equal(await state.editor.save(), true); assert.equal(prompts, 1);
  await state.editor.open("UPDATE", "operation"); state.editor.update({ dateAt: new Date("2026-09-03") });
  await state.editor.save(); assert.equal(prompts, 2);
  await state.editor.open("UPDATE", "operation"); state.editor.update({ dateAt: new Date("2026-09-03") });
  Object.defineProperty(state.editor.draft.value, SITE_SCHEDULE_CONFIRMATION, { configurable: true, value: { companyId: "company", siteId: "site", status: "TERMINATED", operationId: "selection" } });
  await state.editor.save(); assert.equal(prompts, 2, "the actual selection confirmation is accepted only for this tenant and Site");
  state.effect.stop();
});

test("route reset invalidates an in-flight save without closing the next document draft", async () => {
  let finish;
  const state = await editorHarness({ call: () => new Promise((resolve) => { finish = resolve; }) });
  await state.editor.open("UPDATE", "operation"); state.editor.update({ remarks: "old" });
  const pending = state.editor.save(); await flush(); assert.equal(state.editor.busy.value, true);
  state.editor.reset(); assert.equal(state.editor.draft.value, null);
  await state.editor.open("UPDATE", "next-operation"); state.editor.update({ remarks: "next" });
  finish({ data: { success: true } }); assert.equal(await pending, false);
  assert.equal(state.editor.opened.value, true); assert.equal(state.editor.draft.value.remarks, "next");
  assert.equal(state.editor.request().documentId, "next-operation"); state.effect.stop();
});

test("dedicated operation editors and wrappers compile with their actual template slots", async () => {
  for (const path of ["components/ArrangementNotifications/Manager/index.vue", "components/ArrangementNotification/Manager/toLeaved.vue", "components/Operation/AirEditor.vue", "components/Operation/Editor.vue", "components/Operation/Manager.vue", "components/Operation/ArrayManager.vue", "components/Operation/RowInput.vue", "components/Operation/RowsManager.vue", "components/SiteOperationSchedule/Manager/index.vue", "components/SiteOperationSchedules/Manager/index.vue", "components/OperationResult/Manager/index.vue", "components/OperationResults/Manager/index.vue", "components/OperationBilling/Manager/index.vue", "components/OperationBillings/Manager/index.vue", "components/Workers/Manager/index.vue", "components/SiteOperationSchedule/WorkerDetailManager/index.vue", "components/ArrangementNotification/Manager/index.vue", "components/OperationResult/Generator/index.vue", "components/SiteOperationSchedule/Duplicator/index.vue", "components/OperationResult/Duplicator/index.vue", "components/OperationBilling/Activator/Base/BtnToggleLock.vue", "pages/operation-results/[id].vue", "pages/billings/operations/[id].vue"]) {
    const { descriptor, errors } = parse(await source(path), { filename: path }); assert.deepEqual(errors, []);
    const compiled = compileScript(descriptor, { id: path });
    const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: compiled.bindings } });
    assert.deepEqual(template.errors, [], path);
  }
});

test("result detail adopts Air managers without changing its visible operation controls", async () => {
  const page = await source("pages/operation-results/[id].vue");
  const single = await source("components/OperationResult/Manager/index.vue");
  const workers = await source("components/Workers/Manager/index.vue");
  const editor = await source("components/Operation/AirEditor.vue");

  assert.match(single, /<air-item-manager/u);
  assert.match(single, /maxWidth:\s*760/u);
  assert.match(single, /item\.update\(\)/u);
  assert.match(single, /item\.delete\(\)/u);
  assert.doesNotMatch(single, /on-reload|useOperationResultWriter/u);
  assert.match(workers, /<air-array-manager/u);
  assert.match(workers, /Operation\/RowInput\.vue/u);
  assert.match(workers, /props\.tableCard \? 'v-card' : 'div'/u);
  assert.doesNotMatch(workers, /on-reload|runTransaction|useOperationResultWriter/u);
  assert.match(editor, /最新値を読み直す/u);
  assert.match(editor, /キャンセル/u);
  assert.match(editor, /\? "削除" : "保存"/u);
  assert.match(editor, /!props\.editor\.isDelete\s*&&\s*props\.editor\.disabled/u);
  assert.match(page, /title="作業員"/u);
  assert.match(page, />従業員を追加<\/v-btn>/u);
  assert.match(page, />外注先を追加<\/v-btn>/u);
  assert.match(page, /group="articles"[\s\S]*label="稼働外売上"/u);
  assert.match(page, /<OperationResultManager[\s\S]*label="稼働実績"[\s\S]*削除処理/u);
  assert.match(page, /<WorkersManager[\s\S]*v-model="doc\.workers"/u);
  for (const binding of [
    ':default-date-at="doc.dateAt"',
    ':default-site-id="doc.siteId"',
    ':default-shift-type="doc.shiftType"',
    ':default-start-time="doc.startTime"',
    ':default-end-time="doc.endTime"',
    ':default-is-start-next-day="doc.isStartNextDay"',
    ':default-regulation-work-minutes="doc.regulationWorkMinutes"',
    ':default-break-minutes="doc.breakMinutes"',
  ]) assert.ok(page.includes(binding), binding);
  assert.match(page, /@submit:complete="async \(\) => await doc\.update\(\)"/u);
  assert.doesNotMatch(page, /OperationResultWorkersManager/u);
});

test("arrangement notification managers use standard CRUD transitions and no deleted notification contracts", async () => {
  const single = await source("components/ArrangementNotification/Manager/index.vue");
  const personal = await source("components/ArrangementNotifications/Manager/index.vue");
  const leaved = await source("components/ArrangementNotification/Manager/toLeaved.vue");
  const generatorDetail = await source("components/OperationResult/Generator/Detail.vue");
  assert.match(single, /air-item-manager/u); assert.match(single, /useBaseManager/u); assert.match(single, /item\.update\(\)/u);
  assert.match(single, /includesStatus/u); assert.match(single, /customInput/u); assert.match(single, /beforeEdit/u); assert.match(single, /submit:complete/u); assert.match(single, /toUpdate/u);
  assert.doesNotMatch(single, /hasValidDoc|disabled: slotProps\.disableUpdate \|\| !hasValidDoc|useSlots|forwardedSlotNames/u);
  assert.match(single, /const toUpdate = \(\.\.\.args\) => manager\.value\?\.toUpdate\(\.\.\.args\);/u);
  assert.match(single, /<template v-for="\(_, name\) in \$slots" #\[name\]="scope">\s*<slot :name="name" v-bind="scope \?\? \{\}" \/>/u);
  assert.doesNotMatch(single, /<template #activator/u);
  assert.doesNotMatch(single, /<slot v-if="name !== 'activator'"/u);
  assert.doesNotMatch(single, /if \(!props\.doc\?\.docId\)/u);
  assert.match(generatorDetail, /:doc="notificationsMap\[worker\.notificationKey\]"/u);
  assert.match(generatorDetail, /:disabled="props\.loading"/u);
  assert.match(personal, /air-array-manager/u); assert.match(personal, /useBaseManager/u); assert.match(personal, /new SiteOperationSchedule\(\)\.fetchDoc/u);
  assert.match(personal, /baselineStatus/u); assert.match(personal, /DEFINITION\.value\?\.\[baselineStatus\.value\]\?\.next\?\.transition/u); assert.match(personal, /await item\[transition\]\(\)/u); assert.match(personal, /#input-default/u); assert.match(personal, /#editor-actions/u); assert.match(personal, /ArrangementNotificationTransitionBtn/u); assert.match(personal, /ArrangementNotificationManagerToLeaved/u); assert.match(personal, /modelValue/u);
  assert.match(personal, /:loading="loading"/u); assert.match(personal, /:disabled="disabled \|\| loading"/u); assert.match(personal, /emit\("submit:complete", event\.item\)/u); assert.match(personal, /manager\.value\?\.quitEditing\(\)/u);
  assert.match(personal, /async function handleUpdate\(item\)[\s\S]*?return await item\[transition\]\(\);/u);
  assert.match(personal, /function closeEditor\(\)[\s\S]*?manager\.value\?\.quitEditing\(\);/u);
  assert.match(personal, /<v-btn[\s\S]*?v-else[\s\S]*?block[\s\S]*?variant="text"[\s\S]*?:disabled="loading"[\s\S]*?@click="closeEditor"[\s\S]*?>閉じる/u);
  assert.match(personal, /editingDocId/u); assert.match(personal, /listenerSnapshot/u); assert.match(personal, /props\.modelValue\.find\(\(item\) => item\.docId === editingDocId\.value\)/u); assert.match(personal, /equal\(snapshot, listenerSnapshot\.value\)/u); assert.match(personal, /manager\.value\.updateProperties\(snapshot\)/u); assert.match(personal, /manager\.value\?\.updateProperties\(toSnapshot\(latest\)\)/u); assert.doesNotMatch(personal, /draft\.initialize\(latest\)/u); assert.doesNotMatch(personal, /\.initialize\(latest\)/u); assert.match(personal, /baselineStatus\.value = latest\.status/u); assert.match(personal, /clearEditingState/u); assert.match(personal, /listenerSnapshot\.value = null/u);
  assert.match(leaved, /air-item-manager/u); assert.match(leaved, /item\.toLeaved\(\)/u); assert.match(leaved, /dateAt/u); assert.match(leaved, /actualStartTime/u); assert.match(leaved, /actualEndTime/u); assert.match(leaved, /actualIsStartNextDay/u); assert.match(leaved, /actualBreakMinutes/u); assert.match(leaved, /submit:complete/u); assert.match(leaved, /activator/u);
  const combined = `${single}\n${personal}\n${leaved}`;
  for (const forbidden of ["useNotificationEditor", "usePersonalNotification", "OperationEditor", "getDocFromServer", "runTransaction", "expectedNotificationState", "prepareNotificationState", "notificationStateContract"]) assert.doesNotMatch(combined, new RegExp(forbidden, "u"));
  for (const path of ["composables/application/operation/useNotificationEditor.js", "composables/application/operation/usePersonalNotification.js", "composables/domain/operation/notificationStateContract.js", "functions/shared/notificationStateContract.js"]) await assert.rejects(access(new URL(`../../${path}`, import.meta.url)));
  const itemManager = await source("node_modules/air-vuetify-v3/src/composables/useItemManager.js");
  assert.match(itemManager, /internalItem\.value\[key\] = value/u); assert.match(itemManager, /await props\.handleUpdate\(internalItem\.value\)/u); assert.match(itemManager, /item: Vue\.computed\(\(\) => _cloneObject\(internalItem\.value\)\)/u);
});

test("arrangement listener synchronization updates the internal manager clone only for the edited document", async () => {
  const editingDocId = Vue.ref("doc-a");
  const listenerSnapshot = Vue.ref(null);
  const docs = Vue.reactive([{ docId: "doc-a", status: "ARRANGED", confirmedAt: new Date("2026-09-01T00:00:00Z"), arrivedAt: null }, { docId: "doc-b", status: "ARRANGED", confirmedAt: null, arrivedAt: null }]);
  const internalItem = Vue.reactive({ docId: "doc-a", status: "ARRANGED", confirmedAt: docs[0].confirmedAt, arrivedAt: null });
  const handled = [];
  const manager = { updateProperties(snapshot) { for (const [key, value] of Object.entries(snapshot)) if (key in internalItem) internalItem[key] = value; }, async handleUpdate() { handled.push({ ...internalItem }); } };
  const snapshotOf = (item) => ({ ...item });
  const sync = () => {
    const latest = docs.find((item) => item.docId === editingDocId.value);
    if (!latest) return;
    const snapshot = snapshotOf(latest);
    if (JSON.stringify(snapshot) === JSON.stringify(listenerSnapshot.value)) return;
    manager.updateProperties(snapshot); listenerSnapshot.value = snapshot;
  };
  sync();
  docs[0] = { ...docs[0], status: "CONFIRMED", confirmedAt: null, arrivedAt: new Date("2026-09-02T00:00:00Z") }; sync();
  assert.equal(internalItem.status, "CONFIRMED"); assert.equal(internalItem.confirmedAt, null); assert.ok(internalItem.arrivedAt);
  await manager.handleUpdate(); assert.equal(handled.at(-1).status, "CONFIRMED"); assert.equal(handled.at(-1).confirmedAt, null);
  const beforeOther = { ...internalItem }; docs[1] = { ...docs[1], status: "ARRIVED", arrivedAt: new Date("2026-09-03T00:00:00Z") }; sync(); assert.deepEqual({ ...internalItem }, beforeOther);
  let releaseFetch; const fetchSchedule = new Promise((resolve) => { releaseFetch = resolve; });
  const beforeEdit = async () => { await fetchSchedule; const latest = docs.find((item) => item.docId === editingDocId.value); manager.updateProperties(snapshotOf(latest)); listenerSnapshot.value = snapshotOf(latest); };
  const pending = beforeEdit(); docs[0] = { ...docs[0], status: "LEAVED", confirmedAt: null, arrivedAt: null }; releaseFetch(); await pending;
  assert.equal(internalItem.status, "LEAVED"); assert.equal(internalItem.confirmedAt, null); assert.equal(internalItem.arrivedAt, null);
});

test("result collection create uses its plural Air manager and model persistence without changing the editor controls", async () => {
  const manager = await source("components/OperationResults/Manager/index.vue");
  const handlers = await source("handlers/operationResultHandlers.js");
  const page = await source("pages/operation-results/index.vue");

  assert.match(manager, /<air-array-manager/u);
  assert.match(manager, /:schema="OperationResult"/u);
  assert.match(manager, /:handle-create="props\.handleCreate"/u);
  assert.match(manager, /OperationAirEditor/u);
  assert.match(manager, /maxWidth:\s*760/u);
  assert.doesNotMatch(manager, /OperationArrayManager|useOperationEditor/u);
  assert.match(handlers, /onBeforeCreate/u);
  assert.match(handlers, /await item\.create\(\)/u);
  assert.match(handlers, /await item\.update\(\)/u);
  assert.match(handlers, /await item\.delete\(\)/u);
  assert.match(page, /@create="handleCreated"/u);
  assert.match(page, /tableProps\.toCreate\(\)/u);
});

test("actual article input connection blocks save while lookup is pending, commits ID/price together, and preserves explicit price", async () => {
  const state = await editorHarness({ editor: { defaultAction: "articles" } });
  state.raw.articles = [{ articleId: "old", price: 50, quantity: 1 }];
  await state.editor.open("UPDATE", "operation", { action: "articles", rowAction: "update", array: "articles", position: 0, raw: state.raw });
  const requests = [];
  const make = await factory("composables/application/operation/useOperationArticleInput.js", "useOperationArticleInput", { ...Vue, useFetch: () => ({ fetchArticleComposable: { getArticle: (id) => new Promise((resolve, reject) => requests.push({ id, resolve, reject })) } }) });
  const props = Vue.reactive({ item: state.editor.draft.value, disabled: false, updateProperties: state.editor.update });
  const effect = Vue.effectScope(); let input; effect.run(() => { input = make(props, (name, value) => { assert.equal(name, "pending"); state.editor.setInputPending(value); }); });
  const first = input.chooseArticle("a"); assert.equal(await state.editor.save(), false); assert.equal(state.calls.length, 0);
  assert.equal(props.item.articleId, "old"); assert.equal(props.item.price, 50);
  input.changePrice(50); requests[0].resolve({ price: 200 }); await first;
  assert.equal(props.item.articleId, "a"); assert.equal(props.item.price, 50, "same-value explicit price wins over delayed initialization");
  const a = input.chooseArticle("a"), b = input.chooseArticle("b");
  requests[2].resolve({ price: 300 }); await b; requests[1].resolve({ price: 100 }); await a;
  assert.equal(props.item.articleId, "b"); assert.equal(props.item.price, 300);
  const rejected = input.chooseArticle("denied"); requests[3].reject(new Error()); await rejected;
  assert.equal(props.item.articleId, "b"); assert.equal(props.item.price, 300); assert.ok(input.error.value);
  const stale = input.chooseArticle("stale"); const previous = props.item;
  props.item = Vue.reactive({ articleId: "other", price: 9 }); await flush();
  requests[4].resolve({ price: 800 }); await stale;
  assert.equal(previous.articleId, "b"); assert.equal(props.item.articleId, "other");
  const closing = input.chooseArticle("closing"); effect.stop(); requests[5].resolve({ price: 900 }); await closing;
  assert.equal(props.item.articleId, "other"); state.effect.stop();
  const template = await source("components/Operation/RowInput.vue");
  assert.match(template, /@update:model-value="article.chooseArticle"/u); assert.match(template, /@update:model-value="article.changePrice"/u);
  assert.match(await source("components/Operation/Editor.vue"), /@pending="controller.setInputPending\?\.\(\$event\)"/u);
});

test("row reader waits for metadata-only server confirmation on reselection and rejects pending and old-scope snapshots", async () => {
  const state = await editorHarness(), props = Vue.reactive({ documentId: "operation" }), listeners = [], published = [];
  const make = await factory("composables/application/operation/useOperationRows.js", "useOperationRows", {
    ...Vue, useAuthStore: () => state.auth, useNuxtApp: () => ({ $firestore: {} }), doc: (_, path) => ({ path }),
    onSnapshot: (request, options, next) => {
      assert.deepEqual(options, { includeMetadataChanges: true });
      const entry = { request, stopped: false, emit(snapshot, metadataOnly = false) { if (!metadataOnly || options.includeMetadataChanges) next(snapshot); } };
      listeners.push(entry); return () => { entry.stopped = true; };
    },
  });
  const effect = Vue.effectScope(); let reader; effect.run(() => { reader = make(props, state.editor, (raw) => published.push(raw)); });
  const raw = state.raw; raw.updatedAt = new Timestamp(1788200000, 123456789);
  const snapshot = (fromCache, hasPendingWrites) => ({ metadata: { fromCache, hasPendingWrites }, exists: () => true, data: () => raw });
  listeners[0].emit(snapshot(true, false)); assert.equal(reader.raw.value, null); assert.equal(published.length, 0);
  listeners[0].emit(snapshot(false, true), true); assert.equal(reader.raw.value, null); assert.equal(published.length, 0);
  listeners[0].emit(snapshot(false, false), true); assert.strictEqual(reader.raw.value, raw); assert.equal(reader.raw.value.updatedAt.nanoseconds, 123456789);
  listeners[0].emit(snapshot(false, true), true); assert.equal(published.length, 1);
  props.documentId = null; await flush(); assert.equal(listeners[0].stopped, true); assert.equal(reader.raw.value, null);
  props.documentId = "operation"; await flush(); assert.deepEqual(listeners[1].request, listeners[0].request);
  listeners[1].emit(snapshot(true, false)); assert.equal(reader.raw.value, null);
  listeners[0].emit(snapshot(false, false), true); assert.equal(reader.raw.value, null); assert.equal(published.length, 1);
  listeners[1].emit(snapshot(false, false), true); assert.strictEqual(reader.raw.value, raw); assert.equal(published.length, 2);
  state.auth.isSuperUserClaimValid = false; await flush(); assert.equal(reader.raw.value, null); assert.equal(listeners[1].stopped, true);
  listeners[1].emit(snapshot(false, false), true); assert.equal(reader.raw.value, null); assert.equal(published.length, 2);
  effect.stop(); state.effect.stop();
});

for (const terminal of ["missing", "error", "claim"]) test(`row reader ${terminal} revokes raw/draft together and ignores the old save response`, async () => {
  let finish;
  const state = await editorHarness({ call: () => new Promise((resolve) => { finish = resolve; }) });
  const listeners = [], props = Vue.reactive({ documentId: "operation" });
  const make = await factory("composables/application/operation/useOperationRows.js", "useOperationRows", {
    ...Vue, useAuthStore: () => state.auth, useNuxtApp: () => ({ $firestore: {} }), doc: (_, path) => ({ path }),
    onSnapshot: (_, options, next, error) => { const entry = { options, next, error, stopped: false }; listeners.push(entry); return () => { entry.stopped = true; }; },
  });
  const effect = Vue.effectScope(); let reader; effect.run(() => { reader = make(props, state.editor); });
  const snapshot = (value) => ({ metadata: { fromCache: false, hasPendingWrites: false }, exists: () => value !== null, data: () => value });
  listeners[0].next(snapshot(state.raw)); await state.editor.open("UPDATE", "operation");
  state.editor.update({ remarks: "draft" }); const pending = state.editor.save(); await flush();
  if (terminal === "missing") listeners[0].next(snapshot(null));
  if (terminal === "error") listeners[0].error(new Error());
  if (terminal === "claim") { state.auth.isSuperUserClaimValid = false; await flush(); }
  assert.equal(reader.raw.value, null); assert.equal(state.editor.baseline.value, null); assert.equal(state.editor.draft.value, null); assert.equal(listeners[0].stopped, true);
  listeners[0].next(snapshot(state.raw)); assert.equal(reader.raw.value, null);
  assert.equal(await state.editor.save(), false); assert.equal(state.calls.length, 1);
  if (terminal === "claim") { state.auth.isSuperUserClaimValid = true; await flush(); }
  props.documentId = "next"; await flush(); await state.editor.open("UPDATE", "next"); state.editor.update({ remarks: "next draft" });
  finish({ data: { success: true } }); assert.equal(await pending, false); assert.equal(state.editor.draft.value.remarks, "next draft");
  effect.stop(); state.effect.stop();
});

test("actual Draggable schedules carries raw through reorder and accepts fresh canonical props", async () => {
  const scope = "company/actor";
  const make = await factory("components/Draggable/OperationSchedules/useIndex.js", "useIndex", { Vue, SiteOperationSchedule, inheritOperationRaw, createDraggableFallbackOptions: () => ({}) });
  const context = createOperationRawContext(); context.reset(scope);
  const raws = [operation(), { ...operation(), docId: "other", displayOrder: 1 }];
  const models = raws.map((raw) => { const model = new SiteOperationSchedule(raw); context.remember(model, raw); return model; });
  const props = Vue.reactive({ schedules: models, disabled: false });
  const effect = Vue.effectScope(); let drag, emitted; effect.run(() => { drag = make(props, (_, value) => { emitted = value; }); });
  const copies = drag.attrs.value.modelValue; assert.strictEqual(operationRawFor(copies[0], scope), raws[0]);
  drag.attrs.value["onUpdate:modelValue"]([copies[1], copies[0]]);
  assert.deepEqual(emitted.map((item) => item.docId), ["other", "operation"]); assert.deepEqual(drag.attrs.value.modelValue.map((item) => item.docId), ["other", "operation"]);
  assert.strictEqual(operationRawFor(emitted[0], scope), raws[1]);
  props.schedules = [...models]; await flush();
  assert.deepEqual(drag.attrs.value.modelValue.map((item) => item.docId), ["operation", "other"]); assert.equal(drag.attrs.value.disabled, false);
  context.clear(); await flush(); assert.throws(() => operationRawFor(emitted[0], scope)); effect.stop();
});

for (const code of ["permission-denied", "unavailable"]) test(`operation committed save with ${code} post-read reports success and cannot resend`, async () => {
  let committed = false;
  const state = await editorHarness({ call: async () => { committed = true; return { data: { success: true } }; }, read: async (_, raw) => { if (committed) throw Object.assign(new Error(), { code }); return { exists: () => true, data: () => raw }; } });
  await state.editor.open("UPDATE", "operation"); state.editor.update({ remarks: "saved" });
  assert.equal(await state.editor.save(), true); assert.match(state.editor.message.value, /保存は完了/u);
  assert.equal(state.editor.draft.value, null); assert.equal(state.editor.uncertain.value, false); assert.equal(state.editor.conflict.value, false);
  assert.equal(await state.editor.save(), false); assert.equal(state.calls.length, 1); state.effect.stop();
});

for (const boundary of ["read", "prompt"]) test(`Site guard ${boundary} cannot transfer an old attempt confirmation to a new draft`, async () => {
  let pendingRead, pendingPrompt, first = true; const prompts = [];
  const siteSnapshot = { exists: () => true, data: () => ({ isTemporary: false, status: "TERMINATED" }) };
  const state = await editorHarness({
    read: async (ref, raw) => {
      if (!ref.path.includes("/Sites/")) return { exists: () => true, data: () => raw };
      if (boundary === "read" && first) { first = false; return new Promise((resolve) => { pendingRead = resolve; }); }
      return siteSnapshot;
    },
    confirm: async ({ siteId }) => { prompts.push(siteId); if (boundary === "prompt" && first) { first = false; return new Promise((resolve) => { pendingPrompt = resolve; }); } return true; },
  });
  await state.editor.open("UPDATE", "a"); state.editor.update({ dateAt: new Date("2026-09-02") });
  const saving = state.editor.save(); for (let index = 0; index < 8 && !pendingRead && !pendingPrompt; index++) await flush();
  state.editor.reset(); await state.editor.open("UPDATE", "b"); state.editor.update({ dateAt: new Date("2026-09-03") });
  if (pendingRead) pendingRead(siteSnapshot); else pendingPrompt(true);
  assert.equal(await saving, false); assert.equal(state.calls.length, 0); assert.equal(prompts.length, boundary === "read" ? 0 : 1);
  assert.equal(await state.editor.save(), true); assert.equal(state.calls.length, 1); assert.equal(state.calls[0].operations[0].documentId, "b");
  assert.equal(prompts.length, boundary === "read" ? 1 : 2, "B must independently confirm the same terminated Site"); state.effect.stop();
});

test("CREATE accepts the actual arrangement Class preset without reassigning unset time defaults", async () => {
  for (const times of [{}, { startTime: "08:00", endTime: "17:00" }]) {
    const state = await editorHarness();
    const preset = new SiteOperationSchedule({ siteId: "selected-site", shiftType: "NIGHT", ...times });
    const before = employeeContract.encodeExpected(preset.toObject());
    assert.equal(await state.editor.open("CREATE", preset), true);
    assert.equal(state.editor.message.value, ""); assert.equal(state.editor.draft.value.siteId, "selected-site"); assert.equal(state.editor.draft.value.shiftType, "NIGHT");
    assert.equal(state.editor.draft.value.startTime, times.startTime ?? null); assert.equal(state.editor.draft.value.endTime, times.endTime ?? null);
    assert.notStrictEqual(state.editor.draft.value, preset); state.editor.update({ remarks: "independent" });
    assert.deepEqual(employeeContract.encodeExpected(preset.toObject()), before); state.editor.close(); assert.equal(state.calls.length, 0); state.effect.stop();
  }
});

test("CREATE still reports an invalid preset setter failure and arrangement manager explicitly suppresses its fallback activator", async () => {
  const state = await editorHarness();
  assert.equal(await state.editor.open("CREATE", { startTime: 12 }), false); assert.match(state.editor.message.value, /編集を開始できません/u);
  state.editor.close(); assert.equal(state.calls.length, 0); state.effect.stop();
  const code = await source("components/Arrangements/Manager/index.vue");
  assert.match(code, /<SiteOperationScheduleManager ref="scheduleManager">\s*<template #activator \/>\s*<\/SiteOperationScheduleManager>/u);
  assert.match(code, /<SpeedDial v-bind="uiSpeedDial.attrs" \/>/u);
  const { descriptor } = parse(code), compiled = compileScript(descriptor, { id: "arrangements-manager" });
  const template = compileTemplate({ source: descriptor.template.content, filename: "components/Arrangements/Manager/index.vue", id: "arrangements-manager", compilerOptions: { bindingMetadata: compiled.bindings } });
  assert.deepEqual(template.errors, []);
});

test("schedule managers use the standard Air manager and model handlers", async () => {
  const single = await source("components/SiteOperationSchedule/Manager/index.vue");
  const plural = await source("components/SiteOperationSchedules/Manager/index.vue");
  const generator = await source("components/OperationResult/Generator/index.vue");
  const generatorDetail = await source("components/OperationResult/Generator/Detail.vue");
  const workers = await source("components/SiteOperationSchedule/WorkerDetailManager/index.vue");
  const handlers = await source("handlers/siteOperationScheduleHandlers.js");
  const actions = await source("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js");
  assert.match(single, /<air-item-manager/u);
  assert.doesNotMatch(single, /OperationManager|useOperationEditor/u);
  assert.match(plural, /<air-array-manager/u);
  assert.match(plural, /:schema="SiteOperationSchedule"/u);
  assert.doesNotMatch(plural, /OperationArrayManager|useOperationEditor/u);
  assert.match(plural, /Object\.keys\(slots\)\.filter\(\(name\) => name !== "table"\)/u);
  assert.match(plural, /v-for="name in forwardedSlotNames"/u);
  assert.doesNotMatch(plural, /v-for="\(_, name\) in \$slots"/u);
  assert.match(generator, /<template #table="\{ items, toUpdate, isLoading \}">[\s\S]*<List[\s\S]*<Detail/u);
  assert.doesNotMatch(generator, /useOperationGenerator|saveOperation|Callable|action:\s*["']convert/u);
  assert.doesNotMatch(generator, /schedule\.notify\(|\.notify\(/u);
  assert.match(generator, /await targetSchedule\.syncToOperationResult\(targetNotificationsMap\)/u);
  assert.match(generator, /:before-edit="beforeEdit"/u);
  assert.ok(generator.indexOf("ready.value = false") < generator.indexOf("fetchDocs"));
  assert.ok(generator.indexOf("fetchDocs") < generator.indexOf("subscribeDocs"));
  assert.ok(generator.indexOf("subscribeDocs") < generator.indexOf("ready.value = true"));
  const listTag = generator.slice(generator.indexOf("<List"), generator.indexOf("/>", generator.indexOf("<List")));
  const detailTag = generator.slice(generator.indexOf("<Detail"), generator.indexOf("/>", generator.indexOf("<Detail")));
  assert.match(listTag, /:loading="isLoading \|\| confirming"/u);
  assert.doesNotMatch(listTag, /preparing|!ready/u);
  assert.doesNotMatch(listTag, /!ready/u);
  assert.match(detailTag, /:loading="isLoading \|\| preparing \|\| confirming \|\| !ready"/u);
  assert.match(generator, /beforeEdit\(editMode, item\)[\s\S]*?ready\.value[\s\S]*?item\?\.docId !== selectedSchedule\.value\?\.docId[\s\S]*?syncToOperationResult\(targetNotificationsMap\)/u);
  assert.doesNotMatch(generator, /notification\.(?:create|update|status|confirmedAt|arrivedAt|leavedAt|shouldNotify)\s*=|notification\.to(?:Arranged|Confirmed|Arrived|Leaved)\(|\.create\(\)|\.update\(\)|\.notify\(/u);
  const { descriptor: generatorDescriptor, errors: generatorErrors } = parse(generator, { filename: "components/OperationResult/Generator/index.vue" });
  assert.deepEqual(generatorErrors, []);
  const generatorCompiled = compileScript(generatorDescriptor, { id: "operation-result-generator" });
  const generatorTemplate = compileTemplate({ source: generatorDescriptor.template.content, filename: "components/OperationResult/Generator/index.vue", id: "operation-result-generator", compilerOptions: { bindingMetadata: generatorCompiled.bindings } });
  assert.deepEqual(generatorTemplate.errors, []);
  assert.match(generatorDetail, /<SecurityReportsManager/u);
  assert.match(handlers, /await item\.create\(\)/u);
  assert.match(handlers, /await item\.update\(\)/u);
  assert.match(handlers, /await item\.delete\(\)/u);
  assert.match(workers, /internalSchedule\.value\.update\(\)/u);
  assert.match(actions, /schedule\.update\(\)/u);
  assert.match(actions, /schedule\.notify\(\)/u);
  assert.match(actions, /SiteOperationSchedule\.runTransaction/u);
  assert.doesNotMatch(actions, /useOperationSubmission|scheduleCommands/u);
});

test("operation result generator keeps list and detail independently scrollable with fixed actions", async () => {
  const generator = await source("components/OperationResult/Generator/index.vue");
  const list = await source("components/OperationResult/Generator/List.vue");
  const detail = await source("components/OperationResult/Generator/Detail.vue");

  const tableSlotIndex = generator.indexOf('<template #table="{ items, toUpdate, isLoading }">');
  const tableColumnIndex = generator.indexOf('<div class="d-flex flex-column flex-grow-1 fill-height overflow-hidden ga-2" style="min-height: 0">', tableSlotIndex);
  const tableSlotEnd = generator.indexOf("</template>", tableColumnIndex);
  assert.ok(tableSlotIndex >= 0 && tableColumnIndex > tableSlotIndex && tableSlotEnd > tableColumnIndex, "table slot must contain the generator column");
  const tableSlot = generator.slice(tableColumnIndex, tableSlotEnd);
  assert.match(tableSlot, /^<div class="d-flex flex-column flex-grow-1 fill-height overflow-hidden ga-2" style="min-height: 0">/u);
  assert.match(tableSlot, /<v-alert[\s\S]*?<\/v-alert>[\s\S]*?<div class="d-flex flex-grow-1 overflow-hidden ga-2" style="min-height: 0">/u);
  assert.match(generator, /<div class="d-flex flex-grow-1 overflow-hidden ga-2" style="min-height: 0">[\s\S]*?<List[\s\S]*?class="fill-height"[\s\S]*?\/>[\s\S]*?<Detail[\s\S]*?class="fill-height"[\s\S]*?\/>[\s\S]*?<\/div>/u);
  assert.match(generator, /<div class="operation-result-generator d-flex flex-column fill-height overflow-hidden" style="min-height: 0">[\s\S]*?<SiteOperationSchedulesManager[\s\S]*?class="flex-grow-1 overflow-hidden"[\s\S]*?style="min-height: 0"[\s\S]*?>[\s\S]*?<\/SiteOperationSchedulesManager>[\s\S]*?<v-dialog[\s\S]*?<\/v-dialog>[\s\S]*?<\/div>/u);
  assert.doesNotMatch(generator, /<template>\s*<SiteOperationSchedulesManager[\s\S]*?\n\s*<v-dialog/u);

  const toolbarIndex = list.indexOf("<v-toolbar");
  const listScrollerIndex = list.indexOf('<div class="flex-grow-1 overflow-y-auto');
  assert.ok(toolbarIndex >= 0 && listScrollerIndex > toolbarIndex, "list toolbar must precede its scroll container");
  assert.match(list.slice(listScrollerIndex, list.indexOf("</div>", listScrollerIndex)), /class="[^"]*\bflex-grow-1\b[^"]*\boverflow-y-auto\b[^"]*"/u);

  const detailToolbarIndex = detail.indexOf("<v-toolbar");
  const detailBodyIndex = detail.indexOf('<v-card-text v-if="selectedSchedule"');
  const detailBodyEnd = detail.indexOf("</v-card-text>", detailBodyIndex);
  const detailActionsIndex = detail.indexOf('<v-card-actions v-if="selectedSchedule"');
  assert.ok(detailToolbarIndex >= 0 && detailBodyIndex > detailToolbarIndex && detailBodyEnd > detailBodyIndex && detailActionsIndex > detailBodyEnd, "detail controls must remain in toolbar, body, body-close, actions order");
  assert.match(detail.slice(detailBodyIndex, detail.indexOf(">", detailBodyIndex)), /class="[^"]*\bflex-grow-1\b[^"]*\boverflow-y-auto\b[^"]*"/u);
  assert.doesNotMatch(detail.slice(detailBodyIndex, detailBodyEnd), /<v-card-actions\b/u, "actions must not be nested in the scrolling card body");
  assert.match(detail.slice(detailActionsIndex, detail.indexOf(">", detailActionsIndex)), /class="[^"]*\bflex-grow-0\b[^"]*"/u);
  const { descriptor, errors } = parse(detail, { filename: "components/OperationResult/Generator/Detail.vue" });
  assert.deepEqual(errors, []);
  const compiled = compileScript(descriptor, { id: "operation-result-generator-detail" });
  const template = compileTemplate({
    source: descriptor.template.content,
    filename: "components/OperationResult/Generator/Detail.vue",
    id: "operation-result-generator-detail",
    compilerOptions: { bindingMetadata: compiled.bindings },
  });
  assert.deepEqual(template.errors, []);
  assert.match(detail, /<template #append-header>\s*<th>action<\/th>\s*<\/template>/u);
  assert.match(detail, /<template #append="\{ worker \}">/u);
  assert.equal((detail.match(/<ArrangementNotificationManager\b/gu) ?? []).length, 1);
  const workerActionStart = detail.indexOf("<ArrangementNotificationManager");
  const workerActionEnd = detail.indexOf("</ArrangementNotificationManager>", workerActionStart);
  const workerAction = detail.slice(workerActionStart, workerActionEnd);
  assert.match(workerAction, /v-if="activatorProps\.item\?\.docId"/u);
  assert.match(workerAction, /<v-btn\b[\s\S]*?icon="mdi-pencil"[\s\S]*?aria-label="作業員実績を修正"[\s\S]*?title="作業員実績を修正"[\s\S]*?@click="activatorProps\.toUpdate\(activatorProps\.item\)"[\s\S]*?:disabled="props\.loading"[\s\S]*?\/>/u);
  assert.doesNotMatch(workerAction, /activatorProps\.(?:disabled|disableUpdate)/u);
});

test("operation result confirmation guards selection and worker actions", async () => {
  const generator = await source("components/OperationResult/Generator/index.vue");
  const list = await source("components/OperationResult/Generator/List.vue");
  const detail = await source("components/OperationResult/Generator/Detail.vue");

  assert.match(generator, /const preparing = ref\(false\);\s*const confirming = ref\(false\);/u);
  assert.match(generator, /if \(confirming\.value\) return false;/u);
  assert.match(generator, /const targetDocId = item\.docId;[\s\S]*?const targetNotificationsMap = Object\.fromEntries/u);
  assert.match(generator, /await targetSchedule\.syncToOperationResult\(targetNotificationsMap\);/u);
  assert.match(generator, /if \(selectedSchedule\.value\?\.docId === targetDocId\) \{\s*selectedSchedule\.value = null;/u);
  assert.match(generator, /finally \{\s*confirming\.value = false;[\s\S]*?if \(!selectedSchedule\.value\) \{[\s\S]*?clearNotifications\(\);[\s\S]*?ready\.value = false;/u);
  assert.match(generator, /<v-dialog v-model="confirming" persistent[\s\S]*上下番を確定しています/u);
  const listTag = generator.slice(generator.indexOf("<List"), generator.indexOf("/>", generator.indexOf("<List")));
  const detailTag = generator.slice(generator.indexOf("<Detail"), generator.indexOf("/>", generator.indexOf("<Detail")));
  assert.match(listTag, /:loading="isLoading \|\| confirming"/u);
  assert.doesNotMatch(listTag, /preparing|!ready/u);
  assert.doesNotMatch(listTag, /!ready/u);
  assert.match(detailTag, /:loading="isLoading \|\| preparing \|\| confirming \|\| !ready"/u);
  assert.doesNotMatch(generator, /notificationRetryAvailable|配置通知を再取得|上下番情報を再読込|>再読込<\/v-btn>/u);
  assert.match(generator, /error\.value = "配置通知を取得できません。予定を再選択するか、画面を再表示してください。"/u);
  assert.match(generator, /if \(!ready\.value\) \{\s*error\.value = "配置通知を確認できません。予定を再選択するか、画面を再表示してください。";\s*return false;\s*\}/u);
  assert.match(generator, /if \(item\?\.docId !== selectedSchedule\.value\?\.docId\) \{\s*error\.value = "選択中の予定が変わりました。再選択してから再実行してください。";\s*return false;\s*\}/u);
  assert.match(generator, /error\.value = "上下番を確定できません。選択内容を確認して再試行してください。"/u);
  assert.doesNotMatch(generator, /v-if="error && selectedSchedule"/u);
  assert.match(list, /loading: \{ type: Boolean, default: false \}/u);
  assert.match(list, /if \(props\.loading\) return;/u);
  assert.match(list, /:disabled="props\.loading"/u);
  assert.match(detail, /:disabled="props\.loading"/u);
});
