import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const productionRoots = [
  "components",
  "composables",
  "layouts",
  "middleware",
  "pages",
  "plugins",
  "stores",
  "utils",
];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".vue"]);
const forbiddenReference = /functions[\\/]+shared(?:[\\/]|(?=["'`]))/u;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(target);
    }
  }
  return files;
}

test("production client sources do not reference functions/shared", async () => {
  const files = (
    await Promise.all(
      productionRoots.map((root) => sourceFiles(path.join(repositoryRoot, root))),
    )
  ).flat();
  const violations = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (forbiddenReference.test(source)) {
      violations.push(path.relative(repositoryRoot, file).replaceAll("\\", "/"));
    }
  }
  assert.deepEqual(
    violations,
    [],
    `client production sources must not cross the Functions shared boundary:\n${violations.join("\n")}`,
  );
});
