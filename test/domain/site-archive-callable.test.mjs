import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("Site archive Callable and legacy client modules are absent", async () => {
  for (const path of [
    "functions/apis/archiveSite.js",
    "functions/modules/sites/archiveSite.js",
    "functions/modules/sites/siteArchiveDocumentContract.js",
    "functions/modules/sites/mappers.js",
    "composables/site/useSiteFunctions.js",
    "components/Site/ArchiveDialog.vue",
  ]) await assert.rejects(access(new URL("../../" + path, import.meta.url)));
  const [index, detail] = await Promise.all([
    readFile(new URL("../../functions/apis/index.js", import.meta.url), "utf8"),
    readFile(new URL("../../pages/sites/[id].vue", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(index + detail, /archiveSite|useSiteFunctions|Sites_archive/u);
});
