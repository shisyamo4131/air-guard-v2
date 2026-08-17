import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../../", import.meta.url);

test("dedicated UI dotenv contains only synthetic loopback configuration", async () => {
  const environment = await readFile(
    new URL("config/codex-test-ui.env", projectRoot),
    "utf8",
  );

  assert.match(environment, /NUXT_PUBLIC_FIREBASE_USE_EMULATOR=true/);
  assert.match(
    environment,
    /NUXT_PUBLIC_FIREBASE_PROJECT_ID=demo-air-guard-v2-codex/,
  );
  assert.match(environment, /NUXT_PUBLIC_FIREBASE_EMULATOR_HOST=127\.0\.0\.1/);
  for (const port of [19099, 18080, 19000, 19199, 15001]) {
    assert.match(environment, new RegExp(`=${port}(?:\\r?\\n|$)`));
  }
  assert.doesNotMatch(environment, /air-guard-v2-(?:dev|prod)/i);
});

test("dedicated UI commands remain separate foreground processes", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", projectRoot), "utf8"),
  );
  const emulators = packageJson.scripts["test:local:emulators"];
  const server = packageJson.scripts["test:local:ui:server"];

  assert.match(emulators, /firebase\.codex-test\.json/);
  assert.match(emulators, /--project demo-air-guard-v2-codex/);
  assert.match(emulators, /emulators:start/);
  assert.match(server, /--dotenv config\/codex-test-ui\.env/);
  assert.match(server, /--host 127\.0\.0\.1 --port 14600/);
  assert.doesNotMatch(`${emulators}\n${server}`, /Start-Process|--detach|&\s*$/);
});

test("flagged PowerShell UI child helper is absent", async () => {
  await assert.rejects(
    access(new URL("scripts/run-codex-local-ui-child.ps1", projectRoot)),
    (error) => error?.code === "ENOENT",
  );
});
