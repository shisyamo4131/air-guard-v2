import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CODEX_UI_BUILD_IDENTITY_FILE,
  createCodexUiBuildIdentity,
} from "./codex-local-ui-build-identity.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(projectRoot, ".output");
const markerPath = resolve(outputRoot, CODEX_UI_BUILD_IDENTITY_FILE);
const temporaryMarkerPath = `${markerPath}.${process.pid}.tmp`;
const nuxtCli = resolve(projectRoot, "node_modules/nuxt/bin/nuxt.mjs");

const identityBefore = await createCodexUiBuildIdentity(projectRoot);
await rm(markerPath, { force: true });
await rm(temporaryMarkerPath, { force: true });

const result = spawnSync(
  process.execPath,
  [nuxtCli, "build", "--dotenv", "config/codex-test-ui.env"],
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
if (result.status !== 0) process.exit(result.status ?? 1);

await readFile(resolve(outputRoot, "server/index.mjs"));
const identityAfter = await createCodexUiBuildIdentity(projectRoot);
if (JSON.stringify(identityAfter) !== JSON.stringify(identityBefore)) {
  throw new Error("Source identity changed while building the dedicated UI.");
}

await mkdir(outputRoot, { recursive: true });
await writeFile(
  temporaryMarkerPath,
  `${JSON.stringify(identityAfter, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);
await rename(temporaryMarkerPath, markerPath);
