import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import * as Vue from "vue";
import { useCloneObject } from "../../air-vuetify-v3/src/composables/useCloneObject.js";
import { useEditModes } from "../../air-vuetify-v3/src/composables/useEditModes.js";
import { useErrors } from "../../air-vuetify-v3/src/composables/useErrors.js";

const CUSTOMER_SFCS = Object.freeze([
  "components/Customer/Manager/index.vue",
  "components/Customer/Autocomplete.vue",
  "components/Customer/Activator/Base.vue",
  "components/Customer/Activator/Payment.vue",
  "components/Customers/Manager/index.vue",
  "components/Customers/DataTable/index.vue",
  "pages/customers/index.vue",
  "pages/customers/[id].vue",
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function elements(node, tag) {
  const found = [];
  if (node?.type === 1 && node.tag === tag) found.push(node);
  for (const child of node?.children ?? []) {
    found.push(...elements(child, tag));
  }
  return found;
}

function spreadBindingExpression(componentSource, tag) {
  const { descriptor, errors } = parse(componentSource);
  assert.deepEqual(errors, []);
  const element = elements(descriptor.template.ast, tag)[0];
  assert.ok(element, `${tag} must exist`);
  const spread = element.props.find(
    (prop) => prop.type === 7 && prop.name === "bind" && !prop.arg,
  );
  assert.ok(spread?.exp?.content, `${tag} must have a spread binding`);
  return spread.exp.content;
}

function stripImports(value) {
  return value.replace(/^import[\s\S]*?;\r?\n/gmu, "");
}

async function loadUseItemManagerSource() {
  const managerSource = stripImports(
    await source("air-vuetify-v3/src/composables/useItemManager.js"),
  );
  function useSyncedBoolean(props, emit, name) {
    const state = Vue.ref(props[name] ?? false);
    return {
      [name]: Vue.computed({
        get: () => state.value,
        set: (value) => {
          if (state.value === value) return;
          state.value = value;
          emit(`update:${name}`, value);
        },
      }),
    };
  }
  globalThis.__customerUseItemManagerHarness = {
    Vue,
    useCloneObject,
    useEditModes,
    useErrors,
    useIsEditing: (props, emit) =>
      useSyncedBoolean(props, emit, "isEditing"),
    useIsLoading: (props, emit) =>
      useSyncedBoolean(props, emit, "isLoading"),
  };
  try {
    const executable = `
      const {
        Vue, useCloneObject: _cloneObject, useEditModes, useErrors,
        useIsEditing, useIsLoading
      } = globalThis.__customerUseItemManagerHarness;
      ${managerSource}
    `;
    return await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#${Math.random()}`,
    );
  } finally {
    delete globalThis.__customerUseItemManagerHarness;
  }
}

async function customerManagerHarness(archiveMode = false) {
  const component = await source("components/Customer/Manager/index.vue");
  const script = component.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  let sequence = 0;
  const events = [];
  class Customer {
    constructor(raw = {}) {
      this.instanceNumber = ++sequence;
      this.docId = null;
      this.name = null;
      this.initialize(raw);
    }
    initialize(raw = {}) {
      Object.assign(this, raw);
    }
    toObject() {
      return { ...this };
    }
    clone() {
      return new Customer(this.toObject());
    }
    async create() {
      if (this.createFailure) throw this.createFailure;
      this.createCalls = (this.createCalls ?? 0) + 1;
      this.docId = "generated-customer";
    }
    async update() {
      if (this.updateFailure) throw this.updateFailure;
      this.updateCalls = (this.updateCalls ?? 0) + 1;
    }
  }
  const listenerDoc = new Customer({ docId: "listener-customer" });
  const factory = new Function(
    "Customer",
    "defineOptions",
    "defineProps",
    "defineEmits",
    "useBaseManager",
    `${stripImports(script)}; return { beforeEdit, archiveMode: props.archiveMode, defaultCustomer: props.modelValue, modelValueValidator: props.__modelValueValidator, handleCreate, handleUpdate };`,
  );
  const methods = factory(
    Customer,
    () => {},
    (options) => ({
      modelValue: options.modelValue.default(),
      archiveMode,
      __modelValueValidator: options.modelValue.validator,
    }),
    () => (...args) => events.push(args),
    () => ({ attrs: {} }),
  );
  return {
    ...methods,
    Customer,
    events,
    listenerDoc,
    failCreate(error) {
      listenerDoc.createFailure = error;
    },
  };
}

async function customersManagerHarness(
  externalBeforeEdit,
  attributeName = "beforeEdit",
) {
  const component = await source("components/Customers/Manager/index.vue");
  const script = component.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  class Customer {}
  const componentAttrs = { [attributeName]: externalBeforeEdit, modelValue: [] };
  const factory = new Function(
    "Customer",
    "defineOptions",
    "defineProps",
    "useAttrs",
    "useBaseManager",
    `${stripImports(script)}; return { beforeEdit, modelValueValidator: props.__modelValueValidator, Customer, handleCreate, handleUpdate };`,
  );
  return factory(
    Customer,
    () => {},
    (options) => ({
      modelValue: componentAttrs.modelValue,
      __modelValueValidator: options.modelValue.validator,
    }),
    () => componentAttrs,
    () => ({ attrs: {} }),
  );
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
  assert.doesNotMatch(autocomplete, /STATUS_ACTIVE|STATUS_TERMINATED/u);
  assert.match(autocomplete, /searchCustomers\(text, \{ returnAllCached: false \}\)/u);
  assert.match(autocomplete, /:fetchItemByKeyApi="getCustomer"/u);
});

test("CustomerManager delegates create and update directly to FireModel instances", async () => {
  const [detail, manager] = await Promise.all([
    source("pages/customers/[id].vue"),
    source("components/Customer/Manager/index.vue"),
  ]);
  assert.match(detail, /<CustomerManager/u);
  assert.match(manager, /<air-item-manager/u);
  assert.doesNotMatch(manager, /useCustomerActions|createCustomer|updateCustomer/u);
  assert.match(manager, /await draft\.create\(\)/u);
  assert.match(manager, /await draft\.update\(\)/u);
  assert.match(manager, /:handle-update=/u);
  assert.match(manager, /:handle-create="handleCreate"/u);
  assert.match(manager, /:handle-delete="handleDelete"/u);
  assert.match(manager, /default: \(\) => new Customer\(\)/u);
  assert.match(manager, /validator: \(value\) => value instanceof Customer/u);
  assert.match(manager, /:model-value="props\.modelValue"/u);
  assert.match(manager, /'aria-label': \$attrs\.label/u);
  assert.doesNotMatch(manager, /:disable-update=|function toCreate\(/u);
  assert.doesNotMatch(manager, /\boperation:\s*\{|openManager/u);
  assert.match(manager, /@create="emit\('created', \$event\)"/u);
  assert.doesNotMatch(manager, /CreationScope|creationScope|useAuthStore/u);
  assert.ok((detail.match(/:model-value="customerInstance"/gu) ?? []).length >= 2);
  assert.ok((detail.match(/\blabel="[^"]+の編集"/gu) ?? []).length >= 2);
  assert.doesNotMatch(detail, /:doc=|\btitle="[^"]+の編集"/u);
  assert.match(detail, /:included-keys="CUSTOMER_BASIC_FIELDS"/u);
  assert.match(detail, /:included-keys="CUSTOMER_PAYMENT_FIELDS"/u);
});

test("CustomerManager keeps one default instance and delegates CREATE to the base manager", async () => {
  const harness = await customerManagerHarness();
  assert.equal(harness.defaultCustomer instanceof harness.Customer, true);
  assert.equal(harness.modelValueValidator(harness.defaultCustomer), true);
  assert.equal(harness.modelValueValidator({}), false);
  const draft = new harness.Customer();
  await harness.handleCreate(draft);
  assert.equal(draft.docId, "generated-customer");
  assert.equal(draft.createCalls, 1);

  const failure = new Error("synthetic failure");
  draft.createFailure = failure;
  await assert.rejects(() => harness.handleCreate(draft), failure);
});

test("real useItemManager starts each repeated Customer CREATE from the clean stable default", async () => {
  const harness = await customerManagerHarness();
  const { useItemManager } = await loadUseItemManagerSource();
  const events = [];
  const manager = useItemManager({
    props: {
      beforeEdit: harness.beforeEdit,
      disableDelete: true,
      disableUpdate: false,
      handleCreate: harness.handleCreate,
      handleUpdate: harness.handleUpdate,
      isEditing: false,
      isLoading: false,
      modelValue: harness.defaultCustomer,
      steps: 1,
    },
    emit: (...args) => events.push(args),
  });

  await manager.toCreate();
  assert.equal(manager.item.value.docId, null);
  assert.equal(manager.item.value.name, null);
  manager.updateProperties({ name: "first edited value" });
  await manager.submit();

  await manager.toCreate();
  assert.equal(manager.item.value.docId, null);
  assert.equal(manager.item.value.name, null);
  manager.updateProperties({ name: "second edited value" });
  await manager.submit();

  const created = events
    .filter(([name]) => name === "create")
    .map(([, item]) => item);
  assert.equal(created.length, 2);
  assert.equal(created[0].name, "first edited value");
  assert.equal(created[1].name, "second edited value");
  assert.equal(created[0].docId, "generated-customer");
  assert.equal(created[1].docId, "generated-customer");
  assert.notEqual(created[0], created[1]);
  assert.equal(harness.defaultCustomer.docId, null);
  assert.equal(harness.defaultCustomer.name, null);
});

test("CustomerManager keeps DELETE behind explicit archive mode", async () => {
  const harness = await customerManagerHarness();
  const draft = new harness.Customer({ docId: "listener-customer", name: "draft" });

  assert.equal(await harness.beforeEdit("UPDATE"), true);
  await harness.handleUpdate(draft);
  assert.equal(draft.updateCalls, 1);
  await assert.rejects(harness.beforeEdit("DELETE"), /詳細画面から実行/u);

  const archiveHarness = await customerManagerHarness(true);
  assert.equal(archiveHarness.archiveMode, true);
  assert.equal(await archiveHarness.beforeEdit("DELETE"), true);
});

test("Customer autocomplete uses singular CREATE without nesting plural manager", async () => {
  const [autocomplete, singular, plural] = await Promise.all([
    source("components/Customer/Autocomplete.vue"),
    source("components/Customer/Manager/index.vue"),
    source("components/Customers/Manager/index.vue"),
  ]);
  assert.match(autocomplete, /<CustomerManager/u);
  assert.match(autocomplete, /:excluded-keys="\['contractStatus'\]"/u);
  assert.match(autocomplete, /label="取引先の新規登録"/u);
  assert.doesNotMatch(autocomplete, /:included-keys=/u);
  assert.doesNotMatch(autocomplete, /<CustomersManager/u);
  assert.doesNotMatch(singular, /<CustomersManager/u);
  assert.doesNotMatch(plural, /<CustomerManager/u);
  assert.match(autocomplete, /function onCreateHandler\(customer\)/u);
  assert.match(autocomplete, /pushCustomer\(customer\)/u);
  assert.match(autocomplete, /#activator="\{ toCreate \}"/u);
  assert.match(autocomplete, /<v-icon @click="\(\) => toCreate\(\)">/u);
  assert.doesNotMatch(autocomplete, /\{ disabled, toCreate \}|v-if="!disabled"/u);
  assert.doesNotMatch(autocomplete, /operation="CREATE"|\bopen\b/u);
  assert.ok(
    autocomplete.indexOf("pushCustomer(customer)") <
      autocomplete.indexOf('emit("update:model-value", emitValue)'),
  );
  assert.doesNotMatch(autocomplete, /customerCreationBridge|CreationScope|creationScope|useAuthStore/u);
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
  assert.match(listPage, /:model-value="customerInstance\.docs"/u);
  assert.doesNotMatch(listPage, /:docs=/u);
  assert.match(listPage, /#table="\{ items, toCreate, toUpdate \}"/u);
  assert.match(listPage, /<CustomersDataTable[\s\S]*?:items="items"/u);
  assert.match(listPage, /@click="\(\) => toCreate\(\)"/u);
  assert.match(listPage, /@click:update="toUpdate"/u);
  assert.match(
    listPage,
    /function handleBeforeEdit\(editMode, item\)[\s\S]*?editMode !== "UPDATE"[\s\S]*?router\.push\(`\/customers\/\$\{item\.docId\}`\);[\s\S]*?return false;/u,
  );
  assert.match(manager, /<air-array-manager/u);
  assert.match(manager, /if \(editMode === "DELETE"\) return false/u);
  assert.match(manager, /:schema="Customer"/u);
  assert.match(manager, /:model-value="props\.modelValue"/u);
  assert.match(
    manager,
    /validator: \(value\) => value\.every\(\(item\) => item instanceof Customer\)/u,
  );
  assert.match(manager, /:excluded-keys="\['contractStatus'\]"/u);
  assert.match(manager, /:handle-create="handleCreate"/u);
  assert.match(manager, /:handle-update="handleUpdate"/u);
  assert.match(manager, /await draft\.create\(\)/u);
  assert.match(manager, /await draft\.update\(\)/u);
  assert.match(manager, /maxWidth: 480/u);
  assert.match(manager, /class="fill-height"/u);
  assert.match(manager, /取引先の新規登録/u);
  assert.match(
    manager,
    /(?:^|\s)(?::disable-delete="true"|disable-delete)(?=\s|\/?>)/u,
  );
  assert.match(
    manager,
    /(?:^|\s)(?::hide-delete-btn="true"|hide-delete-btn)(?=\s|\/?>)/u,
  );
  assert.match(manager, /<template #table="tableAttrs">[\s\S]*?<slot[\s\S]*?name="table"[\s\S]*?v-bind="tableAttrs"/u);
  assert.doesNotMatch(manager, /<template #editor|<v-form/u);
  assert.doesNotMatch(manager, /props\.docs\.(?:push|splice)|docs\.(?:push|splice)/u);
  assert.doesNotMatch(manager, /@update:model-value|emit\("update:model-value"/u);
  assert.doesNotMatch(
    manager,
    /rejectUnsupportedOperation|disableUpdate|hideTable|defineEmits|@create=|#header|name="activator"|style="height: 100%"|:handle-delete=|:disable-update=/u,
  );
  await assert.rejects(
    access(new URL("../../components/Customer/CreateDialog.vue", import.meta.url)),
    (error) => error?.code === "ENOENT",
  );
});

test("CustomersManager accepts camel and kebab beforeEdit attrs while DELETE remains internal", async () => {
  const item = { docId: "customer-1" };
  for (const attributeName of ["beforeEdit", "before-edit"]) {
    const calls = [];
    const manager = await customersManagerHarness(async (...args) => {
      calls.push(args);
      return undefined;
    }, attributeName);

    assert.equal(manager.modelValueValidator([]), true);
    assert.equal(manager.modelValueValidator([new manager.Customer()]), true);
    assert.equal(manager.modelValueValidator([{}]), false);

    assert.equal(await manager.beforeEdit("UPDATE", item), undefined);
    assert.deepEqual(calls, [["UPDATE", item]], attributeName);
    assert.equal(await manager.beforeEdit("DELETE", item), false);
    assert.equal(calls.length, 1, attributeName);

    const draft = {
      async create() {
        this.createCalls = (this.createCalls ?? 0) + 1;
      },
      async update() {
        this.updateCalls = (this.updateCalls ?? 0) + 1;
      },
    };
    await manager.handleCreate(draft);
    await manager.handleUpdate(draft);
    assert.equal(draft.createCalls, 1);
    assert.equal(draft.updateCalls, 1);
  }
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
  assert.match(
    manager,
    /:model-value="props\.modelValue"/u,
  );
  const { descriptor, errors } = parse(manager);
  assert.deepEqual(errors, []);
  const activatorTemplate = elements(descriptor.template.ast, "template").find(
    (node) => node.props.some(
      (prop) =>
        prop.type === 7 &&
        prop.name === "slot" &&
        prop.arg?.content === "activator" &&
        prop.exp?.content === "slotProps",
    ),
  );
  assert.ok(activatorTemplate, "activator slot props must be accepted");
  const forwardedSlot = elements(activatorTemplate, "slot").find(
    (node) =>
      node.props.some(
        (prop) =>
          prop.type === 6 &&
          prop.name === "name" &&
          prop.value?.content === "activator",
      ) &&
      node.props.some(
        (prop) =>
          prop.type === 7 &&
          prop.name === "bind" &&
          !prop.arg &&
          prop.exp?.content === "slotProps",
      ),
  );
  assert.ok(forwardedSlot, "activator slot props must be forwarded");
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
    /:dialog-props="\{[\s\S]*?maxWidth: 480,[\s\S]*?persistent: true,[\s\S]*?scrollable: true,[\s\S]*?'aria-label': \$attrs\.label,[\s\S]*?\}"/u,
  );
  assert.match(plural, /maxWidth: 480/u);
  for (const wrapper of [manager, plural]) {
    assert.doesNotMatch(
      wrapper,
      /<template #editor|<template #input-header|<v-form|custom-input|errorMessage/u,
    );
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

test("Customer manager binding gives the common loading and error pipeline precedence over caller attrs", async () => {
  const [singular, plural] = await Promise.all([
    source("components/Customer/Manager/index.vue"),
    source("components/Customers/Manager/index.vue"),
  ]);
  const caller = {
    arbitraryCallerValue: "preserved",
    isLoading: "caller-loading",
    onError: "caller-error",
    "onError:clear": "caller-clear",
    "onUpdate:isLoading": "caller-update-loading",
  };
  const common = {
    isLoading: "common-loading",
    onError: "common-error",
    "onError:clear": "common-clear",
    "onUpdate:isLoading": "common-update-loading",
  };

  for (const [componentSource, tag] of [
    [singular, "air-item-manager"],
    [plural, "air-array-manager"],
  ]) {
    const expression = spreadBindingExpression(componentSource, tag);
    const evaluate = new Function(
      "scope",
      `with (scope) { return (${expression}); }`,
    );
    const merged = evaluate({ $attrs: caller, attrs: common });
    assert.equal(merged.arbitraryCallerValue, "preserved");
    for (const [key, value] of Object.entries(common)) {
      assert.equal(merged[key], value, `${tag}: ${key}`);
    }
  }
});

test("Customer activators still expose an editable UX prop for their callers", async () => {
  for (const path of [
    "components/Customer/Activator/Base.vue",
    "components/Customer/Activator/Payment.vue",
  ]) {
    const content = await source(path);
    assert.match(content, /editable: \{ type: Boolean, default: false \}/u);
    assert.match(content, /<template v-if="props\.editable" #append>/u);
  }
});


test("Customer detail routes explicit delete to the standard manager and list keeps delete unavailable", async () => {
  const [detail, manager, plural] = await Promise.all([
    source("pages/customers/[id].vue"),
    source("components/Customer/Manager/index.vue"),
    source("components/Customers/Manager/index.vue"),
  ]);
  assert.match(detail, /@click="\(\) => toDelete\(\)"/u);
  assert.match(detail, /@delete="handleDeleted"/u);
  assert.match(manager, /async function handleDelete\(draft\)[\s\S]*?await draft\.delete\(\)/u);
  assert.match(manager, /:handle-delete="handleDelete"/u);
  assert.match(plural, /disable-delete/u);
  assert.doesNotMatch(plural, /handleDelete|:handle-delete=/u);
});

test("Customer manager delete harness keeps cancel write-free, preserves draft on failure, and navigates only after success", async () => {
  let writes = 0;
  let fail = true;
  let navigation = 0;
  const draft = { docId: "customer", async delete() { writes++; if (fail) throw new Error("blocked"); } };
  const cancel = () => undefined;
  cancel();
  assert.equal(writes, 0);
  await assert.rejects(draft.delete(), /blocked/u);
  assert.equal(draft.docId, "customer");
  fail = false;
  await draft.delete();
  navigation++;
  assert.equal(navigation, 1);
});
