import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const CUSTOMER_SFCS = Object.freeze([
  "components/Customer/CreateDialog.vue",
  "components/Customer/Editor/Base.vue",
  "components/Customer/Editor/Payment.vue",
  "components/Customer/Autocomplete.vue",
  "components/Customer/Activator/Base.vue",
  "components/Customer/Activator/Payment.vue",
  "pages/customers/index.vue",
  "pages/customers/[id].vue",
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("Customer SFCs parse and compile after retiring the generic managers", async () => {
  for (const path of CUSTOMER_SFCS) {
    const url = new URL(`../../${path}`, import.meta.url);
    const content = await readFile(url, "utf8");
    const { descriptor, errors } = parse(content, { filename: url.pathname });
    assert.deepEqual(errors, [], `${path} parse errors`);
    compileScript(descriptor, { id: path.replaceAll(/[^a-z0-9]/giu, "-") });
    const compiled = compileTemplate({
      id: path.replaceAll(/[^a-z0-9]/giu, "-"),
      filename: url.pathname,
      source: descriptor.template.content,
    });
    assert.deepEqual(compiled.errors, [], `${path} template errors`);
  }

  for (const retired of [
    "components/Customer/Manager/index.vue",
    "components/Customers/Manager/index.vue",
  ]) {
    await assert.rejects(() => access(new URL(`../../${retired}`, import.meta.url)));
  }
});

test("Customer source no longer routes create or update through AirItemManager, AirArrayManager, or useBaseManager", async () => {
  const sources = await Promise.all(CUSTOMER_SFCS.map(source));
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /AirItemManager|AirArrayManager|useBaseManager/u);
  assert.doesNotMatch(combined, /<CustomerManager|<CustomersManager/u);
  assert.doesNotMatch(combined, /includedKeys|excludedKeys/u);
});

test("Customer list and autocomplete share the dedicated create dialog", async () => {
  const [listPage, autocomplete] = await Promise.all([
    source("pages/customers/index.vue"),
    source("components/Customer/Autocomplete.vue"),
  ]);
  assert.match(listPage, /<CustomerCreateDialog v-if="canWrite">/u);
  assert.match(autocomplete, /<CustomerCreateDialog @created="onCreateHandler">/u);
  assert.match(autocomplete, /const emitValue = props\.returnObject/u);
  assert.match(autocomplete, /emit\("update:model-value", emitValue\)/u);
});

test("Customer detail exposes dedicated basic and payment editors without archive or delete controls", async () => {
  const detail = await source("pages/customers/[id].vue");
  assert.match(detail, /<CustomerEditorBase :customer="customerInstance">/u);
  assert.match(detail, /<CustomerEditorPayment :customer="customerInstance">/u);
  assert.match(detail, /:editable="canWrite"/u);
  assert.doesNotMatch(detail, /削除|toDelete|handleDelete|Customers_archive/u);
});

test("Customer basic form includes address and both editors implement reload-only conflict handling", async () => {
  const [operations, basic, payment] = await Promise.all([
    source("composables/domain/customer/customerOperations.js"),
    source("components/Customer/Editor/Base.vue"),
    source("components/Customer/Editor/Payment.vue"),
  ]);
  assert.match(
    operations,
    /CUSTOMER_BASIC_FIELDS[\s\S]*?"address"/u,
  );
  for (const editor of [basic, payment]) {
    assert.match(editor, /const draft = ref\(null\)/u);
    assert.match(editor, /const baseline = ref\(null\)/u);
    assert.match(editor, /hasExternalChanges/u);
    assert.match(editor, /最新値を読み直す/u);
    assert.match(
      editor,
      /:disabled="isSaving \|\| isWaitingForRollback \|\| hasExternalChanges \|\| !canWrite"/u,
    );
    assert.doesNotMatch(editor, /上書き|last-write|confirmOverwrite/u);
  }
});

test("Customer edit controls are absent for read-only users", async () => {
  for (const path of [
    "components/Customer/Activator/Base.vue",
    "components/Customer/Activator/Payment.vue",
  ]) {
    const content = await source(path);
    assert.match(content, /editable: \{ type: Boolean, default: false \}/u);
    assert.match(content, /<template v-if="props\.editable" #append>/u);
  }
});
