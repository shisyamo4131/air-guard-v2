import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rulesUrl = new URL("../../firestore.rules", import.meta.url);

test("reservation collections are recursively server-only", async () => {
  const source = await readFile(rulesUrl, "utf8");
  assert.match(
    source,
    /match \/UserEmailReservations\/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/,
  );
  assert.match(
    source,
    /match \/Companies\/\{companyId\}\/EmployeeUserReservations\/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/,
  );
});

test("Companies fallback reserves every protected collection before tenant access", async () => {
  const source = await readFile(rulesUrl, "utf8");
  const fallback = source.match(
    /match \/Companies\/\{companyId\}\/\{collection\}\/\{document=\*\*\} \{([\s\S]*?)\n    \}/,
  )?.[1];
  assert.ok(fallback);
  const executable = fallback.replace(/\/\/.*$/gmu, "").replace(/\s+/gu, " ").trim();
  const exclusionList = executable.match(
    /!\(collection in \[([^\]]+)\]\)/u,
  )?.[1];
  assert.ok(exclusionList);
  const excludedCollections = [...exclusionList.matchAll(/"([^"]+)"/gu)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    excludedCollections,
    [
      "Customers",
      "Customers_archive",
      "EmployeeLifecycleHeads",
      "EmployeeLifecycleLocks",
      "EmployeeUserReservations",
      "Employees",
      "LifecycleOperations",
      "SecurityReportIndexes",
      "StripeData",
      "UserLifecycleLocks",
      "Users",
    ].sort(),
  );
  assert.match(executable, /&& isAuthenticated\(\) && userCompanyId\(\) == companyId;/u);
});

test("StripeData is recursively denied and excluded from the Companies fallback", async () => {
  const source = await readFile(rulesUrl, "utf8");
  assert.match(
    source,
    /match \/Companies\/\{companyId\}\/StripeData\/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/u,
  );
  assert.match(source, /!\(collection in \[[\s\S]*?"StripeData"[\s\S]*?\]\)/u);
});
