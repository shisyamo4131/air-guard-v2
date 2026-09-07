import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { Outsourcer } from "../../schemas/index.js";
import {
  prepareOutsourcerCreate,
} from "../../composables/domain/outsourcer/outsourcerOperations.js";

const OUTSOURCER_SFCS = Object.freeze([
  "pages/outsourcers/index.vue",
  "components/Outsourcers/Manager/index.vue",
  "components/Outsourcers/Iterator/index.vue",
  "components/Outsourcer/Autocomplete.vue",
  "components/Outsourcer/Card/index.vue",
  "components/Outsourcer/ListItem/index.vue",
  "components/Outsourcer/CreateDialog.vue",
  "components/Outsourcer/Editor.vue",
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("Outsourcer authorization SFCs parse and compile", async () => {
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
  assert.match(page, /:items-per-page="20"/u);
  assert.match(page, /@load:next="loadNext"/u);
  assert.match(page, /@load:previous="loadPrevious"/u);
  assert.match(page, /@retry="reload"/u);
  assert.match(page, /<OutsourcersManager/u);
});

test("Outsourcer code remains optional display metadata and is not made an identity or search constraint", async () => {
  const create = await source("components/Outsourcer/CreateDialog.vue");
  const editor = await source("components/Outsourcer/Editor.vue");
  const writer = await source("utils/outsourcer/outsourcerWriter.js");
  const pagination = await source(
    "composables/dataLayers/outsourcer/useOutsourcerListPagination.js",
  );
  const sources = [create, editor, writer, pagination].join("\n");

  assert.doesNotMatch(
    sources,
    /where\([^\n]*["'`]code|codeExists|uniqueCode|nextCode|auto(?:matic)?Code|sequence/u,
  );
  assert.doesNotMatch(pagination, /tokenMap\.[^\n]*code|orderBy\("code"/u);
  assert.match(writer, /docId/u);
});

test("Outsourcer creation accepts an omitted or duplicate code while document IDs remain distinct", async () => {
  function draft(code) {
    return new Outsourcer({
      code,
      name: "合成協力会社",
      nameKana: "ゴウセイキョウリョクガイシャ",
      displayName: "合成外注",
      remarks: null,
    });
  }

  const omitted = await prepareOutsourcerCreate({
    draft: draft(null),
    docId: "outsourcer-without-code",
    actorUid: "actor-a",
    now: new Date("2026-09-04T00:00:00.000Z"),
  });
  const duplicateA = await prepareOutsourcerCreate({
    draft: draft("DUPLICATE"),
    docId: "outsourcer-a",
    actorUid: "actor-a",
    now: new Date("2026-09-04T00:00:00.000Z"),
  });
  const duplicateB = await prepareOutsourcerCreate({
    draft: draft("DUPLICATE"),
    docId: "outsourcer-b",
    actorUid: "actor-a",
    now: new Date("2026-09-04T00:00:00.000Z"),
  });

  assert.equal(omitted.code, null);
  assert.equal(omitted.docId, "outsourcer-without-code");
  assert.equal(duplicateA.code, duplicateB.code);
  assert.notEqual(duplicateA.docId, duplicateB.docId);
});

test("Outsourcer search and autocomplete keep the approved name-token and renderer contract", async () => {
  const pagination = await source(
    "composables/dataLayers/outsourcer/useOutsourcerListPagination.js",
  );
  const autocomplete = await source("components/Outsourcer/Autocomplete.vue");
  const fetch = await source("composables/fetch/useFetchOutsourcer.js");

  assert.match(pagination, /const MIN_SEARCH_LENGTH = 2/u);
  assert.match(pagination, /const MAX_SEARCH_LENGTH = 40/u);
  assert.match(pagination, /where\(`tokenMap\.\$\{token\}`, "==", true\)/u);
  assert.match(pagination, /orderBy\("nameKana", "asc"\)/u);
  assert.match(pagination, /orderBy\(documentId\(\), "asc"\)/u);
  assert.match(pagination, /const PAGE_SIZE = 20/u);
  assert.match(pagination, /const QUERY_LIMIT = PAGE_SIZE \+ 1/u);
  assert.match(
    autocomplete,
    /normalizedLength < 2 \|\| normalizedLength > 40/u,
  );
  assert.match(autocomplete, /searchOutsourcers\(text, \{ returnAllCached: false \}\)/u);
  assert.match(autocomplete, /<OutsourcerListItem/u);
  assert.doesNotMatch(autocomplete, /<EmployeeListItem/u);
  assert.match(fetch, /const \{ limit = 50, \.\.\.otherOptions \} = options/u);
});

test("TERMINATED Outsourcers are marked descriptively without disabling selection", async () => {
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

test("OutsourcersManager exposes only dedicated authorized create and update dialogs", async () => {
  const manager = await source("components/Outsourcers/Manager/index.vue");
  assert.match(manager, /evaluateOutsourcerMutation/u);
  assert.match(manager, /const canCreate = computed/u);
  assert.match(manager, /const canUpdate = computed/u);
  assert.match(manager, /v-if="canCreate"/u);
  assert.match(manager, /:show-create="props\.showCreate && canCreate"/u);
  assert.match(manager, /:show-edit="canUpdate"/u);
  assert.match(manager, /<OutsourcerCreateDialog/u);
  assert.match(manager, /<OutsourcerEditor/u);
  assert.doesNotMatch(manager, /AirArrayManager|air-array-manager|handleDelete|\.delete\(/u);
});

test("Outsourcer product flows expose no archive, restore, or delete operation", async () => {
  const sources = await Promise.all([
    source("pages/outsourcers/index.vue"),
    source("components/Outsourcers/Manager/index.vue"),
    source("components/Outsourcer/Card/index.vue"),
    source("composables/application/outsourcer/useOutsourcerActions.js"),
  ]);
  const productFlow = sources.join("\n");

  assert.doesNotMatch(
    productFlow,
    /archiveOutsourcer|restoreOutsourcer|deleteOutsourcer|\.restore\(|\.delete\(/u,
  );
  assert.doesNotMatch(productFlow, /click:archive|click:restore|click:delete/u);
});

test("Outsourcer create and update fail closed when policy changes before opening", async () => {
  const manager = await source("components/Outsourcers/Manager/index.vue");
  assert.match(
    manager,
    /function toCreateIfAllowed\(\)\s*\{\s*if \(!mutationDecision\(OUTSOURCER_MUTATIONS\.CREATE\)\.allowed\) return;/u,
  );
  assert.match(
    manager,
    /async function toUpdateIfAllowed\(item\)\s*\{\s*if \(!mutationDecision\(OUTSOURCER_MUTATIONS\.UPDATE\)\.allowed\) return;/u,
  );
  assert.doesNotMatch(manager, /auth\.hasPermission|auth\.hasPresetPermission/u);
});

test("Outsourcer dialogs use operation-specific actions, independent drafts, and conflict handling", async () => {
  const create = await source("components/Outsourcer/CreateDialog.vue");
  const editor = await source("components/Outsourcer/Editor.vue");
  assert.match(create, /OUTSOURCER_OPERATION\.CREATE/u);
  assert.match(create, /createOutsourcer\(draft\.value\)/u);
  assert.match(editor, /props\.outsourcer\.clone\(\)/u);
  assert.match(editor, /hasOutsourcerOperationConflict/u);
  assert.match(editor, /updateOutsourcer/u);
  assert.match(editor, /最新値を読み直す/u);
  const actions = await source("composables/application/outsourcer/useOutsourcerActions.js");
  const writer = await source("utils/outsourcer/outsourcerWriter.js");
  assert.match(actions, /assertCanWrite:\s*\(\)\s*=>/u);
  assert.match(writer, /assertCanWrite\?\.\(\);\s*transaction\.update/u);
  assert.doesNotMatch(writer, /\.set\(reference|setDoc\(reference/u);
});

test("creatable Outsourcer autocomplete exposes its create trigger only when the guarded manager allows it", async () => {
  const autocomplete = await source("components/Outsourcer/Autocomplete.vue");
  assert.match(autocomplete, /#table="\{ toCreate, canCreate \}"/u);
  assert.match(
    autocomplete,
    /<v-icon v-if="canCreate" @click="toCreate\(\)"/u,
  );
});
