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
    .concat(
      [...executable.matchAll(/collection != "([^"]+)"/gu)]
        .map((match) => match[1]),
    )
    .sort();
  assert.deepEqual(
    excludedCollections,
    [
      "ArrangementNotifications",
      "Billings",
      "Customers",
      "Customers_archive",
      "DailyAttendances",
      "DailyOperationsByEmployee",
      "EmployeeLifecycleHeads",
      "EmployeeLifecycleLocks",
      "EmployeeUserReservations",
      "Employees",
      "Employees_archive",
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
  assert.match(executable, /^allow read, write: if collection != "Sites" &&/u);
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
    if (collectionName === "ArrangementNotifications") {
      assert.match(body, /allow read, write: if isAuthenticated\(\) && userCompanyId\(\) == companyId;/u);
    } else {
      assert.match(body, /allow write: if false;/u);
    }
  }
});

test("Customer reference collections use explicit guarded matches outside the fallback", async () => {
  const source = await readFile(rulesUrl, "utf8");
  const contracts = [
    {
      collectionName: "Billings",
    },
  ];

  for (const { collectionName } of contracts) {
    const escapedCollectionName = collectionName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const body = source.match(
      new RegExp(
        `match /Companies/\\{companyId\\}/${escapedCollectionName}/\\{docId\\} \\{([\\s\\S]*?)\\n    \\}`,
        "u",
      ),
    )?.[1];
    assert.ok(body, `${collectionName} must have an explicit document match`);
    assert.match(body, /allow write: if false;/u);
  }

  const operationResultBody = source.match(
    /match \/Companies\/\{companyId\}\/OperationResults\/\{docId\} \{([\s\S]*?)\n    \}/u,
  )?.[1];
  assert.ok(operationResultBody, "OperationResults must have an explicit document match");
  assert.match(
    operationResultBody,
    /allow create:[\s\S]*?userCompanyId\(\) == companyId[\s\S]*?isValidOperationResultClientCreate\(docId\)/u,
  );
  assert.match(
    source,
    /function isValidOperationResultClientCreate\(docId\)[\s\S]*?request\.resource\.data\.siteId is string[\s\S]*?request\.resource\.data\.customerId is string[\s\S]*?request\.resource\.data\.docId == docId[\s\S]*?request\.resource\.data\.uid == request\.auth\.uid[\s\S]*?request\.resource\.data\.isLocked == false[\s\S]*?request\.resource\.data\.siteOperationScheduleId == null[\s\S]*?request\.resource\.data\.articles\.size\(\) == 0[\s\S]*?request\.resource\.data\.workers\.size\(\) == 0[\s\S]*?request\.resource\.data\.billingCalculationVersion == 2/u,
  );
  assert.doesNotMatch(source, /isValidSiteReferenceCreate|hasExistingCustomerReferenceAfter|liveSiteExistsAfter/u);
  assert.match(
    operationResultBody,
    /allow update:[\s\S]*?userCompanyId\(\) == companyId[\s\S]*?isValidOperationResultClientUpdate\(docId\)/u,
  );
  assert.match(
    source,
    /function isValidOperationResultClientUpdate\(docId\)[\s\S]*?resource\.data\.docId == docId[\s\S]*?request\.resource\.data\.docId == docId[\s\S]*?resource\.data\.isLocked == false[\s\S]*?request\.resource\.data\.uid == request\.auth\.uid/u,
  );
  assert.doesNotMatch(source, /isValid(?:Site|Customer)ReferenceUpdate/u);
  assert.match(
    operationResultBody,
    /allow delete:[\s\S]*?userCompanyId\(\) == companyId[\s\S]*?isValidOperationResultClientDelete\(docId\)/u,
  );
  assert.match(
    source,
    /function isValidOperationResultClientDelete\(docId\)[\s\S]*?resource\.data\.docId == docId[\s\S]*?resource\.data\.isLocked == false/u,
  );

  const siteBody = source.match(
    /match \/Companies\/\{companyId\}\/Sites\/\{docId\} \{([\s\S]*?)\n    \}/u,
  )?.[1];
  assert.ok(siteBody, "Sites must have an explicit document match");
  assert.match(siteBody, /isValidSiteCreate\(companyId, docId\)/u);
  assert.match(siteBody, /isValidSiteUpdate\(companyId, docId\)/u);
  assert.match(
    source,
    /function isValidSiteCreate\(companyId, docId\)[\s\S]*?data\.docId == docId[\s\S]*?data\.uid == request\.auth\.uid[\s\S]*?data\.status == 'ACTIVE'[\s\S]*?data\.agreementsV2\.size\(\) == 0[\s\S]*?hasValidSiteCustomerCreate\(companyId, data\)/u,
  );
  assert.match(
    source,
    /function isValidSiteUpdate\(companyId, docId\)[\s\S]*?resource\.data\.status == 'ACTIVE'[\s\S]*?request\.resource\.data\.status == 'ACTIVE'[\s\S]*?request\.resource\.data\.docId == docId[\s\S]*?request\.resource\.data\.uid == request\.auth\.uid[\s\S]*?hasValidSiteCustomerUpdate\(companyId\)/u,
  );
  assert.match(
    source,
    /function hasValidSiteCustomerCreate\(companyId, data\)[\s\S]*?customerExists\(companyId, data\.customerId\)/u,
  );
  assert.match(
    source,
    /function hasValidSiteCustomerUpdate\(companyId\)[\s\S]*?customerExists\(companyId, request\.resource\.data\.customerId\)/u,
  );
  const siteCustomerHelpers = source.match(
    /function hasValidSiteCustomerCreate\(companyId, data\)[\s\S]*?function isValidSiteCreate/u,
  )?.[0];
  assert.ok(siteCustomerHelpers);
  assert.doesNotMatch(siteCustomerHelpers, /hasCurrentSiteCustomerSnapshot/u);
  assert.doesNotMatch(siteCustomerHelpers, /keys\(\)\.hasOnly/u);
  assert.doesNotMatch(siteCustomerHelpers, /request\.time/u);
  assert.match(
    source,
    /!changed\.hasAny\(\['status'\]\)/u,
  );
  assert.doesNotMatch(siteCustomerHelpers, /!changed\.hasAny\([^)]*agreementsV2/u);
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
