import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const PATH = "components/App/EditorDialog.vue";
const COMPONENT_URL = new URL(`../../${PATH}`, import.meta.url);

async function readComponent() {
  const content = await readFile(COMPONENT_URL, "utf8");
  const parsed = parse(content, { filename: COMPONENT_URL.pathname });
  assert.deepEqual(parsed.errors, [], `${PATH} parse errors`);
  return { content, descriptor: parsed.descriptor };
}

function evaluateSetup(setup, props, onEmit = () => {}) {
  const emitted = [];
  const nextTickCallbacks = [];
  let watchedSources = [];
  let watchedCallback = () => {};
  let previousWatchedValues = [];
  const source = setup.replace(/^import .*;\r?\n/gmu, "");
  const state = new Function(
    "computed",
    "nextTick",
    "ref",
    "watch",
    "defineOptions",
    "defineProps",
    "defineEmits",
    `${source}; return { submitLocked, validMode, unavailable, submitLabel, open, cancel, submit, updateModelValue };`,
  )(
    (getter) => ({ get value() { return getter(); } }),
    (callback) => nextTickCallbacks.push(callback),
    (value) => ({ value }),
    (sources, callback) => {
      watchedSources = sources;
      watchedCallback = callback;
      previousWatchedValues = sources.map((getter) => getter());
    },
    () => {},
    () => props,
    () => (...args) => {
      emitted.push(args);
      onEmit(...args);
    },
  );
  return {
    emitted,
    state,
    flushNextTick() {
      nextTickCallbacks.splice(0).forEach((callback) => callback());
    },
    flushWatch() {
      const values = watchedSources.map((getter) => getter());
      watchedCallback(values, previousWatchedValues);
      previousWatchedValues = values;
    },
  };
}

test("AppEditorDialog compiles as the AppEditorDialog auto-import component", async () => {
  const { content, descriptor } = await readComponent();
  compileScript(descriptor, { id: "app-editor-dialog" });
  const compiled = compileTemplate({
    id: "app-editor-dialog",
    filename: COMPONENT_URL.pathname,
    source: descriptor.template.content,
  });

  assert.deepEqual(compiled.errors, [], `${PATH} template errors`);
  assert.match(content, /name:\s*"AppEditorDialog"/u);
  assert.match(content, /mode:\s*\{[\s\S]*?required:\s*true[\s\S]*?validator:/u);
  assert.match(content, /<slot name="activator" :open="open"/u);
  assert.match(content, /<slot \/>/u);
  assert.match(content, /<slot name="prepend-actions" \/>/u);
  assert.match(content, /:aria-label="props\.title"/u);
  assert.match(content, /<v-form[^>]*@submit\.prevent="submit"/u);
  assert.match(
    content,
    /<AtomsBtnsCancel[\s\S]*?type="button"[\s\S]*?@click="cancel"[\s\S]*?\/>/u,
  );
  assert.match(
    content,
    /<AtomsBtnsSubmit[\s\S]*?type="submit"[\s\S]*?:text="submitLabel"[\s\S]*?:disabled="unavailable"[\s\S]*?\/>/u,
  );
  assert.doesNotMatch(content, /<v-btn/u);
  assert.doesNotMatch(content, /@click="submit"/u);
  assert.match(content, /const validation = await event/u);
  assert.match(content, /generation !== submitGeneration/u);
  assert.match(content, /props\.modelValue !== true/u);
  assert.match(content, /props\.submitDisabled/u);
  assert.match(content, /validation\?\.valid !== true/u);
  assert.match(content, /emit\("validation-error", error\)/u);
  assert.doesNotMatch(content, /use[A-Z].*Actions|createCustomer|updateEmployee/u);
});

test("AppEditorDialog derives its submit label from CREATE or UPDATE mode", async () => {
  const { descriptor } = await readComponent();
  const create = evaluateSetup(descriptor.scriptSetup.content, {
    modelValue: true,
    title: "新規登録",
    mode: "CREATE",
    loading: false,
    disabled: false,
  });
  const update = evaluateSetup(descriptor.scriptSetup.content, {
    modelValue: true,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
  });

  assert.equal(create.state.submitLabel.value, "登録");
  assert.equal(update.state.submitLabel.value, "更新");
});

test("AppEditorDialog emits controlled open and cancel events", async () => {
  const { descriptor } = await readComponent();
  const props = {
    modelValue: false,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
  };
  const { emitted, state } = evaluateSetup(descriptor.scriptSetup.content, props);

  state.open();
  state.cancel();
  assert.deepEqual(emitted, [
    ["update:modelValue", true],
    ["update:modelValue", false],
    ["cancel"],
  ]);

  props.loading = true;
  state.open();
  state.cancel();
  assert.equal(emitted.length, 3, "loading must prevent duplicate operations");

  props.loading = false;
  props.disabled = true;
  state.open();
  assert.equal(emitted.length, 3, "disabled must prevent open");
});

test("AppEditorDialog holds its lock while validation is pending and prevents duplicate submits", async () => {
  const { descriptor } = await readComponent();
  const props = {
    modelValue: true,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
  };
  const harness = evaluateSetup(descriptor.scriptSetup.content, props);
  let resolveValidation;
  const validation = new Promise((resolve) => {
    resolveValidation = resolve;
  });

  const pending = harness.state.submit(validation);
  await harness.state.submit(Promise.resolve({ valid: true }));
  assert.deepEqual(harness.emitted, []);
  assert.equal(harness.state.submitLocked.value, true);

  resolveValidation({ valid: true });
  await pending;
  assert.deepEqual(harness.emitted, [["submit"]]);
  assert.equal(harness.state.submitLocked.value, true);

  harness.flushNextTick();
  assert.equal(harness.state.submitLocked.value, false);
  await harness.state.submit(Promise.resolve({ valid: true }));
  assert.deepEqual(harness.emitted, [["submit"], ["submit"]]);
});

test("AppEditorDialog suppresses submit and unlocks after invalid or failed validation", async () => {
  const { descriptor } = await readComponent();
  const props = {
    modelValue: true,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
  };
  const harness = evaluateSetup(descriptor.scriptSetup.content, props);

  await harness.state.submit(Promise.resolve({ valid: false }));
  assert.deepEqual(harness.emitted, []);
  assert.equal(harness.state.submitLocked.value, false);

  const error = new Error("validation failed");
  await harness.state.submit(Promise.reject(error));
  assert.deepEqual(harness.emitted, [["validation-error", error]]);
  assert.equal(harness.state.submitLocked.value, false);
});

test("AppEditorDialog invalidates pending validation when cancel closes the dialog", async () => {
  const { descriptor } = await readComponent();
  const props = {
    modelValue: true,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
  };
  const harness = evaluateSetup(descriptor.scriptSetup.content, props);
  let resolveValidation;
  const validation = new Promise((resolve) => {
    resolveValidation = resolve;
  });

  const pending = harness.state.submit(validation);
  harness.state.cancel();
  resolveValidation({ valid: true });
  await pending;

  assert.deepEqual(harness.emitted, [
    ["update:modelValue", false],
    ["cancel"],
  ]);
  assert.equal(harness.state.submitLocked.value, false);
});

test("AppEditorDialog invalidates pending validation after an external close", async () => {
  const { descriptor } = await readComponent();
  const props = {
    modelValue: true,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
  };
  const harness = evaluateSetup(descriptor.scriptSetup.content, props);
  let resolveValidation;
  const validation = new Promise((resolve) => {
    resolveValidation = resolve;
  });

  const pending = harness.state.submit(validation);
  props.modelValue = false;
  harness.flushWatch();
  resolveValidation({ valid: true });
  await pending;

  assert.deepEqual(harness.emitted, []);
  assert.equal(harness.state.submitLocked.value, false);
});

test("AppEditorDialog holds the valid submit lock through the consumer loading cycle", async () => {
  const { descriptor } = await readComponent();
  const props = {
    modelValue: true,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
  };
  const harness = evaluateSetup(
    descriptor.scriptSetup.content,
    props,
    (event) => {
      if (event === "submit") props.loading = true;
    },
  );

  await harness.state.submit(Promise.resolve({ valid: true }));
  harness.flushWatch();
  assert.deepEqual(harness.emitted, [["submit"]]);
  assert.equal(harness.state.submitLocked.value, true);

  harness.flushNextTick();
  assert.equal(harness.state.submitLocked.value, true);

  props.loading = false;
  harness.flushWatch();
  assert.equal(harness.state.submitLocked.value, false);
});

test("AppEditorDialog clears a valid submit lock when the dialog closes", async () => {
  const { descriptor } = await readComponent();
  const props = {
    modelValue: true,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
  };
  const harness = evaluateSetup(descriptor.scriptSetup.content, props);

  await harness.state.submit(Promise.resolve({ valid: true }));
  assert.equal(harness.state.submitLocked.value, true);
  props.modelValue = false;
  harness.flushWatch();
  assert.equal(harness.state.submitLocked.value, false);
});

test("AppEditorDialog fails closed when mode is invalid", async () => {
  const { descriptor } = await readComponent();
  const harness = evaluateSetup(descriptor.scriptSetup.content, {
    modelValue: true,
    title: "編集",
    mode: "INVALID",
    loading: false,
    disabled: false,
  });

  assert.equal(harness.state.validMode.value, false);
  assert.equal(harness.state.submitLabel.value, "");
  assert.equal(harness.state.unavailable.value, true);
  await harness.state.submit(Promise.resolve({ valid: true }));
  assert.deepEqual(harness.emitted, []);
});

test("AppEditorDialog can disable submit without disabling its form", async () => {
  const { content, descriptor } = await readComponent();
  const props = {
    modelValue: true,
    title: "編集",
    mode: "UPDATE",
    loading: false,
    disabled: false,
    submitDisabled: true,
  };
  const harness = evaluateSetup(descriptor.scriptSetup.content, props);

  assert.equal(harness.state.unavailable.value, true);
  await harness.state.submit(Promise.resolve({ valid: true }));
  assert.deepEqual(harness.emitted, []);
  assert.match(
    content,
    /<v-form[\s\S]*?:disabled="props\.loading \|\| props\.disabled"/u,
  );
});
