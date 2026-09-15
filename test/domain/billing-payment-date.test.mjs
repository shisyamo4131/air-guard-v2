import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";

test("billing page compiles and connects the listener instance to the standard manager", async () => {
  const file = "pages/billings/customers/[id].vue";
  const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
  const { descriptor } = parse(source);
  const compiled = compileScript(descriptor, { id: file });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: compiled.bindings } }).errors, []);
  assert.match(source, /const docId = route\.params\.id/u);
  assert.match(source, /useCustomerBilling\(\{ docId \}\)/u);
  assert.doesNotMatch(source, /definePageMeta/u);
  assert.match(source, /<CustomerBillingManager :model-value="doc">/u);
  assert.doesNotMatch(source, /PaymentDateEditor/u);
});

test("billing detail relies on the subscribed instance without a dedicated refresh or Callable", async () => {
  const [page, dataLayer, functionsApi] = await Promise.all([
    readFile(new URL("../../pages/billings/customers/[id].vue", import.meta.url), "utf8"),
    readFile(new URL("../../composables/dataLayers/useCustomerBilling.js", import.meta.url), "utf8"),
    readFile(new URL("../../functions/apis/index.js", import.meta.url), "utf8"),
  ]);

  assert.match(dataLayer, /instance\.subscribe\(\{ docId \}\)/u);
  assert.match(dataLayer, /instance\.unsubscribe\(\)/u);
  assert.doesNotMatch(page, /getDocFromServer|updateBillingPaymentDate/u);
  assert.doesNotMatch(dataLayer, /getDocFromServer|updateBillingPaymentDate/u);
  assert.doesNotMatch(functionsApi, /updateBillingPaymentDate/u);

  for (const path of [
    "../../components/CustomerBilling/PaymentDateEditor.vue",
    "../../composables/application/customerBilling/useBillingPaymentDate.js",
    "../../composables/domain/customerBilling/billingPaymentContract.js",
    "../../functions/apis/updateBillingPaymentDate.js",
    "../../functions/modules/billings/updateBillingPaymentDate.js",
    "../../functions/shared/billingPaymentContract.js",
  ]) {
    await assert.rejects(
      access(new URL(path, import.meta.url)),
      (error) => error?.code === "ENOENT",
    );
  }
});
