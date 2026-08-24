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

test("Companies fallback cannot override Employee reservation denial", async () => {
  const source = await readFile(rulesUrl, "utf8");
  const fallback = source.match(
    /match \/Companies\/\{companyId\}\/\{collection\}\/\{document=\*\*\} \{([\s\S]*?)\n    \}/,
  )?.[1];
  assert.ok(fallback);
  const executable = fallback.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").trim();
  assert.equal(
    executable,
    'allow read, write: if isAuthenticated() && userCompanyId() == companyId && collection != "SecurityReportIndexes" && collection != "StripeData" && collection != "Users" && collection != "Employees" && collection != "EmployeeUserReservations" && collection != "LifecycleOperations" && collection != "UserLifecycleLocks" && collection != "EmployeeLifecycleLocks" && collection != "EmployeeLifecycleHeads";',
  );
});
