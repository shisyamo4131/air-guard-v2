import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
test("archiveCustomer Callable and legacy customer archive modules are absent from the local product", async () => {
  for (const path of ["functions/apis/archiveCustomer.js", "functions/modules/customer/archiveCustomer.js", "functions/modules/customer/customerArchiveDocumentContract.js", "composables/application/customer/useCustomerArchiveAction.js", "composables/customer/useCustomerFunctions.js", "components/Customer/ArchiveDialog.vue"]) {
    await assert.rejects(access(new URL(`../../${path}`, import.meta.url)), (error) => error?.code === "ENOENT", path);
  }
  const [index, detail, list, autocomplete] = await Promise.all([source("functions/apis/index.js"), source("pages/customers/[id].vue"), source("pages/customers/index.vue"), source("components/Customer/Autocomplete.vue")]);
  assert.doesNotMatch(`${index}\n${detail}\n${list}\n${autocomplete}`, /archiveCustomer|useCustomerArchiveAction|Customers_archive/u);
});
