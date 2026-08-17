import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("Codex harness starts Functions only for tests and forces deny mode", async () => {
  const script = await readFile(
    new URL("scripts/run-codex-local-test.ps1", projectRoot),
    "utf8",
  );

  assert.match(script, /\$testEmulators = '\S*functions\S*'/);
  assert.match(script, /if \(\$Mode -eq 'Seed'\).*\$seedEmulators/s);
  assert.match(script, /\$env:AIR_GUARD_EXTERNAL_EFFECTS = 'deny'/);
  assert.match(script, /Remove-Item Env:\\AIR_GUARD_EXTERNAL_EFFECTS/);
  assert.match(script, /functions_started = \$Mode -ne 'Seed'/);
});

test("Codex UI mode uses only its dedicated project, endpoints, and dotenv file", async () => {
  const script = await readFile(
    new URL("scripts/run-codex-local-test.ps1", projectRoot),
    "utf8",
  );

  assert.match(script, /\[ValidateSet\('Seed', 'Test', 'UI'\)\]/);
  assert.match(script, /\$uiHost = '127\.0\.0\.1'/);
  assert.match(script, /\$uiPort = 14600/);
  assert.match(script, /NUXT_PUBLIC_FIREBASE_PROJECT_ID = \$projectId/);
  assert.match(script, /NUXT_PUBLIC_FIREBASE_USE_EMULATOR = 'true'/);
  assert.match(script, /NUXT_PUBLIC_FIREBASE_EMULATOR_HOST = '127\.0\.0\.1'/);
  for (const port of [19099, 18080, 19000, 19199, 15001]) {
    assert.match(script, new RegExp(String(port)));
  }
  assert.match(script, /'-DotenvPath', \$uiDotenvPath/);
  assert.match(script, /run-codex-local-ui-child\.ps1/);
  assert.match(script, /\$uiStopPath = Join-Path \$runtimeRoot 'ui\.stop'/);
  assert.match(script, /server_started = \$Mode -eq 'UI'/);
});

test("Codex UI child stops Nuxt when the managed stop marker appears", async () => {
  const script = await readFile(
    new URL("scripts/run-codex-local-ui-child.ps1", projectRoot),
    "utf8",
  );

  assert.match(script, /Start-Process/);
  assert.match(script, /WindowStyle = 'Hidden'/);
  assert.match(script, /Test-Path -LiteralPath \$StopFile/);
  assert.match(script, /Stop-Process -Id \$nuxtProcess\.Id/);
});
