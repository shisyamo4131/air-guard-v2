import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Vue from "vue";
import * as Schemas from "@shisyamo4131/air-guard-v2-schemas";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { compile } from "@vue/compiler-dom";
import { renderToString } from "@vue/server-renderer";
import { rawForClass } from "../../functions/shared/employeeContract.js";
import { formatNumber } from "../../utils/formats/util.js";
import { employeeReadLabel } from "../../composables/domain/employee/employeeReadLabel.js";

const source = (file) => readFile(new URL(`../../${file}`, import.meta.url), "utf8");
const dialogs = ["Employee/Certifications/Manager/index.vue", "Insurance/Transition/Manager.vue"];
const managerDialogs = ["ArrangementNotifications/Manager/index.vue", "ArrangementNotification/Manager/toLeaved.vue"];
async function setup(file, supplied, returns) {
  const { descriptor } = parse(await source(file));
  const code = descriptor.scriptSetup.content.replace(/import[\s\S]*?;\s*/gu, "");
  const bindings = { ...Vue, ...Schemas, rawForClass, defineOptions() {}, defineExpose() {}, defineEmits: () => () => {}, ...supplied };
  return new Function(...Object.keys(bindings), `${code}; return { ${returns} };`)(...Object.values(bindings));
}
test("editor dialogs scroll the card body while title/actions remain outside it; all changed SFCs compile", async () => {
  for (const file of [...dialogs, ...managerDialogs, "SiteOperationSchedule/Duplicator/index.vue", "Employees/Manager/index.vue", "Operation/ArticlesManager.vue", "OperationBilling/Manager/index.vue", "OperationBillings/Manager/index.vue", "Workers/DataTable/index.vue", "ArticleDetails/DataTable/index.vue", "Employee/Autocomplete.vue"]) {
    const path = `components/${file}`, { descriptor, errors } = parse(await source(path), { filename: path });
    assert.deepEqual(errors, []);
    const script = compileScript(descriptor, { id: path });
    assert.doesNotMatch(script.content, /\bdefineProps\s*\(/u);
    const output = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } });
    assert.deepEqual(output.errors, [], path);
    if (dialogs.includes(file)) {
      const root = compile(descriptor.template.content).ast;
      const find = (node, tag) => [node, ...(node.children || []).flatMap((child) => find(child, tag))].filter((child) => child.tag === tag);
      const dialog = find(root, "v-dialog")[0]; assert.ok(dialog.props.some((prop) => prop.name === "scrollable"), file);
      const card = find(dialog, "v-card")[0], body = card.children.find((node) => node.tag === "v-card-text"), actions = card.children.find((node) => node.tag === "v-card-actions");
      assert.ok(body && actions, file); assert.equal(find(body, "v-card-actions").length, 0);
      if (file.includes("Duplicator")) assert.equal(find(body, "v-date-picker").length, 1);
    }
  }
  const pluralManager = await source("components/ArrangementNotifications/Manager/index.vue");
  const leavedManager = await source("components/ArrangementNotification/Manager/toLeaved.vue");
  assert.match(pluralManager, /<air-array-manager\b/u);
  assert.match(pluralManager, /disable-delete/u);
  assert.match(pluralManager, /hide-delete-btn/u);
  assert.match(leavedManager, /<air-item-manager\b/u);
  assert.match(leavedManager, /disable-delete/u);
  assert.match(leavedManager, /hide-delete-btn/u);
  assert.match(await source("components/Operation/ArticlesManager.vue"), /ArticleDetailsManager/u);
  for (const file of ["pages/employees/index.vue", "pages/employees/resigned.vue"]) assert.match(await source(file), /class="d-flex flex-column flex-grow-1 overflow-hidden"/u);
});
test("standard ArticlesManager keeps articleId as the row identity for duplicate article IDs", async () => {
  const manager = await source("components/ArticleDetails/Manager/index.vue");
  const articles = await source("components/Operation/ArticlesManager.vue");
  assert.match(manager, /itemKey: \{[^}]*default: "articleId"/u);
  assert.match(manager, /:item-key="props\.itemKey"/u);
  assert.match(articles, /activeRowKey/u);
  assert.match(articles, /item-key="_airGuardRowKey"/u);
  assert.match(articles, /key === activeRowKey\.value/u);
  assert.match(articles, /key !== rowKey/u);
});
test("existing table wrappers render their defaults and forward custom actions exactly once", async () => {
  for (const file of ["components/Workers/DataTable/index.vue", "components/ArticleDetails/DataTable/index.vue"]) {
    const { descriptor } = parse(await source(file));
    const render = new Function("Vue", compile(descriptor.template.content, { mode: "function", prefixIdentifiers: true }).code)(Vue);
    const item = { articleId: "article", price: 200, quantity: 3, isQualified: true, isOjt: true };
    let values;
    if (file.includes("Workers")) {
      const code = (await source("components/Workers/DataTable/useIndex.js")).replace(/import[\s\S]*?;\s*/gu, "").replace("export function", "function");
      const useIndex = new Function("Vue", "useFetch", "formatNumber", `${code}; return useIndex;`)(Vue, () => ({ fetchEmployeeComposable: { cachedEmployees: Vue.ref({}) }, fetchOutsourcerComposable: { cachedOutsourcers: Vue.ref({}) } }), formatNumber);
      values = await setup(file, { useIndex, OjtIcon: {} }, "attrs");
      assert.deepEqual(values.attrs.value.headers.map((header) => header.title), ["名前", "開始", "終了", "休憩", "残業", "OJT"]);
      assert.equal(values.attrs.value.headers[3].value({ breakMinutes: 60 }), "1 時間");
      assert.equal(values.attrs.value.headers[4].value({ overtimeWorkMinutes: 30 }), "0.5 時間");
    } else values = await setup(file, { defineProps: () => ({ items: [item] }), useDefaults: (props) => props, useFetch: () => ({ fetchArticleComposable: { cachedArticles: Vue.ref({ article: { code: "C01", name: "合成商品" } }) } }) }, "props,cachedArticles,headers,total");
    const table = { setup(_, { slots }) { return () => Vue.h("div", Object.values(slots).flatMap((slot) => slot({ item, value: "合成氏名" }))); } };
    const component = { render, components: { AirDataTable: table, OjtIcon: { render: () => Vue.h("i", "OJT") }, AtomsIconsHasLicense: { render: () => Vue.h("i", "資格") } }, setup: () => values };
    const html = await renderToString(Vue.createSSRApp({ render: () => Vue.h(component, {}, { "item.actions": () => Vue.h("button", "編集と削除") }) }));
    assert.equal(html.split("編集と削除").length - 1, 1);
    if (file.includes("Workers")) { assert.match(html, /合成氏名/u); assert.match(html, /資格/u); assert.match(html, /OJT/u); }
    else { for (const value of ["C01", "合成商品", "200", "600", "合計"]) assert.ok(html.includes(value), value); }
  }
});
test("worker table keeps the actual WorkerChip status labels and refetches after read scope recovery", async () => {
  const chipSource = await source("components/Worker/Chip.vue");
  const { descriptor, errors } = parse(chipSource, { filename: "components/Worker/Chip.vue" });
  assert.deepEqual(errors, []);
  const compiled = compileScript(descriptor, { id: "worker-chip" });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: "components/Worker/Chip.vue", id: "worker-chip", compilerOptions: { bindingMetadata: compiled.bindings } }).errors, []);
  assert.match(chipSource, /employeeReadLabel/u);
  const calls = [], stops = [], state = Vue.ref("ready"), scope = Vue.ref("company-a"), cache = Vue.ref({ employee: { displayName: "旧氏名" } });
  const reader = { scope, cachedEmployees: cache, fetchEmployee: (id) => calls.push([scope.value, id]), getStatus: () => state.value };
  const worker = new Schemas.OperationResultDetail({ id: "employee", isEmployee: true });
  const actual = await setup("components/Worker/Chip.vue", { defineProps: () => ({ worker }), useDefaults: (props) => props, employeeReadLabel,
    useFetch: () => ({ fetchEmployeeComposable: reader, fetchOutsourcerComposable: { cachedOutsourcers: Vue.ref({}), fetchOutsourcer() {} } }),
    watch: (...args) => { const stop = Vue.watch(...args); stops.push(stop); return stop; } }, "displayName");
  assert.equal(actual.displayName.value, "旧氏名"); assert.deepEqual(calls, [["company-a", "employee"]]);
  cache.value = {}; scope.value = null;
  for (const [status, text] of [["denied", "閲覧不可"], ["missing", "従業員情報なし"], ["error", "取得失敗"], ["loading", "読込中"]]) { state.value = status; assert.equal(actual.displayName.value, text); }
  await Vue.nextTick(); scope.value = "company-b"; await Vue.nextTick();
  assert.deepEqual(calls.at(-1), ["company-b", "employee"]);
  cache.value = { employee: { displayName: "再取得した氏名" } }; state.value = "ready"; assert.equal(actual.displayName.value, "再取得した氏名");
  for (const stop of stops) stop();
});
