import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CODEX_UI_BUILD_IDENTITY_FILE,
  createCodexUiBuildIdentity,
  createDedicatedUiEnvironment,
} from "./codex-local-ui-build-identity.mjs";
import {
  CODEX_POSTAL_ISOLATION_RECEIPT,
  CODEX_POSTAL_ISOLATION_RECEIPT_FILE,
} from "./vite-codex-postal-isolation.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(projectRoot, ".output");
const markerPath = resolve(outputRoot, CODEX_UI_BUILD_IDENTITY_FILE);
const temporaryMarkerPath = `${markerPath}.${process.pid}.tmp`;
const nuxtCli = resolve(projectRoot, "node_modules/nuxt/bin/nuxt.mjs");
const postalReceiptPath = resolve(outputRoot, "public", CODEX_POSTAL_ISOLATION_RECEIPT_FILE);
const clientPostalReceiptPath = resolve(projectRoot, ".nuxt/dist/client", CODEX_POSTAL_ISOLATION_RECEIPT_FILE);

await rm(markerPath, { force: true });
await rm(temporaryMarkerPath, { force: true });
await rm(postalReceiptPath, { force: true });
await rm(clientPostalReceiptPath, { force: true });
const environment = await createDedicatedUiEnvironment(projectRoot);
const identityBefore = await createCodexUiBuildIdentity(projectRoot);

const result = spawnSync(
  process.execPath,
  [nuxtCli, "build", "--dotenv", "config/codex-test-ui.env"],
  {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

await readFile(resolve(outputRoot, "server/index.mjs"));
let postalReceipt;
try {
  postalReceipt = JSON.parse(await readFile(clientPostalReceiptPath, "utf8"));
} catch {
  throw new Error("Dedicated UI postal isolation receipt is missing or unreadable.");
}
if (JSON.stringify(postalReceipt) !== JSON.stringify(CODEX_POSTAL_ISOLATION_RECEIPT)) {
  throw new Error("Dedicated UI postal isolation receipt does not match.");
}
const identityAfter = await createCodexUiBuildIdentity(projectRoot);
if (JSON.stringify(identityAfter) !== JSON.stringify(identityBefore)) {
  throw new Error("Source identity changed while building the dedicated UI.");
}

// Nuxt only copies buildAssetsDir, not assets emitted at the client output root.
// Transfer this validated receipt explicitly before establishing build identity.
await mkdir(dirname(postalReceiptPath), { recursive: true });
await writeFile(
  postalReceiptPath,
  `${JSON.stringify(postalReceipt)}\n`,
  { encoding: "utf8", flag: "wx" },
);
await writeFile(
  temporaryMarkerPath,
  `${JSON.stringify(identityAfter, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);
await rename(temporaryMarkerPath, markerPath);
