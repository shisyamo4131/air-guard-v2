import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../composables/application/user/useTemporaryUserDeletion.js",
  import.meta.url,
);

test("temporary User deletion composable applies the client policy", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /evaluateClientTemporaryUserDeletion[\s\S]*temporaryUserDeletionPolicy\.js/,
  );
  assert.match(source, /const auth = useAuthStore\(\)/);
  assert.match(
    source,
    /companyId: auth\.companyId,[\s\S]*actorUser: auth\.user,[\s\S]*targetUser/,
  );
  assert.match(source, /function getDeleteControl\(targetUser, context\)/);
  assert.match(source, /disabled: !result\.allowed/);
  assert.match(source, /reason: result\.reason/);
});

test("temporary User deletion composable rechecks before sending", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const functionStart = source.indexOf("async function deleteTemporaryUser(");
  const functionEnd =
    source.indexOf("\n  }\n\n  return {", functionStart) + "\n  }".length;
  const functionSource = source.slice(functionStart, functionEnd);

  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  assert.ok(
    functionSource.indexOf("evaluate(targetUser, context)") <
      functionSource.indexOf("requestDeleteTemporaryUser(targetUser.docId)"),
  );
  assert.match(
    functionSource,
    /if \(!result\.allowed\)[\s\S]*throw new TemporaryUserDeletionClientError/,
  );
  assert.match(
    functionSource,
    /return await requestDeleteTemporaryUser\(targetUser\.docId\)/,
  );
});

test("temporary User deletion composable exposes only feature operations", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /return \{[\s\S]*evaluate,[\s\S]*canDelete,[\s\S]*getDeleteControl,[\s\S]*deleteTemporaryUser,[\s\S]*\}/,
  );
  assert.equal(source.includes("setupAccount"), false);
  assert.equal(source.includes("companyId:" + " companyId"), false);
});
