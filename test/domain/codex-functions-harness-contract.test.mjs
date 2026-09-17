import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { spawnSync } from "node:child_process";

const projectRoot = new URL("../../", import.meta.url);

test("dedicated Firebase config exposes Functions on its own loopback port", async () => {
  const config = JSON.parse(
    await readFile(new URL("firebase.codex-test.json", projectRoot), "utf8"),
  );

  assert.equal(config.functions.source, "functions/codex-test");
  assert.deepEqual(config.emulators.functions, {
    host: "127.0.0.1",
    port: 15001,
  });
});

test("ordinary harness isolates an enabled parent trigger and restores its exact environment", async () => {
  const source = await readFile(new URL("scripts/run-codex-local-test.ps1", projectRoot), "utf8");
  const region = source.slice(source.indexOf("$operationTriggerWasSet ="), source.indexOf("    if ($externalEffectsModeWasSet)"));
  assert.ok(region.includes("Remove-Item Env:\\AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER"));
  // Execute the actual environment boundary with its runtime launch replaced by
  // a local assertion. No Emulator, filesystem setup or process launch occurs.
  const safe = region.replace(/    Push-Location \$runtimePath[\s\S]*?    \$exitCode = \$LASTEXITCODE/u,
    "    if (Test-Path Env:\\AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER) { throw 'child inherited trigger' }").replace("    Pop-Location", "");
  for (const parent of ["enabled", "custom", null]) {
    const setup = parent === null ? "Remove-Item Env:\\AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER -ErrorAction SilentlyContinue" : `$env:AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER = '${parent}'`;
    const assertRestored = parent === null ? "if (Test-Path Env:\\AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER) { throw 'unexpected restored flag' }" : `if ($env:AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER -ne '${parent}') { throw 'restore mismatch' }`;
    const run = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference = 'Stop'\n${setup}\n${safe}\n}\n${assertRestored}`], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
  }
});

test("Codex harness starts Functions only for tests and forces deny mode", async () => {
  const script = await readFile(
    new URL("scripts/run-codex-local-test.ps1", projectRoot),
    "utf8",
  );

  assert.match(script, /\$testEmulators = '\S*functions\S*'/);
  assert.match(script, /if \(\$Mode -eq 'Seed'\).*\$seedEmulators/s);
  assert.match(script, /\$env:AIR_GUARD_EXTERNAL_EFFECTS = 'deny'/);
  assert.match(script, /Remove-Item Env:\\AIR_GUARD_EXTERNAL_EFFECTS/);
  assert.match(script, /functions_started = \$Mode -eq 'Test'/);
});

test("ordinary harness does not configure or require an archive tenant allowlist", async () => {
  const source = await readFile(new URL("scripts/run-codex-local-test.ps1", projectRoot), "utf8");
  assert.doesNotMatch(source, /AIR_GUARD_CODEX_EMPLOYEE_ARCHIVE_TENANTS/u);
  assert.doesNotMatch(source, /archiveTenants/u);
  assert.match(source, /AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER/u);
  assert.match(source, /AIR_GUARD_EXTERNAL_EFFECTS/u);
});

test("local harness retains shared lifecycle and CAS03 helpers", async () => {
  const source = await readFile(
    new URL("test/local/codex-local-harness.test.mjs", projectRoot),
    "utf8",
  );

  const beforeStart = source.indexOf("before(async () => {");
  const beforeEnd = source.indexOf("function siteRulesData", beforeStart);
  const beforeBody = source.slice(beforeStart, beforeEnd);
  assert.notEqual(beforeStart, -1);
  assert.match(beforeBody, /testEnvironment = await initializeTestEnvironment\(/u);
  assert.match(beforeBody, /firestore: \{ \.\.\.firestoreHost, rules \}/u);
  assert.match(beforeBody, /storage: \{ \.\.\.storageHost, rules: storageRules \}/u);

  const afterStart = source.indexOf("after(async () => {");
  const afterEnd = source.indexOf("function siteRulesData", afterStart);
  const afterBody = source.slice(afterStart, afterEnd);
  assert.match(afterBody, /if \(testEnvironment\) await testEnvironment\.cleanup\(\);/u);

  const helperBody = (name, nextName) => {
    const start = source.indexOf(`async function ${name}`);
    const end = source.indexOf(nextName, start);
    assert.notEqual(start, -1, `${name} declaration`);
    return source.slice(start, end);
  };
  const customerSeed = helperBody("seedCustomerRulesDocument", "async function seedOutsourcerRulesDocument");
  assert.match(customerSeed, /testEnvironment\.withSecurityRulesDisabled\(/u);
  assert.match(customerSeed, /setDoc\(/u);
  const outsourcerSeed = helperBody("seedOutsourcerRulesDocument", "async function seedCas03Documents");
  assert.match(outsourcerSeed, /testEnvironment\.withSecurityRulesDisabled\(/u);
  assert.match(outsourcerSeed, /setDoc\(/u);
  const casSeed = helperBody("seedCas03Documents", "async function cleanupCas03Documents");
  assert.match(casSeed, /testEnvironment\.withSecurityRulesDisabled\(/u);
  assert.match(casSeed, /batch\.set\(/u);
  const casCleanup = helperBody("cleanupCas03Documents", "const CAS03_CUSTOMER_REFERENCE_COLLECTIONS");
  assert.match(casCleanup, /testEnvironment\.withSecurityRulesDisabled\(/u);
  assert.match(casCleanup, /batch\.delete\(/u);

  const casConstantStart = source.indexOf("const CAS03_CUSTOMER_REFERENCE_COLLECTIONS = [");
  const casConstantEnd = source.indexOf("];", casConstantStart);
  const casConstant = source.slice(casConstantStart, casConstantEnd);
  assert.match(casConstant, /\{ collectionName: "Sites", optionalOnCreate: true, deleteAllowed: false \}/u);
  assert.match(casConstant, /\{ collectionName: "Billings", optionalOnCreate: false, deleteAllowed: true \}/u);

  const registeredUserStart = source.indexOf("async function seedRegisteredUser");
  const registeredUserEnd = source.indexOf("async function captureCallableError", registeredUserStart);
  const registeredUser = source.slice(registeredUserStart, registeredUserEnd);
  assert.match(registeredUser, /const data = \{ docId: uid, companyId, isTemporary, disabled \};/u);

  const siteActor = helperBody("seedSiteRulesActor", "async function cleanupSiteLifecycleFixtures");
  assert.match(siteActor, /omit: docId === null \? \["docId"\] : \[\]/u);
  assert.match(source, /test\("SITE-04 cross-tenant schedule read, update, delete, and create are denied"/u);
  assert.match(source, /test\("SITE-04 standard client lifecycle is role-independent and rejects invalid metadata or maintenance"/u);
  assert.doesNotMatch(source, /functionName:\s*"terminateSite"/u);
  assert.doesNotMatch(source, /functionName:\s*"reactivateSite"/u);
  assert.doesNotMatch(source, /test\.skip\("SITE-04/u);
  assert.doesNotMatch(source, /SITE-04 Site lifecycle metadata and cross-tenant schedule writes remain server-only/u);
  assert.doesNotMatch(source, /SITE-04 lifecycle Callables terminate then reactivate through the local transport/u);
  assert.doesNotMatch(source, /SITE-04 lifecycle Callable transport/u);
  assert.doesNotMatch(source, /SITE-04 terminateSite Callable transport/u);
  assert.doesNotMatch(source, /admin-state-missing/u);

  const emp05bStart = source.indexOf('test("EMP05-B mixed standard model and Callable paths');
  const emp05bEnd = source.indexOf('test("FGA04 ', emp05bStart);
  assert.notEqual(emp05bStart, -1);
  assert.notEqual(emp05bEnd, -1);
  const emp05b = source.slice(emp05bStart, emp05bEnd);
  assert.doesNotMatch(
    emp05b,
    /emp05Command\(\s*[^,]+,\s*"articles"\s*,[\s\S]{0,1000}?kind:\s*"result"/u,
  );
  assert.doesNotMatch(emp05b, /kind:\s*"billing"/u);
  assert.doesNotMatch(
    emp05b,
    /const\s+billing\s*=\s*\(\s*operations\s*\)\s*=>\s*callSiteLifecycleTransport\(\s*\{[\s\S]*?functionName:\s*"saveOperation"/u,
  );
  assert.match(emp05b, /new\s+OperationResult\s*\(/u);
  assert.match(emp05b, /new\s+ArticleDetail\s*\(/u);
  assert.match(emp05b, /new\s+OperationBilling\s*\(/u);
  assert.match(emp05b, /OperationBilling\s*\.\s*runTransaction\s*\(/u);
  assert.match(emp05b, /toggleLock\s*\(\s*true\s*\)/u);
  assert.match(emp05b, /toggleLock\s*\(\s*false\s*\)/u);
});
