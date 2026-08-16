import assert from "node:assert/strict";
import test from "node:test";

import { setupUserAccount } from "../../functions/apis/setupUserAccount.js";

test("unauthenticated callable request is rejected", async () => {
  await assert.rejects(
    setupUserAccount.run({ data: {} }),
    (error) => {
      assert.equal(error.constructor.name, "HttpsError");
      assert.equal(error.code, "unauthenticated");
      assert.equal(error.message, "認証が必要です。");
      return true;
    },
  );
});

test("callable exposes no dependency or policy replacement API", () => {
  assert.deepEqual(
    Object.keys(setupUserAccount).sort(),
    ["__endpoint", "run", "stream"],
  );
});
