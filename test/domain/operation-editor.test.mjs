import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import * as Vue from "vue";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { OperationBilling, OperationResult } from "@shisyamo4131/air-guard-v2-schemas";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

async function loadArticlesHarness(doc) {
  const code = (await source("components/Operation/ArticlesManager.vue"))
    .match(/<script setup>([\s\S]*?)<\/script>/u)[1]
    .replace(/import[\s\S]*?;\s*/gu, "");
  const props = Vue.reactive({ doc });
  const bindings = { ...Vue, ArticleDetail: (await import("@shisyamo4131/air-guard-v2-schemas")).ArticleDetail, OperationBilling, OperationResult, defineOptions() {}, defineProps: () => props };
  const scope = Vue.effectScope(); let actual;
  scope.run(() => { actual = new Function(...Object.keys(bindings), `${code}; return { props, rows, activeRowKey, busy, error, disabled, displayArticles, beforeEdit, clearEditing, handleCreate, handleUpdate, handleDelete };`)(...Object.values(bindings)); });
  return { ...actual, scope };
}

async function loadLockHarness(item) {
  const code = (await source("components/OperationBilling/Activator/Base/BtnToggleLock.vue"))
    .match(/<script setup>([\s\S]*?)<\/script>/u)[1]
    .replace(/import[\s\S]*?;\s*/gu, "");
  const props = Vue.reactive({ item });
  const bindings = { ...Vue, OperationBilling, defineOptions() {}, defineProps: () => props };
  let actual;
  actual = new Function(...Object.keys(bindings), `${code}; return { props, busy, message, toggleLock };`)(...Object.values(bindings));
  return actual;
}

test("deleted operation-specific editor implementations are not part of the current contract", async () => {
  for (const path of [
    "components/Operation/ArrayManager.vue",
    "components/Operation/Editor.vue",
    "components/Operation/Manager.vue",
    "components/Operation/RowsManager.vue",
    "composables/application/operation/useOperationEditor.js",
  ]) await assert.rejects(access(new URL(`../../${path}`, import.meta.url)), undefined, path);
});

test("standard billing managers compile and expose update-only persistence", async () => {
  for (const path of ["components/OperationBilling/Manager/index.vue", "components/OperationBillings/Manager/index.vue"]) {
    const code = await source(path);
    const { descriptor, errors } = parse(code, { filename: path });
    assert.deepEqual(errors, [], path);
    const script = compileScript(descriptor, { id: path });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, [], path);
    assert.match(code, /draft\.update\(\{ transaction \}\)|draft\.update\(\)/u);
    assert.match(code, /disable-delete/u);
    assert.match(code, /disable-update.*document\?\.docId|disable-update.*item\?\.docId/u);
    assert.match(code, /handle-create="rejectUnsupportedOperation"/u);
    assert.match(code, /handle-delete="rejectUnsupportedOperation"/u);
    assert.doesNotMatch(code, /useOperationEditor|saveOperation|callable/iu);
  }
});

test("billing manager models retain standard uid metadata and class identity", () => {
  const billing = new OperationBilling({ docId: "billing", uid: "actor" });
  const result = new OperationResult({ docId: "result", uid: "actor" });
  assert.ok(billing instanceof OperationBilling);
  assert.ok(result instanceof OperationResult);
  assert.equal(billing.uid, "actor");
  assert.equal(result.uid, "actor");
  assert.ok(billing.clone() instanceof OperationBilling);
});

test("ArticlesManager compiles and persists cloned ArticleDetail rows through the parent model", async () => {
  const path = "components/Operation/ArticlesManager.vue";
  const code = await source(path);
  const { descriptor, errors } = parse(code, { filename: path });
  assert.deepEqual(errors, [], path);
  const script = compileScript(descriptor, { id: path });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, [], path);
  assert.match(code, /ArticleDetailsManager/u);
  assert.match(code, /function toArticleDetail\(item\)/u);
  assert.match(code, /const canonicalArticles = nextArticles\.map\(toArticleDetail\)/u);
  assert.match(code, /const draft = props\.doc\.clone\(\)/u);
  assert.match(code, /await draft\.update\(\)/u);
  assert.match(code, /activeRowKey/u);
  assert.match(code, /error\.value = cause\?\.message/u);
  assert.match(code, /OperationResult && props\.doc\.isLocked && !\(props\.doc instanceof OperationBilling\)/u);
  assert.doesNotMatch(code, /saveOperation|useOperationEditor|Callable/iu);
});

test("ArticlesManager preserves identity and recovery semantics in its source contract", async () => {
  const code = await source("components/Operation/ArticlesManager.vue");
  assert.match(code, /key === activeRowKey\.value/u);
  assert.match(code, /key !== rowKey/u);
  assert.match(code, /articles\.value = draft\.articles/u);
  assert.match(code, /finally \{\s*busy\.value = false;/u);
  assert.match(code, /disabled = computed\(\(\) => busy\.value \|\| !props\.doc\?\.docId/u);
});

test("billing lock toggle uses one standard clone-update operation with busy and error recovery", async () => {
  const path = "components/OperationBilling/Activator/Base/BtnToggleLock.vue";
  const code = await source(path);
  const { descriptor, errors } = parse(code, { filename: path });
  assert.deepEqual(errors, [], path);
  const script = compileScript(descriptor, { id: path });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, [], path);
  assert.match(code, /if \(busy\.value \|\| !props\.item\.docId\) return/u);
  assert.match(code, /const draft = props\.item\.clone\(\)/u);
  assert.match(code, /await draft\.toggleLock\(!draft\.isLocked\)/u);
  assert.match(code, /finally \{ busy\.value = false; \}/u);
  assert.doesNotMatch(code, /httpsCallable|saveOperation|Callable/iu);
});

test("operation pages connect the new ArticlesManager and do not call deleted operation editors", async () => {
  for (const path of ["pages/operation-results/[id].vue", "pages/billings/operations/[id].vue"]) {
    const code = await source(path);
    const { descriptor, errors } = parse(code, { filename: path });
    assert.deepEqual(errors, [], path);
    const script = compileScript(descriptor, { id: path });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, [], path);
    assert.match(code, /ArticlesManager/u, path);
    assert.doesNotMatch(code, /Operation(?:Array|Rows)?Manager|useOperationEditor/u, path);
  }
});

test("ArticlesManager executes duplicate-id row update/delete by stable non-persistent row key and preserves failed edits for retry", async () => {
  const calls = []; let fail = true;
  const doc = {
    docId: "result", articles: [{ articleId: "same", price: 100, quantity: 1 }, { articleId: "same", price: 200, quantity: 2 }],
    clone() { const draft = { articles: [], async update() { calls.push(draft.articles); if (fail) throw new Error("retry"); } }; return draft; },
  };
  const h = await loadArticlesHarness(doc);
  assert.equal(h.displayArticles.value.length, 2);
  assert.notEqual(h.displayArticles.value[0]._airGuardRowKey, h.displayArticles.value[1]._airGuardRowKey);
  assert.equal(Object.keys(h.displayArticles.value[0]).includes("_airGuardRowKey"), true);
  h.beforeEdit("UPDATE", h.displayArticles.value[1]);
  doc.articles = [{ articleId: "same", price: 999, quantity: 9 }, ...doc.articles];
  await Vue.nextTick();
  assert.equal(h.rows.value.length, 2, "external update is held while editing");
  await assert.rejects(h.handleUpdate({ ...h.displayArticles.value[1], price: 250 }), /retry/u);
  assert.equal(h.rows.value[1].item.price, 200, "failed update keeps the local edit source");
  fail = false;
  await h.handleUpdate({ ...h.displayArticles.value[1], price: 250 });
  assert.equal(calls.at(-1).length, 2);
  assert.equal(calls.at(-1)[1].price, 250);
  assert.equal(Object.hasOwn(calls.at(-1)[1], "_airGuardRowKey"), false);
  const writesBeforeCancel = calls.length;
  h.beforeEdit("DELETE", h.displayArticles.value[0]);
  await h.clearEditing();
  assert.equal(calls.length, writesBeforeCancel, "cancel does not write");
  h.scope.stop();
});

test("ArticlesManager rejects locked results but allows locked billings through the executable disabled guard", async () => {
  const result = new OperationResult({ docId: "result", isLocked: true });
  const billing = new OperationBilling({ docId: "billing", isLocked: true });
  const resultHarness = await loadArticlesHarness(result);
  const billingHarness = await loadArticlesHarness(billing);
  assert.equal(resultHarness.disabled.value, true);
  assert.equal(resultHarness.beforeEdit("UPDATE", { _airGuardRowKey: "x" }), false);
  assert.equal(billingHarness.disabled.value, false);
  assert.equal(billingHarness.beforeEdit("UPDATE", { _airGuardRowKey: "x" }), true);
  resultHarness.scope.stop(); billingHarness.scope.stop();
});

test("BtnToggleLock executes one guarded draft toggleLock call per click", async () => {
  let release; const calls = [];
  const item = { docId: "billing", isLocked: false, clone() { const draft = { isLocked: item.isLocked, async toggleLock(value) { calls.push(value); await new Promise((resolve) => { release = resolve; }); } }; return draft; } };
  const h = await loadLockHarness(item);
  const first = h.toggleLock(); const second = h.toggleLock();
  await Vue.nextTick();
  assert.equal(calls.length, 1); assert.equal(calls[0], true); assert.equal(h.busy.value, true);
  release(); await first; await second; assert.equal(h.busy.value, false);
});
