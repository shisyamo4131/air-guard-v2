import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Customer detail uses explicit manager delete, while list manager disables delete and both SFCs compile", async () => {
  const files = ["components/Customer/Manager/index.vue", "components/Customers/Manager/index.vue", "pages/customers/[id].vue", "pages/customers/index.vue"];
  for (const path of files) {
    const code = await source(path); const { descriptor, errors } = parse(code, { filename: path });
    assert.deepEqual(errors, [], path); const script = compileScript(descriptor, { id: path });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, [], path);
  }
  const manager = await source("components/Customer/Manager/index.vue");
  const plural = await source("components/Customers/Manager/index.vue");
  const detail = await source("pages/customers/[id].vue");
  assert.match(manager, /async function handleDelete\(draft\)[\s\S]*?return await draft\.delete\(\)/u);
  assert.match(manager, /archiveMode: \{ type: Boolean, default: false \}/u);
  assert.match(manager, /if \(editMode === "DELETE" && !props\.archiveMode\)/u);
  assert.match(manager, /:disable-delete="!props\.archiveMode"/u);
  assert.match(manager, /:hide-delete-btn="!props\.archiveMode"/u);
  assert.match(manager, /:handle-delete="handleDelete"/u);
  assert.match(plural, /disable-delete/u); assert.doesNotMatch(plural, /handleDelete|:handle-delete=/u);
  assert.equal((detail.match(/<CustomerManager/gu) ?? []).length, 3);
  assert.equal((detail.match(/archive-mode/gu) ?? []).length, 1);
  assert.match(detail, /@click="\(\) => toDelete\(\)"/u); assert.match(detail, /@delete="handleDeleted"/u);
});

test("Customer manager delete harness keeps cancel write-free, preserves draft on failure, and navigates only after success", async () => {
  let deletes = 0, fail = true, navigations = 0;
  const draft = { docId: "customer", async delete() { deletes++; if (fail) throw new Error("blocked"); } };
  const cancel = () => undefined;
  cancel(); assert.equal(deletes, 0);
  await assert.rejects(draft.delete(), /blocked/u); assert.equal(deletes, 1); assert.equal(draft.docId, "customer");
  fail = false; await draft.delete(); navigations++; assert.equal(deletes, 2); assert.equal(navigations, 1);
});

test("Customer Manager delete handler executes the real SFC script against the draft instance", async () => {
  const component = await source("components/Customer/Manager/index.vue");
  const script = component.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  const factory = new Function(
    "Customer", "defineOptions", "defineProps", "defineEmits", "useBaseManager",
    `${script.replace(/^import[^;]+;\r?\n/gmu, "")}; return { handleDelete };`,
  );
  const methods = factory(
    class Customer {}, () => {}, () => ({}), () => () => {}, () => ({ attrs: {} }),
  );
  let writes = 0;
  const draft = { docId: "customer", async delete() { writes++; throw new Error("blocked"); } };
  await assert.rejects(methods.handleDelete(draft), /blocked/u);
  assert.equal(writes, 1);
  assert.equal(draft.docId, "customer");
});
