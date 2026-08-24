import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../components/Users/Manager/index.vue",
  import.meta.url,
);

test("UsersManager deletes temporary Users through the feature composable", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /useTemporaryUserDeletion[\s\S]*composables\/application\/user\/useTemporaryUserDeletion/,
  );
  assert.match(
    source,
    /const \{ deleteTemporaryUser, canDelete \} =\s*useTemporaryUserDeletion\(\)/,
  );
  assert.match(
    source,
    /async function handleDelete\(item\)\s*\{\s*await deleteTemporaryUser\(item\);\s*\}/,
  );
  assert.match(source, /:handle-delete="handleDelete"/);
  assert.equal(/\.delete\s*\(/.test(source), false);
});

test("UsersManager delegates deletion control to the feature composable", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /:disable-delete="\(item\) => !canDelete\(item\)"/,
  );
  assert.equal(source.includes("canManageTemporaryUsers"), false);
  assert.equal(source.includes("canDeleteTemporaryUser"), false);
  assert.equal(source.includes('hasPresetPermission("users:write")'), false);
});

test("UsersManager delegates deletion errors to the manager error pipeline", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const handlerStart = source.indexOf("async function handleDelete(item)");
  const handlerEnd = source.indexOf("\n}", handlerStart);
  const handlerSource = source.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart >= 0);
  assert.ok(handlerEnd > handlerStart);
  assert.match(source, /<air-array-manager\s+v-bind="attrs"/);
  assert.match(handlerSource, /await deleteTemporaryUser\(item\)/);
  assert.match(handlerSource, /deleteTemporaryUser\(item\)/);
  assert.equal(handlerSource.includes("catch"), false);
  assert.equal(handlerSource.includes("logger.error"), false);
  assert.equal(handlerSource.includes("loadings.add"), false);
});
