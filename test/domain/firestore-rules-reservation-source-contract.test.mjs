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
    'allow read, write: if isAuthenticated() && userCompanyId() == companyId && collection != "SecurityReportIndexes" && collection != "StripeData" && collection != "Users" && collection != "Employees" && collection != "EmployeeUserReservations" && collection != "LifecycleOperations" && collection != "UserLifecycleLocks" && collection != "EmployeeLifecycleLocks" && collection != "EmployeeLifecycleHeads" && collection != "Settings" && collection != "PrivateSettings" && collection != "SettingAudits";',
  );
});

test("CCB collections are recursively server-only and excluded from the Companies fallback", async () => {
  const source = await readFile(rulesUrl, "utf8");
  for (const collection of ["Settings", "PrivateSettings", "SettingAudits"]) {
    assert.match(
      source,
      new RegExp(
        `match /Companies/\\{companyId\\}/${collection}/\\{document=\\*\\*\\} \\{\\s*allow read, write: if false;\\s*\\}`,
      ),
    );
    assert.match(source, new RegExp(`collection != "${collection}"`));
  }
});

test("Company root pre-containment preserves the exact reserved-field contract", async () => {
  const source = await readFile(rulesUrl, "utf8");
  const helper = source.match(
    /function preservesPreContainmentCompanyRootFields\(\) \{([\s\S]*?)\n    \}/,
  )?.[1];
  assert.ok(helper);
  assert.equal(
    helper.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").trim(),
    "return !request.resource.data.diff(resource.data).affectedKeys().hasAny([ 'status', 'schemaVersion', 'configurationState', 'createdBy', 'updatedBy' ]) && (!resource.data.keys().hasAny(['createdAt']) || (request.resource.data.keys().hasAll(['createdAt']) && request.resource.data.createdAt == resource.data.createdAt));",
  );

  const activeGuard = source.match(
    /function isCcbV1ActiveCompanyRoot\(\) \{([\s\S]*?)\n    \}/,
  )?.[1];
  assert.ok(activeGuard);
  assert.equal(
    activeGuard.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").trim(),
    "return resource.data.keys().hasAll(['schemaVersion', 'configurationState']) && resource.data.schemaVersion == 1 && resource.data.configurationState == 'CCB_V1_ACTIVE';",
  );

  const rootMatch = source.match(
    /match \/Companies\/\{companyDocId\} \{([\s\S]*?)\n    \}/,
  )?.[1];
  assert.ok(rootMatch);
  assert.equal(
    rootMatch.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").trim(),
    "allow read: if isAuthenticated() && userCompanyId() == companyDocId; allow update: if isAuthenticated() && userCompanyId() == companyDocId && !isCcbV1ActiveCompanyRoot() && preservesPreContainmentCompanyRootFields(); allow create, delete: if false;",
  );
});
