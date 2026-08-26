import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../components/Users/Iterator/index.vue",
  import.meta.url,
);

test("UsersIterator accepts boolean or per-User edit visibility", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /showEdit:\s*\{\s*type:\s*\[Boolean, Function\],\s*default:\s*false,?\s*\}/,
  );
  assert.match(source, /function resolveShowEdit\(user\)/);
  assert.match(source, /props\.showEdit\(user\) === true/);
  assert.match(source, /return props\.showEdit === true/);
  assert.match(source, /showEdit: resolveShowEdit\(item\.raw\)/);
});

test("UsersIterator preserves create, detail, edit, and select events", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /emit\('click:create'\)/);
  assert.match(source, /emit\('click:detail', item\.raw\)/);
  assert.match(source, /emit\('click:edit', item\.raw\)/);
  assert.match(source, /select\(\[item\], !isSelected\(item\)\)/);
});
