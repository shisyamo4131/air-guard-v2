import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Site archive UI reaches only the dedicated Callable and exposes no generic delete or restore path", async () => {
  const paths = [
    "pages/sites/[id].vue",
    "components/Site/ArchiveDialog.vue",
    "composables/application/site/useSiteArchiveAction.js",
    "composables/site/useSiteFunctions.js",
    "composables/domain/site/siteArchiveUiContract.js",
  ];
  const [detail, dialog, ...rest] = await Promise.all(paths.map(read));
  const combined = [detail, dialog, ...rest].join("\n");
  assert.match(detail, /<SiteArchiveDialog\s+v-if="canWrite"\s+:site="doc"\s+@archived="handleArchived"/u);
  assert.match(detail, /function handleArchived\(\)\s*\{[\s\S]*?navigateTo\("\/sites"\)/u);
  assert.match(dialog, /useSiteArchiveAction\(\)/u);
  assert.match(combined, /httpsCallable\(\$functions, name\)\(input\)/u);
  assert.match(combined, /archiveSite:\s*\(input\)\s*=>\s*call\("archiveSite", input\)/u);
  assert.doesNotMatch(combined, /Sites_archive/u);
  assert.doesNotMatch(combined, /from "firebase\/firestore"/u);
  assert.doesNotMatch(
    combined,
    /\b(?:deleteDoc|setDoc|updateDoc|addDoc|writeBatch)\s*\(|\.(?:delete|restore|toDelete)\s*\(|AirItemManager|AirArrayManager|useBaseManager/u,
  );
  assert.doesNotMatch(combined, /restoreSite|SiteRestore|物理削除|復元する/u);
});

test("archive use-case fixes the exact five direct reference queries and excludes snapshots, operations, and Company order", async () => {
  const source = await read("functions/modules/sites/archiveSite.js");
  const catalog = source.match(/const referenceQueries = \[([\s\S]*?)\]\.map/u)?.[1];
  assert.ok(catalog);
  assert.deepEqual(
    [...catalog.matchAll(/"([A-Za-z]+)"/gu)].map((match) => match[1]),
    [
      "SiteOperationSchedules",
      "OperationResults",
      "ArrangementNotifications",
      "Billings",
      "SiteEmployeeHistories",
    ],
  );
  for (const excluded of [
    "LifecycleOperations", "Company", "siteShiftTypeOrder", "Snapshots", "ArchiveOperations",
  ]) assert.equal(catalog.includes(excluded), false, excluded);
  assert.match(source, /Promise\.all\(\[[\s\S]*?transaction\.get\(activeRef\)[\s\S]*?transaction\.get\(archiveRef\)[\s\S]*?referenceQueries\.map/u);
  assert.match(source, /transaction\.create\(archiveRef, envelope\);\s*transaction\.delete\(activeRef\);/u);
  assert.doesNotMatch(source, /transaction\.(?:set|update)\(archiveRef|\.restore\s*\(/u);
});

test("Rules retain live Site guards for client writers and close operation reference writes", async () => {
  const rules = await read("firestore.rules");
  assert.match(
    rules,
    /function liveSiteExistsAfter\(companyId, siteId\)[\s\S]*?existsAfter\([\s\S]*?\/Sites\/\$\(siteId\)\)/u,
  );
  assert.match(
    rules,
    /function isValidSiteReferenceCreate\(companyId\)[\s\S]*?keys\(\)\.hasAll\(\['siteId'\]\)[\s\S]*?liveSiteExistsAfter/u,
  );
  assert.match(
    rules,
    /function isValidSiteReferenceUpdate\(companyId\)[\s\S]*?affectedKeys\(\)\.hasAny\(\['siteId'\]\)[\s\S]*?isValidSiteReferenceCreate/u,
  );
  for (const collectionName of [
    "OperationResults", "ArrangementNotifications", "Billings", "SiteEmployeeHistories",
  ]) {
    const block = rules.match(
      new RegExp(`match /Companies/\\{companyId\\}/${collectionName}/\\{[^}]+\\} \\{([\\s\\S]*?)\\n    \\}`, "u"),
    )?.[1];
    assert.ok(block, `${collectionName} Rules block`);
    if (collectionName === "OperationResults") assert.match(block, /allow write: if false;/u);
    else if (collectionName === "ArrangementNotifications") {
      assert.match(block, /allow create, delete: if false;/u);
      assert.match(block, /isNotificationStateOnlyUpdate\(\)/u);
    } else {
      assert.match(block, /allow create:[\s\S]*?isValidSiteReferenceCreate\(companyId\)/u);
      assert.match(block, /allow update:[\s\S]*?isValidSiteReferenceUpdate\(companyId\)/u);
    }
  }
  const scheduleBlock = rules.match(
    /match \/Companies\/\{companyId\}\/SiteOperationSchedules\/\{docId\} \{([\s\S]*?)\n    \}/u,
  )?.[1];
  assert.ok(scheduleBlock);
  assert.match(scheduleBlock, /allow write: if false;/u);
});

test("Schedule application connects to the server transaction and legacy Class writer stays closed", async () => {
  const legacy = await read("utils/siteOperationSchedule/siteScheduleGuard.js");
  assert.match(legacy, /dedicated-operation-required/u);
  assert.doesNotMatch(legacy, /schedule\.(?:create|update)\(/u);
  const source = await read("functions/modules/operations/saveOperation.js");
  assert.match(source, /firestore\.runTransaction\(async \(transaction\)/u);
  assert.match(source, /transaction\.get\(firestore\.doc\(path\)\)/u);
  assert.match(source, /requireSite[\s\S]*?guardScheduleSite/u);
  assert.match(await read("composables/application/operation/useOperationSubmission.js"), /httpsCallable\(\$functions, "saveOperation"\)\(\{ operations \}\)/u);
  // Actual all-read-before-write, Site revision and reference race behavior is
  // exercised by operation-write.test.mjs and the local Callable harness.
});

test("Admin SDK Billing and SiteEmployeeHistory writers share their live Site read with the final write transaction", async () => {
  const [liveGuard, billing, history] = await Promise.all([
    read("functions/modules/sites/liveSiteReference.js"),
    read("functions/modules/billings/utils.js"),
    read("functions/modules/siteEmployeeHistories/rebuildHistory.js"),
  ]);
  assert.match(liveGuard, /transaction\.get\([\s\S]*?\/Sites\/\$\{siteId\}/u);
  assert.match(liveGuard, /if \(!snapshot\?\.exists\) throw/u);
  assert.match(
    billing,
    /await assertLiveSiteReference\(\{[\s\S]*?transaction,[\s\S]*?companyId,[\s\S]*?siteId,[\s\S]*?\}\);[\s\S]*?doc\.initialize/u,
  );
  assert.match(
    history,
    /db\.runTransaction\(async \(transaction\) => \{[\s\S]*?transaction\.get\(siteRef\)[\s\S]*?if \(!siteSnapshot\.exists\)[\s\S]*?instance\.create\(\{[\s\S]*?transaction/u,
  );
  assert.match(history, /if \(firstSnapshot\.empty\)[\s\S]*?transaction\.delete\(historyRef\)/u);
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
  assert.match(live, /allow delete:\s*if false;/u);
  assert.match(archive, /allow write:\s*if false;/u);
  assert.doesNotMatch(archive, /allow (?:create|update|delete):\s*if (?!false)/u);
});
