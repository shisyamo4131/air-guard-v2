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

test("archive tenant permission is isolated to Test/Harness and restores parent environment on every exit", async () => {
  const source = await readFile(new URL("scripts/run-codex-local-test.ps1", projectRoot), "utf8");
  const region = source.slice(source.indexOf("$operationTriggerWasSet ="), source.indexOf("    if ($externalEffectsModeWasSet)"));
  assert.ok(region.includes("$archiveTenantsWasSet = Test-Path Env:\\AIR_GUARD_CODEX_EMPLOYEE_ARCHIVE_TENANTS"));
  const variable = "AIR_GUARD_CODEX_EMPLOYEE_ARCHIVE_TENANTS";
  for (const [mode, suite] of [["Test", "Harness"], ["Seed", "Harness"], ["Test", "Other"]]) {
    for (const parent of [null, '["other-company","broader-company"]']) for (const outcome of ["success", "nonzero", "throw"]) {
      const expectedChild = mode === "Test" && suite === "Harness" ? '["codex-emp05-d-archive"]' : null;
      const childAssertion = expectedChild === null
        ? `if (Test-Path Env:\\${variable}) { throw 'non-harness inherited archive permission' }`
        : `if ($env:${variable} -ne '${expectedChild}') { throw 'child permission mismatch' }`;
      const childOutcome = outcome === "throw" ? "throw 'synthetic-launch-failure'" : `$exitCode = ${outcome === "success" ? 0 : 17}`;
      const safe = region.replace(/    Push-Location \$runtimePath[\s\S]*?    \$exitCode = \$LASTEXITCODE/u,
        `${childAssertion}\n${childOutcome}`).replace("    Pop-Location", "") + "\n}";
      const setup = parent === null ? `Remove-Item Env:\\${variable} -ErrorAction SilentlyContinue` : `$env:${variable} = '${parent}'`;
      const restored = parent === null ? `if (Test-Path Env:\\${variable}) { throw 'parent absence lost' }` : `if ($env:${variable} -ne '${parent}') { throw 'parent value changed' }`;
      const verifyOutcome = outcome === "throw" ? "if (-not $caught) { throw 'expected throw not observed' }" : `if ($caught -or $exitCode -ne ${outcome === "success" ? 0 : 17}) { throw 'exit outcome lost' }`;
      const command = `$ErrorActionPreference = 'Stop'\n$Mode = '${mode}'\n$Suite = '${suite}'\n${setup}\n$caught = $false\ntry {\n${safe}\n} catch { if ($_.Exception.Message -ne 'synthetic-launch-failure') { throw }; $caught = $true }\n${restored}\n${verifyOutcome}\nWrite-Output 'boundary verified'`;
      const run = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")], { encoding: "utf8" });
      assert.equal(run.status, 0, `${mode}/${suite}/${parent}/${outcome}: ${run.stderr} ${run.stdout}`);
      assert.match(run.stdout, /boundary verified/u);
    }
  }
});
