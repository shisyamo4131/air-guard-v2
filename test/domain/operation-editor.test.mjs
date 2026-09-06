import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Vue from "vue";
import { Timestamp } from "firebase/firestore";
import { SiteOperationSchedule, OperationResult, OperationBilling, ArticleDetail, User } from "@shisyamo4131/air-guard-v2-schemas";
import * as contract from "../../functions/shared/operationWriteContract.js";
import * as employeeContract from "../../functions/shared/employeeContract.js";
import { createOperationRawContext, operationRawFor, inheritOperationRaw, operationRowPosition, restoreOperationRaw } from "../../composables/domain/operation/operationRawContext.js";
import { rangeIsRef, rangeIsValid } from "../../composables/validators/rangeValidator.js";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { SITE_SCHEDULE_CONFIRMATION } from "../../utils/siteOperationSchedule/siteScheduleGuard.js";

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

test("actual Card/Draggable handlers retain original positions, immediately display edits and roll them back on refusal", async () => {
  const scope = "company/actor", auth = Vue.reactive({ uid: "actor", companyId: "company" });
  const { operationPresentation, watchOperationRollback } = await factory("composables/domain/operation/operationPresentation.js", "({ operationPresentation, watchOperationRollback })", { ...Vue, ...employeeContract, operationRawFor, restoreOperationRaw });
  const base = { Vue, SiteOperationSchedule, inheritOperationRaw, operationPresentation, watchOperationRollback, useAuthStore: () => auth };
  const makeCard = await factory("components/SiteOperationSchedule/Card/useIndex.js", "useIndex", base);
  const makeDrag = await factory("components/Draggable/Workers/useIndex.js", "useIndex", { ...base, useBaseManager: () => ({ logger: { info() {}, error(error) { throw error; } }, isDev: false }), useTimedSet: () => ({ add() {}, has: () => false }), createDraggableFallbackOptions: () => ({}) });
  const makeCommands = await factory("composables/domain/operation/scheduleCommands.js", "scheduleCommands", { ...contract, ...employeeContract, operationEmployeeReferences: (await import("../../functions/shared/operationReferences.js")).operationEmployeeReferences, operationRawFor, operationRowPosition });
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
  const presentation = operationPresentation(source, scope); presentation.blocked = true; presentation.revision++; await flush();
  assert.deepEqual(card.defaultSlotProps.value.modelValue.employeeIds, ["first", "second"]);
  assert.deepEqual(drag.attrs.value.modelValue.map((worker) => worker.id), ["first", "second"]);
  assert.equal(drag.attrs.value.disabled, true);
  assert.deepEqual(operationRowPosition(source, drag.attrs.value.modelValue[0], scope), { array: "employees", position: 0 });
  const fresh = { ...raw, remarks: "fresh" }, freshModel = Vue.reactive(new SiteOperationSchedule(fresh)); context.remember(freshModel, fresh);
  props.schedule = freshModel; await flush(); assert.equal(drag.attrs.value.disabled, false);
  drag.attrs.value.onChange({ added: { newIndex: 1, element: { id: "third", isEmployee: true } } });
  assert.deepEqual(makeCommands(emitted, scope).map(({ rowAction, position, changes }) => ({ rowAction, position, id: changes.id })), [{ rowAction: "add", position: 1, id: "third" }]);
  context.clear(); assert.throws(() => makeCommands(emitted, scope)); assert.equal(restoreOperationRaw(source, emitted), false);
  effect.stop();
});

test("period listener pairs each fresh Class with its raw, rejects old range/tenant responses, and disposes reads", async () => {
  const listeners = [];
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUserClaimValid: true, user: { docId: "actor", companyId: "company", disabled: false, isTemporary: false } });
  const make = await factory("composables/dataLayers/siteOperationSchedule/useSiteOperationSchedulesInRange.js", "useSiteOperationSchedulesInRange", {
    ...Vue, SiteOperationSchedule, rawForClass: employeeContract.rawForClass, createOperationRawContext, rangeIsRef, rangeIsValid,
    useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {} }),
    useFetch: () => ({ fetchSiteComposable: { fetchSite() {} }, fetchEmployeeComposable: { fetchEmployee() {} }, fetchOutsourcerComposable: { fetchOutsourcer() {} } }),
    collection: (_, path) => ({ path }), where: (...args) => args, query: (ref, ...constraints) => ({ ...ref, constraints }),
    onSnapshot: (ref, next, error) => { const entry = { ref, next, error, stopped: false }; listeners.push(entry); return () => { entry.stopped = true; }; },
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
  from.value = new Date("2026-09-02"); await flush();
  assert.equal(listeners[0].stopped, true); assert.equal(reader.docs.value.length, 0);
  listeners[0].next(snapshot(firstRaw)); assert.equal(reader.docs.value.length, 0);
  assert.throws(() => operationRawFor(firstModel, "company/actor"));
  auth.companyId = "other"; auth.user.companyId = "other"; await flush();
  listeners[1].next(snapshot(firstRaw)); assert.equal(reader.docs.value.length, 0);
  effect.stop(); assert.ok(listeners.every((entry) => entry.stopped));
});

async function editorHarness(options = {}) {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", isTemporary: false, disabled: false, roles: ["controller"] }) });
  const raw = operation(), calls = [];
  const make = await factory("composables/application/operation/useOperationEditor.js", "useOperationEditor", {
    ...Vue, ...contract, ...employeeContract, SiteOperationSchedule, OperationResult, OperationBilling, ArticleDetail,
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
  for (const path of ["components/ArrangementNotifications/Manager/index.vue", "components/ArrangementNotification/Manager/toLeaved.vue", "components/Operation/Editor.vue", "components/Operation/Manager.vue", "components/Operation/ArrayManager.vue", "components/Operation/RowInput.vue", "components/Operation/RowsManager.vue", "components/SiteOperationSchedule/Manager/index.vue", "components/SiteOperationSchedules/Manager/index.vue", "components/OperationResult/Manager/index.vue", "components/OperationResults/Manager/index.vue", "components/OperationBilling/Manager/index.vue", "components/OperationBillings/Manager/index.vue", "components/SiteOperationSchedule/WorkerDetailManager/index.vue", "components/ArrangementNotification/Manager/index.vue", "components/OperationResult/Generator/index.vue", "components/SiteOperationSchedule/Duplicator/index.vue", "components/OperationResult/Duplicator/index.vue", "components/OperationBilling/Activator/Base/BtnToggleLock.vue", "pages/operation-results/[id].vue", "pages/billings/operations/[id].vue"]) {
    const { descriptor, errors } = parse(await source(path), { filename: path }); assert.deepEqual(errors, []);
    const compiled = compileScript(descriptor, { id: path });
    const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: compiled.bindings } });
    assert.deepEqual(template.errors, [], path);
  }
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

for (const terminal of ["missing", "error", "claim"]) test(`row reader ${terminal} revokes raw/draft together and ignores the old save response`, async () => {
  let finish;
  const state = await editorHarness({ call: () => new Promise((resolve) => { finish = resolve; }) });
  const listeners = [], props = Vue.reactive({ documentId: "operation" });
  const make = await factory("composables/application/operation/useOperationRows.js", "useOperationRows", {
    ...Vue, useAuthStore: () => state.auth, useNuxtApp: () => ({ $firestore: {} }), doc: (_, path) => ({ path }),
    onSnapshot: (_, next, error) => { const entry = { next, error, stopped: false }; listeners.push(entry); return () => { entry.stopped = true; }; },
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

test("actual Draggable schedules carries raw through reorder and restores the shown order on refusal", async () => {
  const auth = Vue.reactive({ uid: "actor", companyId: "company" }), scope = "company/actor";
  const { operationPresentation } = await factory("composables/domain/operation/operationPresentation.js", "({ operationPresentation })", { ...Vue, operationRawFor, restoreOperationRaw });
  const make = await factory("components/Draggable/OperationSchedules/useIndex.js", "useIndex", { Vue, SiteOperationSchedule, inheritOperationRaw, operationPresentation, useAuthStore: () => auth, createDraggableFallbackOptions: () => ({}) });
  const context = createOperationRawContext(); context.reset(scope);
  const raws = [operation(), { ...operation(), docId: "other", displayOrder: 1 }];
  const models = raws.map((raw) => { const model = new SiteOperationSchedule(raw); context.remember(model, raw); return model; });
  const props = Vue.reactive({ schedules: models, disabled: false });
  const effect = Vue.effectScope(); let drag, emitted; effect.run(() => { drag = make(props, (_, value) => { emitted = value; }); });
  const copies = drag.attrs.value.modelValue; assert.strictEqual(operationRawFor(copies[0], scope), raws[0]);
  drag.attrs.value["onUpdate:modelValue"]([copies[1], copies[0]]);
  assert.deepEqual(emitted.map((item) => item.docId), ["other", "operation"]); assert.deepEqual(drag.attrs.value.modelValue.map((item) => item.docId), ["other", "operation"]);
  assert.strictEqual(operationRawFor(emitted[0], scope), raws[1]);
  const state = operationPresentation(models[0], scope); state.blocked = true; state.revision++; await flush();
  assert.deepEqual(drag.attrs.value.modelValue.map((item) => item.docId), ["operation", "other"]); assert.equal(drag.attrs.value.disabled, true);
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
