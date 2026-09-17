import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

test("Customer archive Callable domain modules are absent after standard delete migration", async () => {
  for (const path of [
    "functions/apis/archiveCustomer.js",
    "functions/modules/customer/archiveCustomer.js",
    "functions/modules/customer/mappers/mapCustomerArchiveError.js",
  ]) {
    await assert.rejects(access(new URL("../../" + path, import.meta.url)));
  }
});
