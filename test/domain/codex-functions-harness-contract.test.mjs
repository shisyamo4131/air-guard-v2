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
  assert.match(script, /functions_started = \$Mode -eq 'Test'/);
});
