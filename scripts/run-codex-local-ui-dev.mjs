import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readDedicatedConfigFingerprint } from "./codex-local-ui-build-identity.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nuxtCli = resolve(projectRoot, "node_modules/nuxt/bin/nuxt.mjs");

await readDedicatedConfigFingerprint(projectRoot);

const result = spawnSync(
  process.execPath,
  [
    nuxtCli,
    "dev",
    "--dotenv",
    "config/codex-test-ui.env",
    "--host",
    "127.0.0.1",
    "--port",
    "14600",
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      AIR_GUARD_EXTERNAL_EFFECTS: "deny",
    },
    stdio: "inherit",
    windowsHide: true,
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
