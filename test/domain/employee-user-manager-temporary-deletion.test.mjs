import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../components/Employee/UserManager.vue",
  import.meta.url,
);

test("Employee UserManager deletes temporary Users through the Callable only", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /deleteTemporaryUser[\s\S]*useAuthFunctions\(\)/);
  assert.match(
    source,
    /async function handleDelete\(item\)\s*\{\s*await deleteTemporaryUser\(item\.docId\);\s*\}/,
  );
  assert.match(source, /:handle-delete="handleDelete"/);
  assert.equal(/\.delete\s*\(/.test(source), false);
});

test("Employee UserManager enables deletion only for its manageable linked temporary User", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /auth\.isAdmin === true \|\| auth\.hasPresetPermission\("users:write"\)/,
  );
  assert.match(source, /props\.user\.isTemporary === true/);
  assert.match(source, /props\.user\.isAdmin === false/);
  assert.match(source, /props\.user\.disabled === false/);
  assert.match(
    source,
    /props\.user\.employeeId === props\.employee\.docId/,
  );
  assert.match(source, /:disabled="!canDeleteTemporaryUser"/);
});

test("Employee UserManager delegates deletion errors to the manager error pipeline", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const handlerStart = source.indexOf("async function handleDelete(item)");
  const handlerEnd = source.indexOf("\n}", handlerStart);
  const handlerSource = source.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart >= 0);
  assert.ok(handlerEnd > handlerStart);
  assert.match(source, /<air-item-manager\s+v-bind="attrs"/);
  assert.match(handlerSource, /await deleteTemporaryUser\(item\.docId\)/);
  assert.equal(handlerSource.includes("catch"), false);
  assert.equal(handlerSource.includes("logger.error"), false);
  assert.equal(handlerSource.includes("loadings.add"), false);
});
