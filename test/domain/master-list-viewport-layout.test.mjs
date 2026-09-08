import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const SHARED_VIEWPORT_PAGES = Object.freeze([
  "pages/customers/index.vue",
  "pages/sites/index.vue",
  "pages/outsourcers/index.vue",
  "pages/employees/index.vue",
  "pages/sites/terminated.vue",
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

test("AppViewportContainer compiles and preserves container attributes and content", async () => {
  const path = "components/App/ViewportContainer.vue";
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
  assert.match(content, /inheritAttrs:\s*false/u);
  assert.match(content, /<v-container[\s\S]*?v-bind="\$attrs"/u);
  assert.match(content, /<slot \/>/u);
});

test("master list containers are constrained to the viewport layout height", async () => {
  const viewportContainer = await source(
    "components/App/ViewportContainer.vue",
  );
  assert.match(
    viewportContainer,
    /height:\s*calc\([\s\S]*?100dvh\s*-\s*var\(--v-layout-top,\s*0px\)\s*-\s*var\(--v-layout-bottom,\s*0px\)[\s\S]*?\)/u,
    "AppViewportContainer must constrain its content to the available viewport height",
  );

  for (const path of SHARED_VIEWPORT_PAGES) {
    assert.match(
      await source(path),
      /<AppViewportContainer>/u,
      `${path} must use the shared viewport container`,
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
