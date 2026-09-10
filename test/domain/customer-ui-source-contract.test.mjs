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

function stripImports(value) {
  return value.replace(/^import[\s\S]*?;\r?\n/gmu, "");
}

async function customerManagerHarness() {
  const component = await source("components/Customer/Manager/index.vue");
  const script = component.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  let sequence = 0;
  let createFailure = null;
  let updateRequest = null;
  const events = [];
  const auth = { companyId: "company-a", uid: "actor-a" };
  class CustomerOperationError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  class Customer {
    constructor(raw = {}) {
      this.instanceNumber = ++sequence;
      this.initialize(raw);
    }
    initialize(raw = {}) {
      Object.assign(this, raw);
    }
    toObject() {
      return { ...this };
    }
  }
  const props = {
    doc: new Customer({ docId: "listener-customer" }),
    includedKeys: ["name"],
    title: "取引先の新規登録",
  };
  const factory = new Function(
    "Customer",
    "CustomerOperationError",
    "captureCustomerCreationScope",
    "computed",
    "defineEmits",
    "defineProps",
    "initializeCommittedCustomerDraft",
    "useAuthStore",
    "useBaseManager",
    "useCustomerActions",
    `${stripImports(script)}; return { beforeEdit, handleCreate, handleCreated, handleUpdate, toCreate };`,
  );
  const methods = factory(
    Customer,
    CustomerOperationError,
    (value) => Object.freeze({ companyId: value.companyId, uid: value.uid }),
    (getter) => ({ get value() { return getter(); } }),
    () => (...args) => events.push(args),
    () => props,
    (draft, created) => {
      if (!created?.docId) return false;
      draft.initialize(created.toObject());
      return true;
    },
    () => auth,
    () => ({ attrs: {} }),
    () => ({
      canWrite: { value: true },
      createCustomer: async () => {
        if (createFailure) throw createFailure;
        return new Customer({ docId: "generated-customer" });
      },
      isSaving: { value: false },
      updateCustomer: async (request) => {
        updateRequest = request;
      },
    }),
  );
  return {
    ...methods,
    Customer,
    CustomerOperationError,
    auth,
    events,
    listenerDoc: props.doc,
    getUpdateRequest: () => updateRequest,
    failCreate(error) {
      createFailure = error;
    },
  };
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

test("CustomerManager keeps detail updates and owns single-instance create", async () => {
  const [detail, manager] = await Promise.all([
    source("pages/customers/[id].vue"),
    source("components/Customer/Manager/index.vue"),
  ]);
  assert.match(detail, /<CustomerManager/u);
  assert.match(manager, /<air-item-manager/u);
  assert.match(manager, /useCustomerActions/u);
  assert.match(manager, /updateCustomer/u);
  assert.match(manager, /createCustomer/u);
  assert.match(manager, /:handle-update=/u);
  assert.match(manager, /hide-delete-btn/u);
  assert.match(manager, /:handle-create="handleCreate"/u);
  assert.match(manager, /:handle-delete="rejectUnsupportedOperation"/u);
  assert.match(manager, /default: \(\) => new Customer\(\)/u);
  assert.match(
    manager,
    /function toCreate\(slotProps\)[\s\S]*?slotProps\.toCreate\(new Customer\(\)\)/u,
  );
  assert.match(manager, /:to-update="\(\) => slotProps\.toUpdate\(props\.doc\)"/u);
  assert.doesNotMatch(manager, /\boperation:\s*\{|openManager/u);
  assert.match(manager, /const creationScope = captureCustomerCreationScope\(auth\)/u);
  assert.match(manager, /initializeCommittedCustomerDraft\(draft, created\)/u);
  assert.match(manager, /emit\("created", created, creationScope\)/u);
  assert.match(manager, /function clearCreationScope\(\)/u);
  assert.match(manager, /catch \(error\)[\s\S]*?clearCreationScope\(\)[\s\S]*?throw error/u);
  assert.match(manager, /@quit="clearCreationScope"/u);
  assert.match(detail, /:included-keys="CUSTOMER_BASIC_FIELDS"/u);
  assert.match(detail, /:included-keys="CUSTOMER_PAYMENT_FIELDS"/u);
});

test("CustomerManager creates a fresh draft and emits only committed assigned-ID state", async () => {
  const harness = await customerManagerHarness();
  const opened = [];
  const slotProps = {
    toCreate: (item) => opened.push(item),
  };
  harness.toCreate(slotProps);
  harness.toCreate(slotProps);
  assert.equal(opened.length, 2);
  assert.equal(opened[0] instanceof harness.Customer, true);
  assert.equal(opened[1] instanceof harness.Customer, true);
  assert.notEqual(opened[0], opened[1]);

  await harness.handleCreate(opened[1]);
  harness.handleCreated(opened[1]);
  assert.deepEqual(harness.events, [
    [
      "created",
      opened[1],
      { companyId: "company-a", uid: "actor-a" },
    ],
  ]);
  assert.equal(opened[1].docId, "generated-customer");

  harness.handleCreated(opened[1]);
  assert.equal(harness.events.length, 1);
  const failure = new Error("synthetic failure");
  harness.failCreate(failure);
  await assert.rejects(() => harness.handleCreate(opened[0]), failure);
  harness.handleCreated(opened[0]);
  assert.equal(harness.events.length, 1);
});

test("CustomerManager delegates UPDATE to the listener document and rejects DELETE", async () => {
  const harness = await customerManagerHarness();
  const draft = new harness.Customer({ docId: "listener-customer", name: "draft" });

  assert.equal(harness.beforeEdit("UPDATE"), true);
  await harness.handleUpdate(draft);
  const request = harness.getUpdateRequest();
  assert.equal(request.draft, draft);
  assert.equal(request.latest(), harness.listenerDoc);
  assert.throws(() => harness.beforeEdit("DELETE"));
});

test("Customer autocomplete uses singular CREATE without nesting plural manager", async () => {
  const [autocomplete, singular, plural, bridge] = await Promise.all([
    source("components/Customer/Autocomplete.vue"),
    source("components/Customer/Manager/index.vue"),
    source("components/Customers/Manager/index.vue"),
    source("composables/application/customer/customerCreationBridge.js"),
  ]);
  assert.match(autocomplete, /<CustomerManager/u);
  assert.match(autocomplete, /:included-keys="CUSTOMER_CREATE_FIELDS"/u);
  assert.match(autocomplete, /title="取引先の新規登録"/u);
  assert.doesNotMatch(autocomplete, /<CustomersManager/u);
  assert.doesNotMatch(singular, /<CustomersManager/u);
  assert.doesNotMatch(plural, /<CustomerManager/u);
  assert.match(autocomplete, /function onCreateHandler\(event, creationScope\)/u);
  assert.match(autocomplete, /currentScope: captureCustomerCreationScope\(auth\)/u);
  assert.match(autocomplete, /#activator="\{ disabled, toCreate \}"/u);
  assert.match(autocomplete, /<v-icon v-if="!disabled" @click="toCreate">/u);
  assert.doesNotMatch(autocomplete, /operation="CREATE"|\bopen\b/u);
  assert.ok(bridge.indexOf("pushCustomer(created)") < bridge.indexOf("selectCustomer(created)"));
  assert.match(autocomplete, /const emitValue = props\.returnObject/u);
  assert.match(autocomplete, /emit\("update:model-value", emitValue\)/u);
});

test("Customer list dispatches rows through plural AirArrayManager beforeEdit", async () => {
  const [listPage, manager] = await Promise.all([
    source("pages/customers/index.vue"),
    source("components/Customers/Manager/index.vue"),
  ]);
  assert.match(listPage, /<CustomersManager/u);
  assert.match(listPage, /:before-edit="handleBeforeEdit"/u);
  assert.match(listPage, /#table="\{ items, canWrite, toCreate, toUpdate \}"/u);
  assert.match(listPage, /<CustomersDataTable[\s\S]*?:items="items"/u);
  assert.match(listPage, /@click="\(\) => toCreate\(\)"/u);
  assert.match(listPage, /@click:update="toUpdate"/u);
  assert.match(
    listPage,
    /function handleBeforeEdit\(editMode, item\)[\s\S]*?editMode !== "UPDATE"[\s\S]*?router\.push\(`\/customers\/\$\{item\.docId\}`\);[\s\S]*?return false;/u,
  );
  assert.match(manager, /<air-array-manager/u);
  assert.match(manager, /beforeEdit: \{ type: Function, default: undefined \}/u);
  assert.match(manager, /const externalDecision = await props\.beforeEdit\?\.\(editMode, item\)/u);
  assert.match(manager, /if \(externalDecision === false\) return false/u);
  assert.match(manager, /:schema="Customer"/u);
  assert.match(manager, /:included-keys="CUSTOMER_CREATE_FIELDS"/u);
  assert.match(manager, /:handle-create="handleCreate"/u);
  assert.match(manager, /:handle-update="rejectUnsupportedOperation"/u);
  assert.match(manager, /:handle-delete="rejectUnsupportedOperation"/u);
  assert.match(manager, /editMode === "UPDATE"/u);
  assert.match(manager, /initializeCommittedCustomerDraft\(draft, created\)/u);
  assert.match(manager, /maxWidth: 480/u);
  assert.match(manager, /class="fill-height"/u);
  assert.match(manager, /style="height: 100%"/u);
  assert.match(manager, /取引先の新規登録/u);
  assert.match(manager, /:to-create="\(\) => toCreate\(\)"/u);
  assert.doesNotMatch(manager, /<template #editor|<v-form/u);
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

test("Customer manager lets the base deep watch replace an editing draft from the listener", async () => {
  const [operations, manager, baseManager] = await Promise.all([
    source("composables/domain/customer/customerOperations.js"),
    source("components/Customer/Manager/index.vue"),
    source("air-vuetify-v3/src/composables/useItemManager.js"),
  ]);
  assert.match(
    operations,
    /CUSTOMER_BASIC_FIELDS[\s\S]*?"address"/u,
  );
  assert.match(manager, /:model-value="props\.doc"/u);
  assert.match(manager, /:item="props\.doc"/u);
  assert.doesNotMatch(manager, /stableSnapshot|syncFromListener|isEditing|\bwatch\(/u);
  assert.match(
    baseManager,
    /Vue\.watch\([\s\S]*?\(\) => props\.modelValue,[\s\S]*?internalItem\.value = _cloneObject\(v\)[\s\S]*?immediate: true, deep: true/u,
  );
  assert.doesNotMatch(manager, /hasExternalChanges|isWaitingForRollback|reloadLatest/u);
  assert.doesNotMatch(manager, /最新値を読み直す|競合|confirmOverwrite/u);
});

test("Customer managers use the base editor validation and common error pipeline", async () => {
  const [manager, plural, airItemManager, airArrayManager, editCard, baseManager] =
    await Promise.all([
      source("components/Customer/Manager/index.vue"),
      source("components/Customers/Manager/index.vue"),
      source("air-vuetify-v3/src/AirItemManager.vue"),
      source("air-vuetify-v3/src/AirArrayManager.vue"),
      source("air-vuetify-v3/src/AirEditCard.vue"),
      source("composables/useBaseManager.js"),
    ]);

  assert.match(
    manager,
    /:dialog-props="\{[\s\S]*?maxWidth: 480,[\s\S]*?persistent: true,[\s\S]*?scrollable: true,[\s\S]*?'aria-label': props\.title,[\s\S]*?\}"/u,
  );
  assert.match(plural, /maxWidth: 480/u);
  for (const wrapper of [manager, plural]) {
    assert.doesNotMatch(
      wrapper,
      /<template #editor|<template #input-header|<v-form|custom-input|errorMessage/u,
    );
    assert.match(wrapper, /v-bind=(?:"attrs"|"\{ \.\.\.\$attrs, \.\.\.attrs \}")/u);
  }
  assert.match(baseManager, /const logger = useLogger\(composableName, useErrorsStore\(\)\)/u);
  assert.match(baseManager, /onError: \(e\) => logger\.error\(\{ error: e \}\)/u);
  assert.match(baseManager, /"onError:clear": logger\.clearError/u);
  assert.match(airItemManager, /<air-edit-card v-bind="editorAttrs">/u);
  assert.match(airArrayManager, /<air-edit-card v-bind="editorAttrs">/u);
  assert.match(editCard, /<v-form[\s\S]*?ref="form"[\s\S]*?:disabled="disabled"/u);
  assert.match(
    editCard,
    /const \{ valid \} = await form\.value\.validate\(\);[\s\S]*?if \(isValid\) emit\("click:submit"\)/u,
  );
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
