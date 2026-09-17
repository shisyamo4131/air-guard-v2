import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = () => readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
test("Customer Rules require archive collision safety and atomic raw exact same-ID pairing", async () => {
  const source = await read();
  const live = source.match(/match \/Companies\/\{companyId\}\/Customers\/\{docId\} \{([\s\S]*?)\n    \}/u)?.[1];
  const archive = source.match(/match \/Companies\/\{companyId\}\/Customers_archive\/\{docId\} \{([\s\S]*?)\n    \}/u)?.[1];
  assert.ok(live); assert.ok(archive);
  for (const body of [live, archive]) assert.match(body, /isSystemMaintenanceOff\(\)/u);
  assert.match(live, /allow create:[\s\S]*?isSystemMaintenanceOff\(\)/u);
  assert.match(live, /allow update:[\s\S]*?isSystemMaintenanceOff\(\)/u);
  assert.match(live, /allow delete:[\s\S]*?isSystemMaintenanceOff\(\)/u);
  assert.match(archive, /allow create:[\s\S]*?isSystemMaintenanceOff\(\)/u);
  assert.match(live, /allow create:[\s\S]*?!exists\(\/databases\/\$\(database\)\/documents\/Companies\/\$\(companyId\)\/Customers_archive\/\$\(docId\)\)/u);
  assert.match(live, /allow delete:[\s\S]*?!exists\(\/databases\/\$\(database\)\/documents\/Companies\/\$\(companyId\)\/Customers_archive\/\$\(docId\)\)[\s\S]*?existsAfter\(\/databases\/\$\(database\)\/documents\/Companies\/\$\(companyId\)\/Customers_archive\/\$\(docId\)\)/u);
  assert.match(live, /allow delete:[\s\S]*?existsAfter\([\s\S]*?Customers_archive[\s\S]*?getAfter\([\s\S]*?\.data == resource\.data[\s\S]*?!existsAfter\([\s\S]*?Customers\/\$\(docId\)/u);
  assert.match(archive, /allow read, update, delete: if false;/u);
  assert.match(archive, /allow create:[\s\S]*?exists\([\s\S]*?Customers\/\$\(docId\)[\s\S]*?\.data == request\.resource\.data[\s\S]*?!existsAfter\([\s\S]*?Customers\/\$\(docId\)/u);
  assert.match(source, /match \/Companies\/\{companyId\}\/Customers_archive\/\{document=\*\*\} \{\s*allow read, write: if false;/u);
});
