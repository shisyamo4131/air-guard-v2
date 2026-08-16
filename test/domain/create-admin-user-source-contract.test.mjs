import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../composables/useCreateAdminUser.js",
  import.meta.url,
);

test("administrator signup sends no client-selected preflight policy", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /checkEmailAvailability\(\{ email \}\)/);
  assert.equal(source.includes("isAdmin"), false);
  assert.equal(source.includes("checkEmailAvailabilityGlobal"), false);
});
