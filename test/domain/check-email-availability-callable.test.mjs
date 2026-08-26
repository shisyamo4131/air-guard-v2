import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkEmailAvailability } from "../../functions/apis/checkEmailAvailability.js";

const sourceUrl = new URL("../../functions/apis/checkEmailAvailability.js", import.meta.url);

test("anonymous availability Callable rejects invalid email before Firebase access", async () => {
  await assert.rejects(() => checkEmailAvailability.run({ data: {} }), (error) => {
    assert.equal(error.code, "invalid-argument");
    return true;
  });
  assert.deepEqual(Object.keys(checkEmailAvailability).sort(), ["__endpoint", "run", "stream"]);
});

test("availability API is a thin advisory wrapper without User queries", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /checkEmailAvailabilityUseCase\(\{/);
  assert.match(source, /resolveCheckEmailAvailabilityEmail\(request\.data\?\.email\)/);
  assert.equal(source.includes("collectionGroup"), false);
  assert.equal(source.includes(".where("), false);
  assert.equal(source.includes("request.auth"), false);
  assert.equal(source.includes(".create("), false);
  assert.equal(source.includes(".set("), false);
  assert.equal(source.includes("runTransaction"), false);
  assert.equal(source.includes("logger.error(\"Administrator email preflight failed\", error"), false);
});
