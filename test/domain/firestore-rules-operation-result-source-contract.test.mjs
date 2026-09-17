import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = () => readFile(new URL("../../firestore.rules", import.meta.url), "utf8");

test("OperationResults Rules source separates CRUD and preserves tenant, uid, docId, and lock invariants", async () => {
  const rules = await source();
  const block = rules.match(/match \/Companies\/\{companyId\}\/OperationResults\/\{docId\} \{([\s\S]*?)\n    \}/u)?.[1];
  assert.ok(block);
  assert.match(block, /allow read: if isAuthenticated\(\) && userCompanyId\(\) == companyId/u);
  assert.match(block, /allow create:[\s\S]*?request\.resource\.data\.docId == docId[\s\S]*?request\.resource\.data\.uid == request\.auth\.uid[\s\S]*?isLocked == false/u);
  assert.match(block, /allow update:[\s\S]*?resource\.data\.docId == docId[\s\S]*?request\.resource\.data\.docId == docId[\s\S]*?request\.resource\.data\.uid == request\.auth\.uid/u);
  assert.match(block, /allow delete:[\s\S]*?resource\.data\.docId == docId[\s\S]*?resource\.data\.isLocked == false/u);
  const update = block.slice(block.indexOf("allow update:"), block.indexOf("allow delete:"));
  assert.doesNotMatch(update, /isLocked == false/u, "locked updates remain possible through the standard model path");
});
