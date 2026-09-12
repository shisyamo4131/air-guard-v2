import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { Outsourcer } from "../../schemas/index.js";

const OUTSOURCER_SFCS = Object.freeze([
  "pages/outsourcers/index.vue",
  "components/Outsourcers/Manager/index.vue",
  "components/Outsourcers/Iterator/index.vue",
  "components/Outsourcer/Manager/index.vue",
  "components/Outsourcer/CustomInput.vue",
  "components/Outsourcer/Autocomplete.vue",
  "components/Outsourcer/Card/index.vue",
  "components/Outsourcer/ListItem/index.vue",
]);

const REMOVED_DEDICATED_FLOW = Object.freeze([
  "components/Outsourcer/CreateDialog.vue",
  "components/Outsourcer/Editor.vue",
  "composables/application/outsourcer/useOutsourcerActions.js",
  "composables/domain/outsourcer/outsourcerOperations.js",
  "utils/outsourcer/outsourcerWriter.js",
  "utils/outsourcer/outsourcerDocumentContract.js",
  "utils/auth/policies/outsourcerMutationPolicy.js",
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("Outsourcer SFCs parse and compile", async () => {
  for (const path of OUTSOURCER_SFCS) {
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

test("Outsourcer uses the shared singular and plural Manager contracts", async () => {
  const singular = await source("components/Outsourcer/Manager/index.vue");
  const plural = await source("components/Outsourcers/Manager/index.vue");

  assert.match(singular, /<air-item-manager/u);
  assert.match(singular, /validator: \(value\) => value instanceof Outsourcer/u);
  assert.match(singular, /return await draft\.create\(\)/u);
  assert.match(singular, /return await draft\.update\(\)/u);
  assert.match(singular, /disable-delete/u);
  assert.match(singular, /hide-delete-btn/u);

  assert.match(plural, /<air-array-manager/u);
  assert.match(
    plural,
    /validator: \(value\) => value\.every\(\(item\) => item instanceof Outsourcer\)/u,
  );
  assert.match(plural, /:model-value="props\.modelValue"/u);
  assert.match(plural, /:schema="Outsourcer"/u);
  assert.match(plural, /return await draft\.create\(\)/u);
  assert.match(plural, /return await draft\.update\(\)/u);
  assert.match(plural, /disable-delete/u);
  assert.match(plural, /hide-delete-btn/u);
  assert.doesNotMatch(
    `${singular}\n${plural}`,
    /evaluateOutsourcerMutation|useOutsourcerActions|hasExternalChanges|conflict/u,
  );
});

test("Outsourcer custom input omits status on create and exposes it on update", async () => {
  const input = await source("components/Outsourcer/CustomInput.vue");
  for (const field of ["code", "name", "nameKana", "displayName", "remarks"]) {
    assert.match(input, new RegExp(`componentAttrs\\['${field}'\\]`, "u"));
  }
  assert.match(input, /editMode !== 'CREATE'/u);
  assert.match(input, /componentAttrs\['contractStatus'\]/u);
});

test("Outsourcer list delegates the approved 20-item cursor contract without status filtering", async () => {
  const page = await source("pages/outsourcers/index.vue");
  const inRange = await source("composables/dataLayers/outsourcer/useOutsourcersInRange.js");
  const pagination = await source(
    "composables/dataLayers/outsourcer/useOutsourcerListPagination.js",
  );
  assert.doesNotMatch(page, /contractStatus|STATUS_ACTIVE|STATUS_TERMINATED/u);
  assert.doesNotMatch(inRange, /\["where",\s*"contractStatus"|STATUS_ACTIVE|STATUS_TERMINATED/u);
  assert.doesNotMatch(
    pagination,
    /where\([^\n]*contractStatus|STATUS_ACTIVE|STATUS_TERMINATED/u,
  );
  assert.match(inRange, /\{ constraints: \[\] \}/u);
  assert.match(page, /useOutsourcerListPagination/u);
  assert.match(page, /:model-value="items"/u);
  assert.match(page, /:items-per-page="20"/u);
  assert.match(page, /@load:next="loadNext"/u);
  assert.match(page, /@load:previous="loadPrevious"/u);
  assert.match(page, /@retry="reload"/u);
});

test("Outsourcer search and autocomplete use the approved one-character name search", async () => {
  const manager = await source("components/Outsourcers/Manager/index.vue");
  const pagination = await source(
    "composables/dataLayers/outsourcer/useOutsourcerListPagination.js",
  );
  const autocomplete = await source("components/Outsourcer/Autocomplete.vue");
  const fetch = await source("composables/fetch/useFetchOutsourcer.js");

  assert.match(pagination, /const MIN_SEARCH_LENGTH = 1/u);
  assert.match(pagination, /const MAX_SEARCH_LENGTH = 40/u);
  assert.match(pagination, /where\(`tokenMap\.\$\{token\}`, "==", true\)/u);
  assert.match(pagination, /orderBy\("updatedAt", "desc"\)/u);
  assert.match(pagination, /orderBy\(documentId\(\), "desc"\)/u);
  assert.match(pagination, /const PAGE_SIZE = 20/u);
  assert.match(manager, /normalizedLength < 1 \|\| normalizedLength > 40/u);
  assert.match(autocomplete, /normalizedLength < 1 \|\| normalizedLength > 40/u);
  assert.match(autocomplete, /名称を1〜40文字入力して検索/u);
  assert.match(autocomplete, /searchOutsourcers\(text, \{ returnAllCached: false \}\)/u);
  assert.match(fetch, /const \{ limit = 50, \.\.\.otherOptions \} = options/u);
});

test("creatable Outsourcer autocomplete uses the singular Manager and refreshes its cache", async () => {
  const autocomplete = await source("components/Outsourcer/Autocomplete.vue");
  assert.match(autocomplete, /const \{ getOutsourcer, pushOutsourcer, searchOutsourcers \}/u);
  assert.match(autocomplete, /pushOutsourcer\(event\)/u);
  assert.match(autocomplete, /<OutsourcerManager/u);
  assert.match(autocomplete, /#activator="\{ toCreate \}"/u);
  assert.match(autocomplete, /@created="onCreateHandler"/u);
  assert.doesNotMatch(autocomplete, /<OutsourcersManager/u);
});

test("Outsourcer code remains optional metadata and direct destructive flows stay absent", async () => {
  const candidate = new Outsourcer({
    name: "合成協力会社",
    nameKana: "ゴウセイキョウリョクガイシャ",
    displayName: "合成外注",
  });
  assert.equal(candidate.code, null);
  assert.equal(candidate.contractStatus, Outsourcer.STATUS_ACTIVE);

  const productFlow = (
    await Promise.all([
      source("pages/outsourcers/index.vue"),
      source("components/Outsourcers/Manager/index.vue"),
      source("components/Outsourcer/Manager/index.vue"),
      source("components/Outsourcer/Card/index.vue"),
    ])
  ).join("\n");
  assert.doesNotMatch(
    productFlow,
    /archiveOutsourcer|restoreOutsourcer|deleteOutsourcer|\.restore\(|\.delete\(/u,
  );
  assert.doesNotMatch(productFlow, /click:archive|click:restore|click:delete/u);

  for (const path of REMOVED_DEDICATED_FLOW) {
    await assert.rejects(access(new URL(`../../${path}`, import.meta.url)));
  }
});

test("TERMINATED Outsourcers remain marked without disabling selection", async () => {
  const card = await source("components/Outsourcer/Card/index.vue");
  const listItem = await source("components/Outsourcer/ListItem/index.vue");
  const iterator = await source("components/Outsourcers/Iterator/index.vue");

  for (const renderer of [card, listItem]) {
    assert.match(renderer, /STATUS_TERMINATED/u);
    assert.match(renderer, /契約終了/u);
    assert.doesNotMatch(renderer, /:disabled="isTerminated"|v-if="!isTerminated"/u);
  }
  assert.match(iterator, /'onClick:select': \(\) => select/u);
  assert.doesNotMatch(iterator, /contractStatus|STATUS_TERMINATED/u);
});
