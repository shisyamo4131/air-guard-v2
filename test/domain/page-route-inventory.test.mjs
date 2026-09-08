import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getPageConfig } from "../../utils/pageSettings.js";

const pagesRoot = new URL("../../pages/", import.meta.url);

async function collectVueFiles(directoryUrl, prefix = "") {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...(await collectVueFiles(new URL(`${entry.name}/`, directoryUrl), relative)),
      );
    } else if (entry.isFile() && entry.name.endsWith(".vue")) {
      files.push(relative);
    }
  }
  return files;
}

function routeFromPage(relativePath) {
  const withoutExtension = relativePath.replace(/\.vue$/, "");
  const withoutIndex = withoutExtension.replace(/(^|\/)index$/, "");
  return `/${withoutIndex}`.replace(/\/$/, "") || "/";
}

test("every actual page route has an explicit page access configuration", async () => {
  const pageFiles = await collectVueFiles(pagesRoot);
  const actualRoutes = pageFiles.map(routeFromPage).sort();

  assert.equal(actualRoutes.includes("/test/user-permission-info"), false);
  for (const route of actualRoutes) {
    assert.equal(
      getPageConfig(route)?.path,
      route,
      `${route} must be explicitly registered`,
    );
  }
});
