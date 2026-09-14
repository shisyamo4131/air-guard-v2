import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import * as Vue from "vue";
import { assertPaymentDueDate } from "../../composables/domain/customerBilling/paymentDueDateValidation.js";
import { dateInput, parseDate } from "../../composables/domain/shared/valueContract.js";

const billing = (paymentDueDateAt = parseDate("2026-10-31")) => ({
  billingDateAt: parseDate("2026-09-30"),
  paymentDueDateAt,
});

async function loadManagerHarness({ beforeEdit = () => true } = {}) {
  const source = await readFile(
    new URL("../../components/CustomerBilling/Manager/index.vue", import.meta.url),
    "utf8",
  );
  const { descriptor } = parse(source, { filename: "CustomerBillingManager" });
  const setupSource = descriptor.scriptSetup.content.replace(
    /import[\s\S]*?;\s*/gu,
    "",
  );
  globalThis.__customerBillingManagerHarness = {
    Billing: class Billing {},
    CustomInput: {},
    assertPaymentDueDate,
    defineEmits: () => () => {},
    defineOptions: () => {},
    defineProps: () => ({ beforeEdit, customInput: null }),
    useBaseManager: () => ({ attrs: {} }),
  };
  const moduleSource = `
    const {
      Billing, CustomInput, assertPaymentDueDate, defineEmits, defineOptions,
      defineProps, useBaseManager
    } = globalThis.__customerBillingManagerHarness;
    ${setupSource}
    export { beforeEdit, handleUpdate, rejectUnsupportedOperation };
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`,
  );
  return {
    module,
    cleanup: () => delete globalThis.__customerBillingManagerHarness,
  };
}

async function loadCustomInputHarness({
  item = billing(),
  disabled = false,
  editMode = "UPDATE",
  updateProperties,
} = {}) {
  const source = await readFile(
    new URL("../../components/CustomerBilling/CustomInput.vue", import.meta.url),
    "utf8",
  );
  const { descriptor } = parse(source, { filename: "CustomerBillingCustomInput" });
  const setupSource = descriptor.scriptSetup.content.replace(
    /import[\s\S]*?;\s*/gu,
    "",
  );
  const updates = [];
  globalThis.__customerBillingInputHarness = {
    computed: (getter) => ({ get value() { return getter(); } }),
    dateInput,
    defineProps: () => ({
      componentAttrs: {},
      disabled,
      editMode,
      item,
      updateProperties: updateProperties ?? ((value) => updates.push(value)),
    }),
  };
  const moduleSource = `
    const { computed, dateInput, defineProps } = globalThis.__customerBillingInputHarness;
    ${setupSource}
    export { billingDate, clearPaymentDueDate };
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`,
  );
  return {
    module,
    updates,
    cleanup: () => delete globalThis.__customerBillingInputHarness,
  };
}

function useEditModes() {
  const editMode = Vue.ref("CREATE");
  return {
    editMode: Vue.readonly(editMode),
    isCreate: Vue.computed(() => editMode.value === "CREATE"),
    isUpdate: Vue.computed(() => editMode.value === "UPDATE"),
    isDelete: Vue.computed(() => editMode.value === "DELETE"),
    resetMode: () => (editMode.value = "CREATE"),
    setMode: (value, { onBefore } = {}) => {
      onBefore?.();
      editMode.value = value;
    },
  };
}

function useErrors({ emit }) {
  const errors = Vue.ref([]);
  return {
    errors,
    hasError: Vue.computed(() => errors.value.length > 0),
    clearErrors: () => {
      errors.value = [];
      emit("error:clear");
    },
    setError: (message, error) => {
      const cause = error ?? new Error(message);
      errors.value.push(cause);
      emit("error", { message, error: cause });
    },
  };
}

function useSyncedFlag(props, emit, key) {
  const state = Vue.ref(props[key] ?? false);
  return {
    [key]: Vue.computed({
      get: () => state.value,
      set: (value) => {
        state.value = value;
        emit(`update:${key}`, value);
      },
    }),
  };
}

async function loadBaseItemManager(props, emit) {
  const source = await readFile(
    new URL("../../node_modules/air-vuetify-v3/src/composables/useItemManager.js", import.meta.url),
    "utf8",
  );
  const factory = new Function(
    "Vue",
    "useEditModes",
    "useErrors",
    "useIsEditing",
    "useIsLoading",
    "_cloneObject",
    `${source.replace(/import[\s\S]*?;\s*/gu, "").replace("export function", "function")}; return useItemManager;`,
  );
  const useItemManager = factory(
    Vue,
    useEditModes,
    useErrors,
    (nextProps, nextEmit) => useSyncedFlag(nextProps, nextEmit, "isEditing"),
    (nextProps, nextEmit) => useSyncedFlag(nextProps, nextEmit, "isLoading"),
    (value) => value?.clone?.() ?? structuredClone(value),
  );
  return useItemManager({ props, emit });
}

test("payment due date accepts date round-trips and an explicit null clear", () => {
  const value = parseDate("2026-09-30");
  assert.equal(dateInput(value), "2026-09-30");
  assert.doesNotThrow(() => assertPaymentDueDate(billing(value)));
  assert.doesNotThrow(() => assertPaymentDueDate(billing(null)));
});

test("payment due date accepts Firestore Timestamp-compatible dates at the JST day boundary", () => {
  const billingDateAt = { toDate: () => new Date("2026-09-29T15:00:00.000Z") };
  const paymentDueDateAt = { toDate: () => new Date("2026-09-30T15:00:00.000Z") };
  assert.equal(dateInput(billingDateAt), "2026-09-30");
  assert.equal(dateInput(paymentDueDateAt), "2026-10-01");
  assert.doesNotThrow(() => assertPaymentDueDate({ billingDateAt, paymentDueDateAt }));
});

for (const [name, item] of [
  ["missing billing date", { paymentDueDateAt: parseDate("2026-09-30") }],
  ["missing payment due date", { ...billing(), paymentDueDateAt: undefined }],
  ["invalid payment due date", billing("2026-10-31")],
  ["payment date before billing date", billing(parseDate("2026-09-29"))],
]) {
  test(`payment due date rejects ${name}`, () => {
    assert.throws(() => assertPaymentDueDate(item));
  });
}

test("CustomerBillingManager rejects CREATE and DELETE before external handling", async () => {
  let calls = 0;
  const mounted = await loadManagerHarness({
    beforeEdit: () => {
      calls += 1;
      return true;
    },
  });
  try {
    await assert.rejects(mounted.module.beforeEdit("CREATE", billing()));
    await assert.rejects(mounted.module.beforeEdit("DELETE", billing()));
    assert.equal(calls, 0);
    assert.equal(await mounted.module.beforeEdit("UPDATE", billing()), true);
    assert.equal(calls, 1);
  } finally {
    mounted.cleanup();
  }
});

test("CustomerBillingManager delegates valid updates and propagates validation or save failures", async () => {
  const mounted = await loadManagerHarness();
  try {
    let calls = 0;
    const draft = {
      ...billing(),
      update: async () => {
        calls += 1;
        return "saved";
      },
    };
    assert.equal(await mounted.module.handleUpdate(draft), "saved");
    assert.equal(calls, 1);

    await assert.rejects(
      mounted.module.handleUpdate({
        ...billing(parseDate("2026-09-29")),
        update: async () => {
          calls += 1;
        },
      }),
    );
    assert.equal(calls, 1);

    const failure = new Error("save failed");
    await assert.rejects(
      mounted.module.handleUpdate({ ...billing(), update: async () => { throw failure; } }),
      failure,
    );
  } finally {
    mounted.cleanup();
  }
});

test("CustomerBillingCustomInput clears the date with the base updateProperties contract", async () => {
  const mounted = await loadCustomInputHarness();
  try {
    assert.equal(mounted.module.billingDate.value, "2026-09-30");
    mounted.module.clearPaymentDueDate();
    assert.deepEqual(mounted.updates, [{ paymentDueDateAt: null }]);
  } finally {
    mounted.cleanup();
  }
});

test("base manager connection keeps a cancelled draft isolated and applies date changes or null clears", async () => {
  const model = {
    ...billing(parseDate("2026-10-15")),
    clone() {
      return { ...this, clone: this.clone, update: this.update };
    },
    update: async () => {},
  };
  const component = await loadManagerHarness();
  const events = [];
  const manager = await loadBaseItemManager(
    {
      beforeEdit: component.module.beforeEdit,
      disableDelete: true,
      disableUpdate: false,
      handleCreate: component.module.rejectUnsupportedOperation,
      handleDelete: component.module.rejectUnsupportedOperation,
      handleUpdate: component.module.handleUpdate,
      isEditing: false,
      isLoading: false,
      modelValue: model,
      step: 1,
      steps: 1,
    },
    (...event) => events.push(event),
  );
  try {
    await manager.toUpdate();
    assert.equal(manager.isEditing.value, true);
    manager.updateProperties({ paymentDueDateAt: parseDate("2026-10-31") });
    assert.equal(dateInput(manager.item.value.paymentDueDateAt), "2026-10-31");
    manager.quitEditing();
    await Vue.nextTick();
    assert.equal(manager.isEditing.value, false);

    await manager.toUpdate();
    assert.equal(dateInput(manager.item.value.paymentDueDateAt), "2026-10-15", "cancelled edit never changed the model");
    const input = await loadCustomInputHarness({
      item: manager.item.value,
      updateProperties: manager.updateProperties,
    });
    try {
      input.module.clearPaymentDueDate();
    } finally {
      input.cleanup();
    }
    assert.equal(manager.item.value.paymentDueDateAt, null);
    assert.equal(model.paymentDueDateAt === null, false, "draft clearing remains local before submit");
    assert.equal(events.some(([name]) => name === "update:modelValue"), false);
  } finally {
    component.cleanup();
  }
});

test("base manager keeps the editor open and releases loading after a save rejection", async () => {
  const failure = new Error("save rejected");
  const model = {
    ...billing(),
    clone() {
      return { ...this, clone: this.clone, update: async () => { throw failure; } };
    },
  };
  const component = await loadManagerHarness();
  const events = [];
  const manager = await loadBaseItemManager(
    {
      beforeEdit: component.module.beforeEdit,
      disableDelete: true,
      disableUpdate: false,
      handleCreate: component.module.rejectUnsupportedOperation,
      handleDelete: component.module.rejectUnsupportedOperation,
      handleUpdate: component.module.handleUpdate,
      isEditing: false,
      isLoading: false,
      modelValue: model,
      step: 1,
      steps: 1,
    },
    (...event) => events.push(event),
  );
  try {
    await manager.toUpdate();
    await manager.submit();
    assert.equal(manager.isEditing.value, true);
    assert.equal(manager.isLoading.value, false);
    assert.equal(manager.hasError.value, true);
    assert.equal(events.some(([name, value]) => name === "error" && value.error === failure), true);
  } finally {
    component.cleanup();
  }
});

test("CustomerBillingManager keeps the base editor contract and exposes UPDATE only", async () => {
  const manager = await readFile(
    new URL("../../components/CustomerBilling/Manager/index.vue", import.meta.url),
    "utf8",
  );
  const input = await readFile(
    new URL("../../components/CustomerBilling/CustomInput.vue", import.meta.url),
    "utf8",
  );

  for (const [file, source] of [
    ["CustomerBillingManager", manager],
    ["CustomerBillingCustomInput", input],
  ]) {
    const { descriptor } = parse(source, { filename: file });
    const compiled = compileScript(descriptor, { id: file });
    assert.deepEqual(
      compileTemplate({
        source: descriptor.template.content,
        filename: file,
        id: file,
        compilerOptions: { bindingMetadata: compiled.bindings },
      }).errors,
      [],
    );
  }

  assert.match(manager, /useBaseManager\("CustomerBillingManager"\)/u);
  assert.match(manager, /if \(editMode !== "UPDATE"\) return rejectUnsupportedOperation\(\)/u);
  assert.match(manager, /:handle-create="rejectUnsupportedOperation"/u);
  assert.match(manager, /:handle-delete="rejectUnsupportedOperation"/u);
  assert.match(manager, /assertPaymentDueDate\(draft\);\s*return await draft\.update\(\);/u);
  assert.match(manager, /maxWidth: 480/u);
  assert.match(manager, /#activator="slotProps"/u);
  assert.match(input, /componentAttrs.*item.*updateProperties.*disabled.*editMode/su);
  assert.match(input, /componentAttrs\.paymentDueDateAt/u);
  assert.match(input, /label="入金予定日"/u);
  assert.match(input, /:min="billingDate"/u);
  assert.match(input, /:disabled="props\.disabled \|\| props\.editMode !== 'UPDATE'"/u);
  assert.match(input, /paymentDueDateAt: null/u);
});
