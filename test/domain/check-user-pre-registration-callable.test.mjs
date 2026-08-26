import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { checkUserPreRegistration } from "../../functions/apis/checkUserPreRegistration.js";

const sourceUrl = new URL(
  "../../functions/apis/checkUserPreRegistration.js",
  import.meta.url,
);

test("anonymous Callable maps invalid email without exposing dependencies", async () => {
  await assert.rejects(
    () => checkUserPreRegistration.run({ data: {} }),
    (error) => {
      assert.equal(error.constructor.name, "HttpsError");
      assert.equal(error.code, "invalid-argument");
      return true;
    },
  );
  assert.deepEqual(
    Object.keys(checkUserPreRegistration).sort(),
    ["__endpoint", "run", "stream"],
  );
});

test("Callable is a thin reservation use-case wrapper without raw query or logging", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /checkUserPreRegistrationUseCase\(\{/);
  assert.match(source, /firestore:\s*getFirestore\(\)/);
  assert.match(source, /resolveCheckUserPreRegistrationEmail\(request\.data\?\.email\)/);
  assert.match(source, /email,/);
  assert.equal(source.includes("collectionGroup"), false);
  assert.equal(source.includes(".where("), false);
  assert.equal(source.includes("resolveCallableAuthIdentity"), false);
  assert.equal(source.includes("logger.error(\"User pre-registration check failed\", error"), false);
});
