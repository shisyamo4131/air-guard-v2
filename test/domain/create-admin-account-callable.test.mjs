import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAdminAccount } from "../../functions/apis/createAdminAccount.js";

const sourceUrl = new URL("../../functions/apis/createAdminAccount.js", import.meta.url);

test("initial administrator Callable requires Authentication", async () => {
  await assert.rejects(() => createAdminAccount.run({ data: {} }), (error) => {
    assert.equal(error.code, "unauthenticated");
    return true;
  });
  assert.deepEqual(Object.keys(createAdminAccount).sort(), ["__endpoint", "run", "stream"]);
});

test("Callable delegates fixed identity and request data without raw queries or logs", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /createAdminAccountUseCase\(\{/);
  assert.match(source, /tokenUid:\s*request\.auth\.uid/);
  assert.match(source, /tokenEmail:\s*token\.email/);
  assert.match(source, /tokenEmailVerified:\s*token\.email_verified/);
  assert.match(source, /tokenCompanyId:\s*token\.companyId/);
  assert.match(source, /tokenIsSuperUser:\s*token\.isSuperUser/);
  assert.match(source, /input:\s*request\.data/);
  assert.equal(source.includes("collectionGroup"), false);
  assert.equal(source.includes(".where("), false);
  assert.equal(source.includes("logger.error(\"Initial administrator creation failed\", error"), false);
  assert.equal(source.includes("request.data?.companyId"), false);
  assert.equal(source.includes("resolveCallableAuthIdentity"), false);
});
