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
  "components/Customer/ArchiveDialog.vue",
  "components/Customers/DataTable/index.vue",
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

test("Customer status labels use the shared schema and selection remains status-independent", async () => {
  const [list, detail, table, autocomplete] = await Promise.all([
    source("pages/customers/index.vue"), source("components/Customer/Activator/Base.vue"),
    source("components/Customers/DataTable/index.vue"), source("components/Customer/Autocomplete.vue"),
  ]);
  for (const text of [list, detail, table]) {
    assert.match(text, /Customer\.STATUS/u);
  }
  assert.match(list, /v-model="selectedStatus"/u);
  assert.match(detail, /props\.item\.contractStatus/u);
  assert.match(table, /contractStatus/u);
  assert.doesNotMatch(autocomplete, /contractStatus|STATUS_ACTIVE|STATUS_TERMINATED/u);
  assert.match(autocomplete, /searchCustomers\(text, \{ returnAllCached: false \}\)/u);
  assert.match(autocomplete, /:fetchItemByKeyApi="getCustomer"/u);
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

test("Customer detail exposes dedicated editors and a write-authorized archive action", async () => {
  const [detail, dialog] = await Promise.all([
    source("pages/customers/[id].vue"),
    source("components/Customer/ArchiveDialog.vue"),
  ]);
  assert.match(detail, /<CustomerEditorBase :customer="customerInstance">/u);
  assert.match(detail, /<CustomerEditorPayment :customer="customerInstance">/u);
  assert.match(detail, /:editable="canWrite"/u);
  assert.match(
    detail,
    /<CustomerArchiveDialog[\s\S]*?v-if="canWrite"[\s\S]*?@archived="handleArchived"/u,
  );
  assert.match(detail, /router\.push\("\/customers"\)/u);

  for (const text of [
    "取引先コード",
    "取引先名",
    "誤登録・重複",
    "参照されている場合は実行できません",
    "通常画面から復元できません",
    "個人情報・認証情報などの不要な情報を入力しないでください",
    "キャンセル",
    "アーカイブする",
  ]) {
    assert.match(dialog, new RegExp(text, "u"));
  }
  assert.match(dialog, /理由は必須です/u);
  assert.match(dialog, /counter="200"/u);
  assert.match(dialog, /maxlength="200"/u);
  assert.match(dialog, /aria-label="閉じる"/u);
  assert.match(dialog, /<div v-if="canArchive">/u);
  assert.match(
    dialog,
    /const archiveBusy = computed\([\s\S]*?archiveSubmitting\.value \|\| archivePending\.value/u,
  );
  assert.match(dialog, /:persistent="archiveBusy"/u);
  assert.match(dialog, /:loading="archiveBusy"/u);
  assert.ok((dialog.match(/:disabled="archiveBusy"/gu) ?? []).length >= 4);
  assert.match(dialog, /v-if="failureMessage"[\s\S]*?\{\{ failureMessage \}\}/u);
  assert.match(dialog, /toCustomerArchiveUiError\(error\)\.message/u);
  assert.match(dialog, /messages\.add\("取引先をアーカイブしました。"\)/u);
  assert.match(dialog, /emit\("archived"\)/u);
  assert.match(
    dialog,
    /function resetDialog\(\)[\s\S]*?resetAttempt\(\)[\s\S]*?function openDialog/u,
  );
  assert.match(
    dialog,
    /function closeDialog\(\)[\s\S]*?resetDialog\(\)[\s\S]*?function handleDialogModel/u,
  );
  assert.ok((dialog.match(/@click="closeDialog"/gu) ?? []).length >= 2);
  assert.ok((dialog.match(/archiveBusy\.value/gu) ?? []).length >= 4);
  const submit = dialog.slice(dialog.indexOf("async function handleArchive()"));
  assert.match(
    submit,
    /if \(!target\.value \|\| archiveBusy\.value \|\| !canArchive\.value\) return;/u,
  );
  assert.ok(
    submit.indexOf("archiveSubmitting.value = true") <
      submit.indexOf("await form.value?.validate()"),
  );
  assert.match(
    submit,
    /finally \{[\s\S]*?archiveSubmitting\.value = false;[\s\S]*?\}/u,
  );
  assert.doesNotMatch(dialog, /useErrorsStore|console\.(?:error|warn|log)/u);
});

test("Customer archive client stays on the dedicated Callable without direct archive, delete, restore, or cache writes", async () => {
  const paths = [
    "pages/customers/[id].vue",
    "components/Customer/ArchiveDialog.vue",
    "composables/application/customer/useCustomerArchiveAction.js",
    "composables/customer/useCustomerFunctions.js",
    "composables/domain/customer/customerArchiveUiContract.js",
  ];
  const combined = (await Promise.all(paths.map(source))).join("\n");
  assert.match(combined, /httpsCallable\(\$functions, "archiveCustomer"\)/u);
  assert.doesNotMatch(combined, /Customers_archive/u);
  assert.doesNotMatch(combined, /from "firebase\/firestore"/u);
  assert.doesNotMatch(
    combined,
    /\b(?:deleteDoc|setDoc|updateDoc|addDoc|writeBatch)\s*\(|\.(?:delete|restore|toDelete)\s*\(|AirItemManager|AirArrayManager|useBaseManager/u,
  );
  assert.doesNotMatch(combined, /(?:cache|docs?)\.(?:push|splice)\s*\(/u);
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
