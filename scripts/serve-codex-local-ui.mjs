import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CODEX_UI_BUILD_IDENTITY_FILE,
  assertCodexUiBuildIdentity,
  createDedicatedUiEnvironment,
} from "./codex-local-ui-build-identity.mjs";

const DEDICATED_ENVIRONMENT = Object.freeze({
  NITRO_HOST: "127.0.0.1",
  NITRO_PORT: "14600",
  AIR_GUARD_EXTERNAL_EFFECTS: "deny",
});

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const markerPath = resolve(
  projectRoot,
  ".output",
  CODEX_UI_BUILD_IDENTITY_FILE,
);

let identity;
try {
  identity = JSON.parse(await readFile(markerPath, "utf8"));
} catch {
  throw new Error("Dedicated UI build identity is missing or unreadable.");
}
await assertCodexUiBuildIdentity(projectRoot, identity);
const environment = await createDedicatedUiEnvironment(projectRoot);
for (const name of Object.keys(process.env)) {
  if (
    name.toUpperCase().startsWith("NUXT_PUBLIC_FIREBASE_") ||
    name.toUpperCase() === "AIR_GUARD_EXTERNAL_EFFECTS"
  ) delete process.env[name];
}
Object.assign(process.env, environment);

for (const [name, expected] of Object.entries(DEDICATED_ENVIRONMENT)) {
  const current = process.env[name];
  if (current && current !== expected) {
    throw new Error(`${name} conflicts with the dedicated UI server.`);
  }
  process.env[name] = expected;
}

await import("../.output/server/index.mjs");
