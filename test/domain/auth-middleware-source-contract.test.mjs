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

test("middleware uses the shared access context and fails closed for unknown routes", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /buildPageAccessContext\(auth\)/);
  assert.match(source, /isPageAllowed\(targetPath, userRoles, accessContext\)/);
  assert.match(source, /未登録routeもfail closed/);
  assert.doesNotMatch(source, /if \(!pageConfig\) \{\s*return;\s*\}/);
});

test("session initialization failure uses dashboard before onboarding checks", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const failureIndex = source.indexOf(
    "if (auth.sessionInitializationFailed)",
  );
  const dashboardIndex = source.indexOf(
    'return navigateTo("/dashboard", { replace: true })',
    failureIndex,
  );
  const onboardingIndex = source.indexOf(
    "if (!auth.isEmailVerified || !auth.companyId)",
  );

  assert.ok(failureIndex >= 0);
  assert.ok(dashboardIndex > failureIndex);
  assert.ok(onboardingIndex > dashboardIndex);
});
