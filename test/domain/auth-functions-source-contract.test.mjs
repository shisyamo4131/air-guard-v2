import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../composables/auth/useAuthFunctions.js",
  import.meta.url,
);

test("account setup callable sends no client-selected registration IDs", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const setupStart = source.indexOf("const setupUserAccount = async () =>");
  const setupEnd = source.indexOf("\n  };", setupStart);
  const setupSource = source.slice(setupStart, setupEnd);

  assert.ok(setupStart >= 0);
  assert.ok(setupEnd > setupStart);
  assert.match(setupSource, /httpsCallable\(\$functions, "setupUserAccount"\)/);
  assert.match(setupSource, /await callable\(\)/);
  assert.equal(setupSource.includes("companyId"), false);
  assert.equal(setupSource.includes("tempUserId"), false);
  assert.match(setupSource, /return result\.data/);
});

test("temporary User deletion callable sends only the target User ID", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const deleteStart = source.indexOf(
    "const deleteTemporaryUser = async (targetUserId) =>",
  );
  const deleteEnd = source.indexOf("\n  };", deleteStart);
  const deleteSource = source.slice(deleteStart, deleteEnd);

  assert.ok(deleteStart >= 0);
  assert.ok(deleteEnd > deleteStart);
  assert.match(
    deleteSource,
    /httpsCallable\(\$functions, "deleteTemporaryUser"\)/,
  );
  assert.match(deleteSource, /await callable\(\{ targetUserId \}\)/);
  assert.equal(deleteSource.includes("companyId"), false);
  assert.equal(deleteSource.includes("actorUid"), false);
  assert.match(deleteSource, /return result\.data/);
});
