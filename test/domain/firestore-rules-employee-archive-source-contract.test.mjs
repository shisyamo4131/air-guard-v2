import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = () => readFile(new URL("../../firestore.rules", import.meta.url), "utf8");

test("Employee Rules require same-ID raw archive pairing and collision safety", async () => {
  const source = await read();
  const live = source.match(/match \/Companies\/\{companyId\}\/Employees\/\{docId\} \{([\s\S]*?)\n    \}/u)?.[1];
  const archive = source.match(/match \/Companies\/\{companyId\}\/Employees_archive\/\{docId\} \{([\s\S]*?)\n    \}/u)?.[1];
  assert.ok(live); assert.ok(archive);
  for (const body of [live, archive]) {
    assert.match(body, /isAuthenticated\(\)/u);
    assert.match(body, /userCompanyId\(\) == companyId/u);
    assert.match(body, /isSystemMaintenanceOff\(\)/u);
  }
  assert.doesNotMatch(live, /canReadEmployee\(companyId\)/u);
  assert.match(archive, /allow read:[\s\S]*?canReadEmployee\(companyId\)/u);
  assert.match(live, /allow create:[\s\S]*?!exists\([\s\S]*?Employees_archive[\s\S]*?\$\(docId\)/u);
  assert.match(live, /allow delete:[\s\S]*?existsAfter\([\s\S]*?Employees_archive[\s\S]*?getAfter\([\s\S]*?\.data == resource\.data[\s\S]*?!existsAfter\([\s\S]*?Employees\/\$\(docId\)/u);
  assert.match(archive, /allow create:[\s\S]*?exists\([\s\S]*?Employees\/\$\(docId\)[\s\S]*?\.data == request\.resource\.data[\s\S]*?!existsAfter\([\s\S]*?Employees\/\$\(docId\)/u);
  assert.match(archive, /allow update, delete: if false;/u);
  const fallback = source.match(/match \/Companies\/\{companyId\}\/\{collection\}\/\{document=\*\*\} \{([\s\S]*?)\n    \}/u)?.[1];
  assert.ok(fallback);
  assert.match(fallback, /collection != "Sites"/u);
  assert.match(fallback, /"Employees_archive"/u);
  assert.match(fallback, /"EmployeeUserReservations"/u);
});

test("Employee lifecycle and User/Auth protection remain server-only", async () => {
  const source = await read();
  assert.match(source, /match \/Companies\/\{companyId\}\/Users\/\{userId\} \{[\s\S]*?allow create, update, delete: if false;/u);
  for (const collection of ["EmployeeUserReservations", "LifecycleOperations", "EmployeeLifecycleLocks", "EmployeeLifecycleHeads"]) {
    assert.match(source, new RegExp(`match /Companies/\\{companyId\\}/${collection}/\\{document=\\*\\*\\} \\{\\s*allow read, write: if false;`, "u"), collection);
  }
});
