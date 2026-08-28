import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

import {
  CODEX_COMPANY_SETTINGS_MIGRATION_TARGET,
  COMPANY_SETTINGS_EXIT_CODES,
  COMPANY_SETTINGS_TARGETS,
  applyCompanySettingsMigrationPlan,
  assertCompanySettingsMigrationTarget,
  createCodexCompanySettingsPlanInput,
  readCompanySettingsMigrationPlan,
  readCompanySettingsMigrationState,
} from "../../scripts/migrate-company-settings.mjs";
import {
  SYNTHETIC_CCB_ACTOR,
  SYNTHETIC_CCB_COMPANIES,
  SYNTHETIC_CCB_TIMESTAMP,
  syntheticLegacyCompany,
} from "../fixtures/company-settings-migration.mjs";

const FIXED_SYNTHETIC_COMMIT = "8488e303c4c2459cbde156aa2f0ee9bf43e59301";
const target = CODEX_COMPANY_SETTINGS_MIGRATION_TARGET;
let testEnvironment;
let rulesText;

function parseExactFirestoreHost() {
  const value = process.env.FIRESTORE_EMULATOR_HOST;
  assert.equal(value, target.firestoreHost);
  const separator = value.lastIndexOf(":");
  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  assert.equal(host, "127.0.0.1");
  assert.ok(Number.isInteger(port));
  return { host, port };
}

function onlyManifestRecords(records) {
  return records
    .filter(({ path }) => SYNTHETIC_CCB_COMPANIES.some(
      (companyPath) => path === companyPath || path.startsWith(`${companyPath}/`),
    ))
    .sort((left, right) => left.path.localeCompare(right.path));
}

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, target.projectId);
  assert.equal(process.env.AIR_GUARD_EXTERNAL_EFFECTS, "deny");
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);
  assertCompanySettingsMigrationTarget(target.name, process.env);

  const firestoreHost = parseExactFirestoreHost();
  rulesText = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
  testEnvironment = await initializeTestEnvironment({
    projectId: target.projectId,
    firestore: { ...firestoreHost, rules: rulesText },
  });

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    for (const companyPath of SYNTHETIC_CCB_COMPANIES) {
      await setDoc(doc(firestore, companyPath), syntheticLegacyCompany());
    }
  });
});

after(async () => {
  if (testEnvironment) await testEnvironment.cleanup();
});

test("Codex-only Emulator dry-run, create-only apply, and post-check are exact", async () => {
  const planInput = createCodexCompanySettingsPlanInput({
    manifest: [...SYNTHETIC_CCB_COMPANIES],
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
    fixedCommit: FIXED_SYNTHETIC_COMMIT,
    rulesText,
    target,
  });

  const beforeState = await readCompanySettingsMigrationState({ target });
  const beforeRoots = onlyManifestRecords(beforeState.roots);
  assert.equal(beforeRoots.length, 2);
  assert.deepEqual(onlyManifestRecords(beforeState.targets), []);
  assert.deepEqual(onlyManifestRecords(beforeState.audits), []);

  const dryRun = await readCompanySettingsMigrationPlan({ target, planInput });
  assert.equal(dryRun.exitCode, COMPANY_SETTINGS_EXIT_CODES.CHANGES);
  assert.equal(dryRun.findings.length, 0);
  assert.equal(dryRun.candidates.length, 2);
  assert.equal(
    dryRun.candidates.every(({ classification }) => classification === "eligibleCreate"),
    true,
  );
  assert.equal(dryRun.operations.length, 2);
  assert.equal(
    dryRun.operations.reduce((count, operation) => count + operation.writes.length, 0),
    16,
  );
  assert.equal(
    dryRun.operations.every((operation) =>
      operation.writes.length === COMPANY_SETTINGS_TARGETS.length &&
      operation.writes.every(({ kind, path }) =>
        kind === "create" &&
        !SYNTHETIC_CCB_COMPANIES.includes(path) &&
        !path.includes("/SettingAudits/"),
      )),
    true,
  );

  const applied = await applyCompanySettingsMigrationPlan({
    target,
    planInput,
    plan: dryRun,
    approvedPlanDigest: dryRun.planDigest,
  });
  assert.equal(applied.postCheck.status, "clean");
  assert.equal(applied.postCheck.appliedTenantCount, 2);
  assert.equal(applied.postCheck.createdDocumentCount, 16);
  assert.equal(applied.postCheck.updatedDocumentCount, 0);
  assert.equal(applied.postCheck.deletedDocumentCount, 0);
  assert.equal(applied.postCheck.rootWriteCount, 0);
  assert.equal(applied.postCheck.auditWriteCount, 0);

  const afterState = await readCompanySettingsMigrationState({ target });
  assert.deepEqual(onlyManifestRecords(afterState.roots), beforeRoots);
  const createdTargets = onlyManifestRecords(afterState.targets);
  assert.equal(createdTargets.length, 16);
  assert.deepEqual(onlyManifestRecords(afterState.audits), []);

  const expectedPaths = SYNTHETIC_CCB_COMPANIES.flatMap((companyPath) =>
    COMPANY_SETTINGS_TARGETS.map(
      ({ collection, document }) => `${companyPath}/${collection}/${document}`,
    ),
  ).sort();
  assert.deepEqual(createdTargets.map(({ path }) => path).sort(), expectedPaths);

  const rerun = await readCompanySettingsMigrationPlan({ target, planInput });
  assert.equal(rerun.exitCode, COMPANY_SETTINGS_EXIT_CODES.CLEAN);
  assert.equal(rerun.findings.length, 0);
  assert.equal(rerun.operations.length, 0);
  assert.equal(rerun.candidates.length, 2);
  assert.equal(
    rerun.candidates.every(({ classification }) => classification === "alreadyEquivalent"),
    true,
  );

  const noOpApply = await applyCompanySettingsMigrationPlan({
    target,
    planInput,
    plan: rerun,
    approvedPlanDigest: rerun.planDigest,
  });
  assert.equal(noOpApply.postCheck.appliedTenantCount, 0);
  assert.equal(noOpApply.postCheck.createdDocumentCount, 0);
  assert.deepEqual(
    onlyManifestRecords((await readCompanySettingsMigrationState({ target })).roots),
    beforeRoots,
  );
});
