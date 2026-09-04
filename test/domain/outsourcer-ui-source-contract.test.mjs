import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const OUTSOURCER_SFCS = Object.freeze([
  "pages/outsourcers/index.vue",
  "components/Outsourcers/Manager/index.vue",
  "components/Outsourcer/Autocomplete.vue",
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

test("OutsourcersManager hides unauthorized controls and blocks destructive delete", async () => {
  const manager = await source("components/Outsourcers/Manager/index.vue");
  assert.match(manager, /evaluateOutsourcerMutation/u);
  assert.match(manager, /const canCreate = computed/u);
  assert.match(manager, /const canUpdate = computed/u);
  assert.match(manager, /v-if="canCreate"/u);
  assert.match(manager, /:show-create="props\.showCreate && canCreate"/u);
  assert.match(manager, /:show-edit="canUpdate"/u);
  assert.match(manager, /:disable-delete="true"/u);
  assert.match(manager, /hide-delete-btn/u);
  assert.match(manager, /:disable-update="!canUpdate"/u);
  assert.match(manager, /async function handleDelete\(\)[\s\S]*?throw new Error/u);
  assert.doesNotMatch(manager, /return await props\.handleDelete/u);
});

test("Outsourcer create and update re-evaluate policy immediately before transport", async () => {
  const manager = await source("components/Outsourcers/Manager/index.vue");
  assert.match(
    manager,
    /async function handleCreate\(item\)\s*\{\s*assertMutationAllowed\(OUTSOURCER_MUTATIONS\.CREATE\);\s*return await props\.handleCreate\(item\);/u,
  );
  assert.match(
    manager,
    /async function handleUpdate\(item\)\s*\{\s*assertMutationAllowed\(OUTSOURCER_MUTATIONS\.UPDATE\);\s*return await props\.handleUpdate\(item\);/u,
  );
  assert.doesNotMatch(manager, /auth\.hasPermission|auth\.hasPresetPermission/u);
});

test("creatable Outsourcer autocomplete exposes its create trigger only when the guarded manager allows it", async () => {
  const autocomplete = await source("components/Outsourcer/Autocomplete.vue");
  assert.match(autocomplete, /#table="\{ toCreate, canCreate \}"/u);
  assert.match(
    autocomplete,
    /<v-icon v-if="canCreate" @click="toCreate\(\)"/u,
  );
});
