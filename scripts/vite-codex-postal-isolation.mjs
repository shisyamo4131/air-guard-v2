import { realpathSync } from "node:fs";
import { resolve } from "node:path";

export const CODEX_POSTAL_ISOLATION_RECEIPT_FILE = "codex-postal-isolation.json";
export const CODEX_POSTAL_ISOLATION_RECEIPT = Object.freeze({
  schemaVersion: 1,
  kind: "codex-postal-isolation",
  mode: "async-null",
  target: "air-vuetify-v3/src/utils/postalCode.js",
});

function normalizeModulePath(id) {
  const path = id.replace(/\\/g, "/").split(/[?#]/)[0].replace(/^\/@fs\//, "");
  return process.platform === "win32" ? path.toLowerCase() : path;
}

export function createCodexPostalIsolationPlugin({ projectRoot }) {
  let targetPath;
  let replaced = false;

  return {
    name: "codex-postal-isolation",
    apply: "build",
    enforce: "pre",
    configResolved(config) {
      if (config.command !== "build" || config.build?.ssr) {
        throw new Error("Postal isolation requires a dedicated client build.");
      }
    },
    buildStart() {
      replaced = false;
      try {
        targetPath = normalizeModulePath(realpathSync(resolve(
          projectRoot,
          CODEX_POSTAL_ISOLATION_RECEIPT.target,
        )));
      } catch {
        this.error("Dedicated UI postal isolation target is missing.");
      }
    },
    transform(_code, id, options) {
      const sourcePath = id.replace(/\\/g, "/").split(/[?#]/)[0]
        .replace(/^\/@fs\//, "");
      if (!sourcePath.toLowerCase().endsWith("/postalcode.js")) return null;
      let resolvedPath;
      try {
        resolvedPath = normalizeModulePath(realpathSync(sourcePath));
      } catch {
        return null;
      }
      if (resolvedPath !== targetPath) return null;
      if (options?.ssr) {
        this.error("Postal isolation requires a dedicated client build.");
      }
      replaced = true;
      return {
        code: "export async function fetchAddressFromPostalCode() { return null; }\n",
        map: { mappings: "" },
      };
    },
    generateBundle() {
      if (!replaced) {
        this.error("Dedicated UI postal isolation was not applied.");
      }
      this.emitFile({
        type: "asset",
        fileName: CODEX_POSTAL_ISOLATION_RECEIPT_FILE,
        source: `${JSON.stringify(CODEX_POSTAL_ISOLATION_RECEIPT)}\n`,
      });
    },
  };
}
