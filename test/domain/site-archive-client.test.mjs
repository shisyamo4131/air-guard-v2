import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import test from "node:test";

test("Site Managers compile and expose standard delete only in archive mode", async () => {
  for (const path of ["components/Site/Manager/index.vue", "components/Sites/Manager/index.vue", "pages/sites/[id].vue"]) {
    const code = await readFile(new URL("../../" + path, import.meta.url), "utf8");
    const { descriptor, errors } = parse(code, { filename: path });
    assert.deepEqual(errors, []);
    const script = compileScript(descriptor, { id: path });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
  }
  const [single, plural, detail] = await Promise.all([
    readFile(new URL("../../components/Site/Manager/index.vue", import.meta.url), "utf8"),
    readFile(new URL("../../components/Sites/Manager/index.vue", import.meta.url), "utf8"),
    readFile(new URL("../../pages/sites/[id].vue", import.meta.url), "utf8"),
  ]);
  assert.match(single, /archiveMode|handleDelete|draft\.delete/u);
  assert.match(plural, /disable-delete|hide-delete-btn|rejectDirectDelete/u);
  assert.doesNotMatch(plural, /:handle-delete="handleDelete"/u);
  assert.match(detail, /toDelete|@click="\(\) => toDelete\(\)"/u);
});

test("Site detail uses the real Manager delete handler and navigates only after a successful draft delete", async () => {
  const manager = await readFile(new URL("../../components/Site/Manager/index.vue", import.meta.url), "utf8");
  const single = manager;
  const detail = await readFile(new URL("../../pages/sites/[id].vue", import.meta.url), "utf8");
  assert.match(single, /defineEmits\(\["created", "updated", "delete"\]\)/u);
  assert.match(single, /@delete="emit\('delete', \$event\)"/u);
  assert.match(detail, /@delete="handleDeleted"/u);
  assert.match(detail, /function handleDeleted\(\)[\s\S]*?navigateTo\("\/sites"\)/u);
  const script = manager.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  const factory = new Function("Site", "defineOptions", "defineProps", "defineEmits", "useBaseManager", `${script.replace(/^import[^;]+;\r?\n/gmu, "")}; return { handleDelete };`);
  const methods = factory(class Site {}, () => {}, () => ({}), () => () => {}, () => ({ attrs: {} }));
  let writes = 0;
  const draft = { docId: "site-a", async delete() { writes++; throw new Error("blocked"); } };
  await assert.rejects(methods.handleDelete(draft), /blocked/u);
  assert.equal(writes, 1);
  assert.equal(draft.docId, "site-a");
});
