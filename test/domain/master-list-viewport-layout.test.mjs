import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MASTER_LIST_PAGES = Object.freeze([
  "pages/customers/index.vue",
  "pages/sites/index.vue",
  "pages/sites/terminated.vue",
  "pages/outsourcers/index.vue",
  "pages/employees/index.vue",
  "pages/employees/resigned.vue",
]);

const DATA_TABLE_PAGES = Object.freeze([
  ["pages/customers/index.vue", "CustomersDataTable"],
  ["pages/sites/index.vue", "SitesDataTable"],
  ["pages/sites/terminated.vue", "SitesDataTable"],
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("master list containers are constrained to the viewport layout height", async () => {
  for (const path of MASTER_LIST_PAGES) {
    assert.match(
      await source(path),
      /height:\s*calc\(100dvh\s*-\s*var\(--v-layout-top\)\s*-\s*var\(--v-layout-bottom\)\)/u,
      `${path} must constrain its list container to the available viewport height`,
    );
  }
});

test("master data tables keep overflow inside the viewport-constrained flex area", async () => {
  for (const [path, component] of DATA_TABLE_PAGES) {
    assert.match(
      await source(path),
      new RegExp(`<${component}[\\s\\S]*?class="[^"]*\\boverflow-hidden\\b[^"]*"`, "u"),
      `${path} must constrain ${component} overflow`,
    );
  }
});
