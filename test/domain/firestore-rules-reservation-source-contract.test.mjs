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
      "ArrangementNotifications",
      "Billings",
      "Customers",
      "Customers_archive",
      "EmployeeLifecycleHeads",
      "EmployeeLifecycleLocks",
      "EmployeeUserReservations",
      "Employees",
      "LifecycleOperations",
      "OperationResults",
      "Outsourcers",
      "Outsourcers_archive",
      "SecurityReportIndexes",
      "Sites",
      "Sites_archive",
      "SiteEmployeeHistories",
      "SiteOperationSchedules",
      "StripeData",
      "UserLifecycleLocks",
      "Users",
    ].sort(),
  );
  assert.match(executable, /&& isAuthenticated\(\) && userCompanyId\(\) == companyId;/u);
});

test("Site-reference collections use explicit guards and cannot fall through tenant access", async () => {
  const source = await readFile(rulesUrl, "utf8");

  for (const collectionName of [
    "ArrangementNotifications",
    "SiteEmployeeHistories",
  ]) {
    const body = source.match(
      new RegExp(
        `match /Companies/\\{companyId\\}/${collectionName}/\\{(?:id|docId)\\} \\{([\\s\\S]*?)\\n    \\}`,
        "u",
      ),
    )?.[1];
    assert.ok(body, `${collectionName} must have an explicit document match`);
    assert.match(body, /isValidSiteReferenceCreate\(companyId\)/u);
    assert.match(body, /isValidSiteReferenceUpdate\(companyId\)/u);
  }
});

test("Customer reference collections use explicit guarded matches outside the fallback", async () => {
  const source = await readFile(rulesUrl, "utf8");
  const contracts = [
    {
      collectionName: "Billings",
      createGuard: "isValidCustomerReferenceCreate",
      updateGuard: "isValidCustomerReferenceUpdate",
    },
    {
      collectionName: "OperationResults",
      createGuard: "isValidCustomerReferenceCreate",
      updateGuard: "isValidCustomerReferenceUpdate",
    },
  ];

  for (const { collectionName, createGuard, updateGuard } of contracts) {
    const escapedCollectionName = collectionName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const body = source.match(
      new RegExp(
        `match /Companies/\\{companyId\\}/${escapedCollectionName}/\\{docId\\} \\{([\\s\\S]*?)\\n    \\}`,
        "u",
      ),
    )?.[1];
    assert.ok(body, `${collectionName} must have an explicit document match`);
    assert.match(body, new RegExp(`${createGuard}\\(companyId\\)`, "u"));
    assert.match(body, new RegExp(`${updateGuard}\\(companyId\\)`, "u"));
  }

  const siteBody = source.match(
    /match \/Companies\/\{companyId\}\/Sites\/\{docId\} \{([\s\S]*?)\n    \}/u,
  )?.[1];
  assert.ok(siteBody, "Sites must have an explicit document match");
  assert.match(siteBody, /isValidSiteCreate\(companyId, docId\)/u);
  assert.match(siteBody, /isValidSiteUpdate\(companyId, docId\)/u);
  assert.match(
    source,
    /function isValidSiteCreate\(companyId, docId\)[\s\S]*?hasValidSiteCustomerCreate\(companyId, data\)/u,
  );
  assert.match(
    source,
    /function isValidSiteUpdate\(companyId, docId\)[\s\S]*?hasValidSiteCustomerUpdate\(companyId\)/u,
  );
  assert.match(
    source,
    /function hasValidSiteCustomerCreate\(companyId, data\)[\s\S]*?hasCurrentSiteCustomerSnapshot\(\s*data\.customer,\s*get\(\/databases\/\$\(database\)\/documents\/Companies\/\$\(companyId\)\/Customers\/\$\(data\.customerId\)\)\.data\s*\)/u,
  );
  assert.match(
    source,
    /function hasValidSiteCustomerUpdate\(companyId\)[\s\S]*?hasCurrentSiteCustomerSnapshot\(\s*request\.resource\.data\.customer,\s*get\(\/databases\/\$\(database\)\/documents\/Companies\/\$\(companyId\)\/Customers\/\$\(request\.resource\.data\.customerId\)\)\.data\s*\)/u,
  );
  assert.match(
    source,
    /function hasCurrentSiteCustomerSnapshot\(snapshot, customer\) \{\s*return snapshot is map\s*&& snapshot\.keys\(\)\.size\(\) == 6\s*&& snapshot\.keys\(\)\.hasOnly\(\[\s*'docId', 'updatedAt', 'code', 'name', 'abbreviation', 'cutoffDate'\s*\]\)\s*&& snapshot\.docId == customer\.docId\s*&& snapshot\.updatedAt == customer\.updatedAt\s*&& snapshot\.code == customer\.code\s*&& snapshot\.name == customer\.name\s*&& snapshot\.abbreviation == customer\.abbreviation\s*&& snapshot\.cutoffDate == customer\.cutoffDate;\s*\}/u,
  );
  const siteCustomerHelpers = source.match(
    /function hasValidSiteCustomerCreate\(companyId, data\)[\s\S]*?function isValidSiteUpdateMetadata/u,
  )?.[0];
  assert.ok(siteCustomerHelpers);
  assert.doesNotMatch(siteCustomerHelpers, /customerExists\(/u);
});

test("Customers_archive is recursively denied before the Companies fallback", async () => {
  const source = await readFile(rulesUrl, "utf8");
  assert.match(
    source,
    /match \/Companies\/\{companyId\}\/Customers_archive\/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/u,
  );
});

test("StripeData is recursively denied and excluded from the Companies fallback", async () => {
  const source = await readFile(rulesUrl, "utf8");
  assert.match(
    source,
    /match \/Companies\/\{companyId\}\/StripeData\/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/u,
  );
  assert.match(source, /!\(collection in \[[\s\S]*?"StripeData"[\s\S]*?\]\)/u);
});
