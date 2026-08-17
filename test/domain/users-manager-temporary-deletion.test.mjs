import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../components/Users/Manager/index.vue",
  import.meta.url,
);

test("UsersManager deletes temporary Users through the Callable only", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /deleteTemporaryUser[\s\S]*useAuthFunctions\(\)/);
  assert.match(
    source,
    /async function handleDelete\(item\)\s*\{\s*await deleteTemporaryUser\(item\.docId\);\s*\}/,
  );
  assert.match(source, /:handle-delete="handleDelete"/);
  assert.equal(/\.delete\s*\(/.test(source), false);
});

test("UsersManager enables deletion only for manageable active temporary Users", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /auth\.isAdmin === true \|\| auth\.hasPresetPermission\("users:write"\)/,
  );
  assert.match(source, /item\.isTemporary === true/);
  assert.match(source, /item\.isAdmin === false/);
  assert.match(source, /item\.disabled === false/);
  assert.match(
    source,
    /:disable-delete="\(item\) => !canDeleteTemporaryUser\(item\)"/,
  );
});

test("UsersManager delegates deletion errors to the manager error pipeline", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const handlerStart = source.indexOf("async function handleDelete(item)");
  const handlerEnd = source.indexOf("\n}", handlerStart);
  const handlerSource = source.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart >= 0);
  assert.ok(handlerEnd > handlerStart);
  assert.match(source, /<air-array-manager\s+v-bind="attrs"/);
  assert.match(handlerSource, /await deleteTemporaryUser\(item\.docId\)/);
  assert.equal(handlerSource.includes("catch"), false);
  assert.equal(handlerSource.includes("logger.error"), false);
  assert.equal(handlerSource.includes("loadings.add"), false);
});
