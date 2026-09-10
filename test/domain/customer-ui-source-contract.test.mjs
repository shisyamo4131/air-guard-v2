import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const CUSTOMER_SFCS = Object.freeze([
  "components/Customer/Manager/index.vue",
  "components/Customer/Autocomplete.vue",
  "components/Customer/Activator/Base.vue",
  "components/Customer/Activator/Payment.vue",
  "components/Customer/ArchiveDialog.vue",
  "components/Customers/Manager/index.vue",
  "components/Customers/DataTable/index.vue",
  "pages/customers/index.vue",
  "pages/customers/[id].vue",
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("Customer SFCs parse and compile with the detail AirItemManager wrapper", async () => {
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

test("Customer detail routes normal updates through its AirItemManager wrapper", async () => {
  const [detail, manager] = await Promise.all([
    source("pages/customers/[id].vue"),
    source("components/Customer/Manager/index.vue"),
  ]);
  assert.match(detail, /<CustomerManager/u);
  assert.match(manager, /<air-item-manager/u);
  assert.match(manager, /useCustomerActions/u);
  assert.match(manager, /updateCustomer/u);
  assert.match(manager, /:handle-update=/u);
  assert.match(manager, /hide-delete-btn/u);
  assert.match(manager, /:handle-create="rejectUnsupportedOperation"/u);
  assert.match(manager, /:handle-delete="rejectUnsupportedOperation"/u);
  assert.match(manager, /editMode !== "UPDATE"/u);
  assert.match(detail, /:included-keys="CUSTOMER_BASIC_FIELDS"/u);
  assert.match(detail, /:included-keys="CUSTOMER_PAYMENT_FIELDS"/u);
});

test("Customer list and autocomplete share the plural AirArrayManager create entry", async () => {
  const [listPage, autocomplete, manager, bridge] = await Promise.all([
    source("pages/customers/index.vue"),
    source("components/Customer/Autocomplete.vue"),
    source("components/Customers/Manager/index.vue"),
    source("composables/application/customer/customerCreationBridge.js"),
  ]);
  assert.match(listPage, /<CustomersManager :docs="customerInstance\.docs">/u);
  assert.match(listPage, /#table="\{ items, canWrite, toCreate \}"/u);
  assert.match(listPage, /<CustomersDataTable[\s\S]*?:items="items"/u);
  assert.match(listPage, /@click="\(\) => toCreate\(\)"/u);
  assert.match(autocomplete, /<CustomersManager hide-table @created="onCreateHandler">/u);
  assert.match(manager, /<air-array-manager/u);
  assert.match(manager, /:schema="Customer"/u);
  assert.match(manager, /:included-keys="CUSTOMER_CREATE_FIELDS"/u);
  assert.match(manager, /:handle-create="handleCreate"/u);
  assert.match(manager, /:handle-update="rejectUnsupportedOperation"/u);
  assert.match(manager, /:handle-delete="rejectUnsupportedOperation"/u);
  assert.match(manager, /editMode !== "CREATE"/u);
  assert.match(
    manager,
    /const creationScope = captureCustomerCreationScope\(auth\);[\s\S]*?const created = await createCustomer\(draft\);[\s\S]*?initializeCommittedCustomerDraft\(draft, created\)/u,
  );
  assert.match(manager, /@create="handleCreated"/u);
  assert.match(manager, /emit\("created", created, creationScope\)/u);
  assert.match(manager, /maxWidth: 480/u);
  assert.match(manager, /class="fill-height"/u);
  assert.match(manager, /style="height: 100%"/u);
  assert.match(manager, /取引先の新規登録/u);
  assert.match(manager, /キャンセル/u);
  assert.match(manager, /登録/u);
  assert.match(autocomplete, /function onCreateHandler\(event, creationScope\)/u);
  assert.match(autocomplete, /currentScope: captureCustomerCreationScope\(auth\)/u);
  assert.match(autocomplete, /#activator="\{ disabled, open \}"/u);
  assert.match(autocomplete, /<v-icon v-if="!disabled" @click="open">/u);
  assert.ok(bridge.indexOf("pushCustomer(created)") < bridge.indexOf("selectCustomer(created)"));
  assert.match(autocomplete, /const emitValue = props\.returnObject/u);
  assert.match(autocomplete, /emit\("update:model-value", emitValue\)/u);
  assert.doesNotMatch(manager, /props\.docs\.(?:push|splice)|docs\.(?:push|splice)/u);
  assert.doesNotMatch(manager, /@update:model-value|emit\("update:model-value"/u);
  await assert.rejects(
    access(new URL("../../components/Customer/CreateDialog.vue", import.meta.url)),
    (error) => error?.code === "ENOENT",
  );
});

test("Customer detail exposes manager-backed editors and a write-authorized archive action", async () => {
  const [detail, dialog] = await Promise.all([
    source("pages/customers/[id].vue"),
    source("components/Customer/ArchiveDialog.vue"),
  ]);
  assert.ok((detail.match(/<CustomerManager/gu) ?? []).length >= 2);
  assert.match(detail, /<CustomerActivatorBase/u);
  assert.match(detail, /<CustomerActivatorPayment/u);
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
  const archivePaths = [
    "components/Customer/ArchiveDialog.vue",
    "composables/application/customer/useCustomerArchiveAction.js",
    "composables/customer/useCustomerFunctions.js",
    "composables/domain/customer/customerArchiveUiContract.js",
  ];
  const [detail, ...archiveSources] = await Promise.all([
    source("pages/customers/[id].vue"),
    ...archivePaths.map(source),
  ]);
  const archiveCombined = archiveSources.join("\n");
  const protectedCombined = [detail, archiveCombined].join("\n");
  assert.match(archiveCombined, /httpsCallable\(\$functions, "archiveCustomer"\)/u);
  assert.match(detail, /<CustomerManager/u);
  assert.doesNotMatch(protectedCombined, /Customers_archive/u);
  assert.doesNotMatch(protectedCombined, /from "firebase\/firestore"/u);
  assert.doesNotMatch(
    protectedCombined,
    /\b(?:deleteDoc|setDoc|updateDoc|addDoc|writeBatch)\s*\(|\.(?:delete|restore|toDelete)\s*\(/u,
  );
  assert.doesNotMatch(
    archiveCombined,
    /AirItemManager|AirArrayManager|useBaseManager/u,
  );
  assert.doesNotMatch(
    protectedCombined,
    /(?:cache|docs?)\.(?:push|splice)\s*\(/u,
  );
});

test("Customer manager keeps an edit snapshot and does not expose conflict reload handling", async () => {
  const [operations, manager] = await Promise.all([
    source("composables/domain/customer/customerOperations.js"),
    source("components/Customer/Manager/index.vue"),
  ]);
  assert.match(
    operations,
    /CUSTOMER_BASIC_FIELDS[\s\S]*?"address"/u,
  );
  assert.match(manager, /edit(?:ing)?Snapshot|editSnapshot|stableSnapshot/u);
  assert.match(manager, /stableSnapshot = shallowRef\(new Customer\(props\.doc\.toObject\(\)\)\)/u);
  assert.match(
    manager,
    /function openUpdate\(toUpdate\)[\s\S]*?syncFromListener\(\);[\s\S]*?toUpdate\(stableSnapshot\.value\)/u,
  );
  assert.match(
    manager,
    /watch\([\s\S]*?if \(!isEditing\.value\) syncFromListener\(\)/u,
  );
  assert.match(manager, /:model-value="stableSnapshot"/u);
  assert.match(manager, /@update:model-value="ignoreManagerModelValue"/u);
  assert.match(manager, /:item="props\.doc"/u);
  assert.doesNotMatch(manager, /hasExternalChanges|isWaitingForRollback|reloadLatest/u);
  assert.doesNotMatch(manager, /最新値を読み直す|競合|confirmOverwrite/u);
});

test("Customer manager editor preserves the approved visual and submit contract", async () => {
  const manager = await source("components/Customer/Manager/index.vue");

  assert.match(manager, /<template #editor="editorAttrs">/u);
  assert.match(
    manager,
    /<v-form[\s\S]*?ref="editorForm"[\s\S]*?:disabled="editorAttrs\.disabled"[\s\S]*?@submit\.prevent="submitEditor\(editorAttrs\)"/u,
  );
  const submit = manager.slice(manager.indexOf("async function submitEditor"));
  assert.match(
    submit,
    /editorAttrs\.isLoading[\s\S]*?editorAttrs\.disabled[\s\S]*?editorAttrs\.disableSubmit[\s\S]*?return;/u,
  );
  assert.ok(
    submit.indexOf("await editorForm.value?.validate()") <
      submit.indexOf('await editorAttrs["onClick:submit"]()'),
  );
  assert.match(submit, /validation\.valid !== true\) return;/u);

  assert.match(
    manager,
    /:dialog-props="\{[\s\S]*?maxWidth: 480,[\s\S]*?persistent: true,[\s\S]*?scrollable: true,[\s\S]*?'aria-label': props\.title,[\s\S]*?\}"/u,
  );
  assert.match(manager, /<v-card :border="false">/u);
  assert.match(
    manager,
    /<v-toolbar[\s\S]*?color="secondary"[\s\S]*?density="compact"[\s\S]*?:title="props\.title"/u,
  );
  assert.match(
    manager,
    /<AtomsBtnsCancel[\s\S]*?type="button"[\s\S]*?:disabled="editorAttrs\.isLoading"[\s\S]*?@click="editorAttrs\['onClick:cancel'\]"/u,
  );
  assert.match(
    manager,
    /<AtomsBtnsSubmit[\s\S]*?type="submit"[\s\S]*?text="更新"[\s\S]*?:loading="editorAttrs\.isLoading"[\s\S]*?:disabled="editorAttrs\.disabled \|\| editorAttrs\.disableSubmit"/u,
  );
  assert.match(
    manager,
    /<v-alert[\s\S]*?v-if="editorAttrs\.errors\.length"[\s\S]*?type="error"[\s\S]*?variant="tonal"[\s\S]*?editorErrorMessage\(editorAttrs\.errors\)/u,
  );
  assert.match(
    manager,
    /error instanceof CustomerOperationError[\s\S]*?error\.message[\s\S]*?取引先情報を更新できませんでした。/u,
  );
  assert.match(manager, /<air-item-input v-bind="editorAttrs\.inputProps" \/>/u);
  assert.doesNotMatch(manager, /<v-chip|mdi-(?:pencil|close)|close-icon/u);
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
