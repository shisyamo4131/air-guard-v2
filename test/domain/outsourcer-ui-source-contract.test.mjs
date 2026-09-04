import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const OUTSOURCER_SFCS = Object.freeze([
  "pages/outsourcers/index.vue",
  "components/Outsourcers/Manager/index.vue",
  "components/Outsourcer/Autocomplete.vue",
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

test("Outsourcer list preserves the existing read query and routes mutations through the guarded manager", async () => {
  const page = await source("pages/outsourcers/index.vue");
  assert.match(page, /Outsourcer\.STATUS_ACTIVE/u);
  assert.match(page, /\["orderBy", "updatedAt", "desc"\]/u);
  assert.match(page, /\["limit", 10\]/u);
  assert.match(page, /<OutsourcersManager/u);
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
