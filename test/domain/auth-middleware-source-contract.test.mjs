import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../../middleware/auth.global.js", import.meta.url);

test("verified user without a company claim remains in account setup", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const setupGateIndex = source.indexOf(
    "if (!auth.isEmailVerified || !auth.companyId)",
  );
  const setupRedirectIndex = source.indexOf(
    'return navigateTo("/unconfirmedEmail", { replace: true })',
    setupGateIndex,
  );
  const completedRedirectIndex = source.indexOf(
    'if (targetPath === "/unconfirmedEmail")',
    setupRedirectIndex,
  );

  assert.ok(setupGateIndex >= 0);
  assert.ok(setupRedirectIndex > setupGateIndex);
  assert.ok(completedRedirectIndex > setupRedirectIndex);
});
