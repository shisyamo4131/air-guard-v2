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
