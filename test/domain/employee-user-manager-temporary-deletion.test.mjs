import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../components/Employee/UserManager.vue",
  import.meta.url,
);

test("Employee UserManager deletes temporary Users through the feature composable", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /useTemporaryUserDeletion[\s\S]*composables\/application\/user\/useTemporaryUserDeletion/,
  );
  assert.match(
    source,
    /const \{ deleteTemporaryUser, getDeleteControl \} =\s*useTemporaryUserDeletion\(\)/,
  );
  assert.match(
    source,
    /await deleteTemporaryUser\(item, \{\s*employeeId: props\.employee\.docId,\s*\}\)/,
  );
  assert.match(source, /:handle-delete="handleDelete"/);
  assert.equal(/\.delete\s*\(/.test(source), false);
});

test("Employee UserManager delegates linked deletion control to the feature composable", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /getDeleteControl\(props\.user, \{\s*employeeId: props\.employee\.docId,\s*\}\)/,
  );
  assert.match(source, /:disabled="deleteControl\.disabled"/);
  assert.equal(source.includes("canManageTemporaryUsers"), false);
  assert.equal(source.includes("canDeleteTemporaryUser"), false);
  assert.equal(source.includes('hasPresetPermission("users:write")'), false);
});

test("Employee UserManager delegates deletion errors to the manager error pipeline", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const handlerStart = source.indexOf("async function handleDelete(item)");
  const handlerEnd = source.indexOf("\n}", handlerStart);
  const handlerSource = source.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart >= 0);
  assert.ok(handlerEnd > handlerStart);
  assert.match(source, /<air-item-manager\s+v-bind="attrs"/);
  assert.match(handlerSource, /await deleteTemporaryUser\(item,/);
  assert.equal(handlerSource.includes("catch"), false);
  assert.equal(handlerSource.includes("logger.error"), false);
  assert.equal(handlerSource.includes("loadings.add"), false);
});
