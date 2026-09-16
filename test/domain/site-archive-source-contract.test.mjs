import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { operation, runtime } from "./employeeBackgroundTestSupport.mjs";
import { addOperationResultToBilling } from "../../functions/modules/billings/addOperationResultToBilling.js";
import { rebuildHistory } from "../../functions/modules/siteEmployeeHistories/rebuildHistory.js";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Site archive Callable and legacy client modules are absent after standard delete migration", async () => {
  for (const path of [
    "functions/apis/archiveSite.js",
    "functions/modules/sites/archiveSite.js",
    "functions/modules/sites/siteArchiveDocumentContract.js",
    "functions/modules/sites/mappers.js",
    "composables/site/useSiteFunctions.js",
    "components/Site/ArchiveDialog.vue",
  ]) await assert.rejects(access(new URL("../../" + path, import.meta.url)));
  const [index, detail] = await Promise.all([read("functions/apis/index.js"), read("pages/sites/[id].vue")]);
  assert.doesNotMatch(index + detail, /archiveSite|useSiteFunctions|Sites_archive/u);
});

test("Site Rules expose maintenance, actor, tenant, and exact raw atomic-pair boundaries", async () => {
  const rules = await read("firestore.rules");
  const live = rules.match(/match \/Companies\/\{companyId\}\/Sites\/\{docId\} \{([\s\S]*?)\n    \}/u)?.[1];
  const archive = rules.match(/match \/Companies\/\{companyId\}\/Sites_archive\/\{docId\} \{([\s\S]*?)\n    \}/u)?.[1];
  assert.ok(live); assert.ok(archive);
  for (const body of [live, archive]) assert.match(body, /isSystemMaintenanceOff\(\)/u);
  assert.match(live, /canWriteSite\(companyId\)/u);
  assert.match(live, /allow delete:[\s\S]*?!exists\([\s\S]*?Sites_archive[\s\S]*?\$\(docId\)/u);
  assert.match(live, /existsAfter\([\s\S]*?Sites_archive[\s\S]*?getAfter\([\s\S]*?\.data == resource\.data[\s\S]*?!existsAfter\([\s\S]*?Sites\/\$\(docId\)/u);
  assert.match(archive, /allow read, update, delete: if false;/u);
  assert.match(rules, /match \/Companies\/\{companyId\}\/Sites_archive\/\{document=\*\*\} \{\s*allow read, write: if false;/u);
});

test("Rules validate result identifiers without requiring live parent masters", async () => {
  const rules = await read("firestore.rules");
  assert.doesNotMatch(rules, /liveSiteExistsAfter|isValidSiteReferenceCreate|hasExistingCustomerReferenceAfter/u);
  assert.doesNotMatch(rules, /function isValidSiteReferenceUpdate/u);
  for (const collectionName of [
    "OperationResults", "ArrangementNotifications", "Billings", "SiteEmployeeHistories",
  ]) {
    const block = rules.match(
      new RegExp(`match /Companies/\\{companyId\\}/${collectionName}/\\{[^}]+\\} \\{([\\s\\S]*?)\\n    \\}`, "u"),
    )?.[1];
    assert.ok(block, `${collectionName} Rules block`);
    if (collectionName === "OperationResults") {
      assert.match(block, /allow read: if isAuthenticated\(\) && userCompanyId\(\) == companyId;/u);
      assert.match(block, /allow create:/u);
      assert.match(block, /allow update:/u);
      assert.match(block, /allow delete:/u);
      assert.doesNotMatch(rules, /isValidOperationResultClient(?:Create|Update|Delete)/u);
    }
    else if (collectionName === "ArrangementNotifications") {
      assert.match(block, /allow read, write: if isAuthenticated\(\) && userCompanyId\(\) == companyId;/u);
    } else if (collectionName === "Billings") {
      assert.match(block, /allow create, delete: if false;/u);
      assert.match(block, /allow update:[\s\S]*?userCompanyId\(\) == companyId[\s\S]*?request\.resource\.data\.uid == request\.auth\.uid;/u);
      assert.doesNotMatch(block, /exists\(|get\(|customerExists|siteExists|employeeExists/u);
    } else {
      assert.match(block, /allow write: if false;/u);
    }
  }
  const scheduleBlock = rules.match(
    /match \/Companies\/\{companyId\}\/SiteOperationSchedules\/\{docId\} \{([\s\S]*?)\n    \}/u,
  )?.[1];
  assert.ok(scheduleBlock);
  assert.match(scheduleBlock, /allow read, write: if isAuthenticated\(\) && userCompanyId\(\) == companyId;/u);
});

test("Schedule application uses Air managers and the existing model instead of the dedicated server writer", async () => {
  const [single, plural, handlers, actions, duplicator] = await Promise.all([
    read("components/SiteOperationSchedule/Manager/index.vue"),
    read("components/SiteOperationSchedules/Manager/index.vue"),
    read("handlers/siteOperationScheduleHandlers.js"),
    read("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js"),
    read("composables/useSiteOperationScheduleDuplicator.js"),
  ]);
  assert.match(single, /<air-item-manager/u);
  assert.match(plural, /<air-array-manager/u);
  assert.match(handlers, /item\.create\(\)/u);
  assert.match(handlers, /item\.update\(\)/u);
  assert.match(handlers, /item\.delete\(\)/u);
  assert.match(actions, /schedule\.update\(\)/u);
  assert.match(actions, /schedule\.notify\(\)/u);
  assert.match(duplicator, /instance\.duplicate\(selectedDates\.value\)/u);
  for (const client of [single, plural, handlers, actions, duplicator]) {
    assert.doesNotMatch(client, /useOperationSubmission|saveOperation|createSiteOperationScheduleWriter/u);
  }
});

test("Billing and SiteEmployeeHistory writers do not require a live Site master", async () => {
  const [billing, history] = await Promise.all([
    read("functions/modules/billings/billingReferencePlan.js"),
    read("functions/modules/siteEmployeeHistories/rebuildHistory.js"),
  ]);
  assert.doesNotMatch(billing, /assertLiveSiteReference|\/Sites\//u);
  assert.doesNotMatch(history, /\/Sites\//u);
  assert.match(history, /if \(firstSnapshot\.empty\)[\s\S]*?transaction\.delete\(historyRef\)/u);
  assert.match(await read("functions/modules/billings/addOperationResultToBilling.js"), /syncBillingReferences\(/u);
  // Execute both current entry paths. The shared runtime rejects any read after
  // a write; broader movement/raw/Employee cases live in background-references
  // and billing-customer-reference-barrier tests, not in this wiring contract.
  for (const writer of ["billing", "history"]) {
    const raw = operation(["a"]), root = "Companies/company";
    {
      const state = runtime({ records: [[`${root}/OperationResults/operation`, raw]] });
      state.data.delete(`${root}/Sites/site`);
      const save = () => writer === "billing"
        ? addOperationResultToBilling({ companyId: "company", doc: raw, firestore: state.firestore })
        : rebuildHistory("company", "site", "a", { firestore: state.firestore });
      await save(); assert.equal(state.writes.length, 1);
      assert.equal(state.events.filter((path) => path === `${root}/Sites/site`).length, 0);
    }
  }
});

test("Rules keep generic Site delete and every client Sites_archive write unavailable", async () => {
  const rules = await read("firestore.rules");
  const live = rules.match(
    /match \/Companies\/\{companyId\}\/Sites\/\{docId\} \{([\s\S]*?)\n    \}/u,
  )?.[1];
  const archive = rules.match(
    /match \/Companies\/\{companyId\}\/Sites_archive\/\{docId\} \{([\s\S]*?)\n    \}/u,
  )?.[1];
  assert.ok(live);
  assert.ok(archive);
  assert.match(
    live,
    /allow create:[\s\S]*?!exists\([\s\S]*?\/Sites_archive\/\$\(docId\)\)/u,
  );
  assert.match(live, /allow delete:[\s\S]*?existsAfter\([\s\S]*?Sites_archive[\s\S]*?getAfter\([\s\S]*?\.data == resource\.data/u);
  assert.match(archive, /allow read, update, delete: if false;/u);
  assert.match(archive, /allow read, update, delete:\s*if false;/u);
  assert.match(archive, /allow create:[\s\S]*?isSystemMaintenanceOff\(\)[\s\S]*?canWriteSite\(companyId\)/u);
});
