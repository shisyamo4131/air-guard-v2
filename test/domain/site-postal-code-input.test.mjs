import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { effectScope, nextTick, reactive, ref, watch } from "vue";

const sfc = await readFile(
  new URL("../../components/Site/PostalCodeInput.vue", import.meta.url),
  "utf8",
);
const script = sfc.match(/<script setup>([\s\S]*?)<\/script>/u)?.[1];
assert.ok(script, "PostalCodeInput script setup is required");
const executable = script.replace(/^import[\s\S]*?;\r?\n/gmu, "");

test("Site postal input defaults to the isolated shared lookup behind an injectable seam", () => {
  assert.match(
    sfc,
    /import \{ fetchAddressFromPostalCode \} from "\.\.\/\.\.\/air-vuetify-v3\/src\/utils\/postalCode\.js"/u,
  );
  assert.match(
    sfc,
    /lookupAddress: \{ type: Function, default: fetchAddressFromPostalCode \}/u,
  );
  assert.match(sfc, /await props\.lookupAddress\(postalCode\)/u);
  assert.doesNotMatch(sfc, /\bfetch\s*\(/u);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function createHarness({ initialPostalCode = "", initialItem = {} } = {}) {
  const item = reactive({
    prefCode: "13",
    city: "既存市区町村",
    address: "既存町域",
    ...initialItem,
  });
  const model = ref(initialPostalCode);
  const requests = [];
  const updates = [];
  const cleanups = [];
  const updateProperties = (value) => {
    updates.push(value);
    Object.assign(item, value);
  };
  const lookupAddress = (postalCode) => {
    const request = deferred();
    requests.push({ postalCode, request });
    return request.promise;
  };
  const scope = effectScope();
  const factory = new Function(
    "ref",
    "watch",
    "onBeforeUnmount",
    "defineProps",
    "defineModel",
    "fetchAddressFromPostalCode",
    `${executable}\nreturn { errorMessage, isLoading, model };`,
  );
  const state = scope.run(() => factory(
    ref,
    watch,
    (callback) => cleanups.push(callback),
    () => ({ item, lookupAddress, updateProperties }),
    () => model,
    () => null,
  ));

  async function setPostalCode(value) {
    model.value = value;
    await nextTick();
    await Promise.resolve();
  }

  function unmount() {
    for (const cleanup of cleanups.splice(0)) cleanup();
    scope.stop();
  }

  return { ...state, item, requests, setPostalCode, unmount, updates };
}

test("a current seven-digit Site postal lookup applies only the returned address fields", async () => {
  const harness = createHarness();
  await harness.setPostalCode("1000001");
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].postalCode, "1000001");
  assert.equal(harness.isLoading.value, true);

  harness.requests[0].request.resolve({
    prefcode: "13",
    address2: "千代田区",
    address3: "千代田",
  });
  await nextTick();
  await Promise.resolve();
  assert.deepEqual(harness.updates, [
    { prefCode: "13", city: "千代田区", address: "千代田" },
  ]);
  assert.equal(harness.errorMessage.value, "");
  assert.equal(harness.isLoading.value, false);
  harness.unmount();
});

test("a stale postal response cannot overwrite the latest address", async () => {
  const harness = createHarness();
  await harness.setPostalCode("1000001");
  await harness.setPostalCode("1500001");
  assert.equal(harness.requests.length, 2);

  harness.requests[1].request.resolve({
    prefcode: "13",
    address2: "渋谷区",
    address3: "神宮前",
  });
  await nextTick();
  await Promise.resolve();
  assert.deepEqual(harness.updates, [
    { prefCode: "13", city: "渋谷区", address: "神宮前" },
  ]);
  assert.equal(harness.isLoading.value, false);

  harness.requests[0].request.resolve({
    prefcode: "13",
    address2: "千代田区",
    address3: "千代田",
  });
  await nextTick();
  await Promise.resolve();
  assert.equal(harness.updates.length, 1);
  assert.deepEqual(
    { prefCode: harness.item.prefCode, city: harness.item.city, address: harness.item.address },
    { prefCode: "13", city: "渋谷区", address: "神宮前" },
  );
  harness.unmount();
});

test("manual address edits made during postal lookup are preserved", async () => {
  const harness = createHarness();
  await harness.setPostalCode("1000001");
  harness.item.city = "手入力の市区町村";
  harness.item.address = "手入力の町域";

  harness.requests[0].request.resolve({
    prefcode: "13",
    address2: "千代田区",
    address3: "千代田",
  });
  await nextTick();
  await Promise.resolve();
  assert.deepEqual(harness.updates, []);
  assert.equal(harness.item.city, "手入力の市区町村");
  assert.equal(harness.item.address, "手入力の町域");
  assert.equal(harness.errorMessage.value, "");
  assert.equal(harness.isLoading.value, false);
  harness.unmount();
});

test("invalid, null, and rejected postal lookups keep the address with the same truthful generic message", async () => {
  const invalid = createHarness();
  await invalid.setPostalCode("123");
  assert.equal(invalid.requests.length, 0);
  assert.equal(invalid.isLoading.value, false);
  invalid.unmount();

  const missing = createHarness();
  await missing.setPostalCode("1000001");
  missing.requests[0].request.resolve(null);
  await nextTick();
  await Promise.resolve();
  assert.deepEqual(missing.updates, []);
  assert.equal(
    missing.errorMessage.value,
    "住所を確認できませんでした。入力中の住所は変更していません。",
  );
  assert.equal(missing.item.city, "既存市区町村");
  assert.equal(missing.item.address, "既存町域");
  missing.unmount();

  const failed = createHarness();
  await failed.setPostalCode("1000001");
  failed.requests[0].request.reject(new Error("synthetic network failure"));
  await nextTick();
  await Promise.resolve();
  assert.deepEqual(failed.updates, []);
  assert.equal(
    failed.errorMessage.value,
    "住所を確認できませんでした。入力中の住所は変更していません。",
  );
  assert.equal(failed.item.city, "既存市区町村");
  assert.equal(failed.item.address, "既存町域");
  assert.equal(failed.isLoading.value, false);
  failed.unmount();
});

test("unmount invalidates an outstanding postal lookup and ends its loading state", async () => {
  const harness = createHarness();
  await harness.setPostalCode("1000001");
  harness.unmount();
  assert.equal(harness.isLoading.value, false);

  harness.requests[0].request.resolve({
    prefcode: "13",
    address2: "千代田区",
    address3: "千代田",
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(harness.updates, []);
});
