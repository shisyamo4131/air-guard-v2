import assert from "node:assert/strict";
import test from "node:test";

import { mapLegacyCompanyToConfigurationV1 } from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

import {
  COMPANY_SETTINGS_EXIT_CODES,
  COMPANY_SETTINGS_TARGETS,
  canonicalizeFirestoreValue,
  createCompanySettingsManifestDigest,
  encodeJsAsFirestoreValue,
  planCompanySettingsMigration,
  summarizeCompanySettingsPlan,
} from "../../scripts/migrate-company-settings.mjs";
import {
  SYNTHETIC_CCB_ACTOR,
  SYNTHETIC_CCB_COMPANIES,
  SYNTHETIC_CCB_TIMESTAMP,
  syntheticLegacyCompany,
  syntheticMigrationSnapshot,
  syntheticRoot,
} from "../fixtures/company-settings-migration.mjs";

function expectedTargets(companyPath = SYNTHETIC_CCB_COMPANIES[0]) {
  const mapped = mapLegacyCompanyToConfigurationV1(syntheticLegacyCompany(), {
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
  });
  assert.equal(mapped.ok, true);
  return COMPANY_SETTINGS_TARGETS.map((definition) => ({
    path: `${companyPath}/${definition.collection}/${definition.document}`,
    value: encodeJsAsFirestoreValue(mapped.value[definition.valueKey]),
  }));
}

test("empty targets produce one create-only operation with exactly eight documents", () => {
  const plan = planCompanySettingsMigration(syntheticMigrationSnapshot());
  assert.equal(plan.exitCode, COMPANY_SETTINGS_EXIT_CODES.CHANGES);
  assert.equal(plan.candidates[0].classification, "eligibleCreate");
  assert.equal(plan.operations.length, 1);
  assert.equal(plan.operations[0].writes.length, 8);
  assert.equal(plan.operations[0].writes.every(({ kind }) => kind === "create"), true);
  assert.equal(plan.operations[0].writes.some(({ path }) => path === SYNTHETIC_CCB_COMPANIES[0]), false);
  assert.equal(plan.operations[0].writes.some(({ path }) => path.includes("SettingAudits")), false);
});

test("complete exact targets are alreadyEquivalent and plan no writes", () => {
  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ targets: expectedTargets() }),
  );
  assert.equal(plan.exitCode, COMPANY_SETTINGS_EXIT_CODES.CLEAN);
  assert.equal(plan.candidates[0].classification, "alreadyEquivalent");
  assert.deepEqual(plan.operations, []);
});

test("partial targets block every tenant and are never repaired", () => {
  const second = SYNTHETIC_CCB_COMPANIES[1];
  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({
      manifest: [...SYNTHETIC_CCB_COMPANIES],
      roots: [syntheticRoot(), syntheticRoot(second)],
      targets: expectedTargets().slice(0, 1),
    }),
  );
  assert.equal(plan.exitCode, COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER);
  assert.equal(plan.candidates.find(({ companyPath }) => companyPath === SYNTHETIC_CCB_COMPANIES[0]).classification, "targetConflict");
  assert.equal(plan.candidates.find(({ companyPath }) => companyPath === second).classification, "eligibleCreate");
  assert.deepEqual(plan.operations, []);
});

test("mismatched complete targets block instead of overwrite", () => {
  const targets = expectedTargets();
  targets[0] = {
    ...targets[0],
    value: encodeJsAsFirestoreValue({ unexpected: true }),
  };
  const plan = planCompanySettingsMigration(syntheticMigrationSnapshot({ targets }));
  assert.equal(plan.candidates[0].classification, "targetConflict");
  assert.deepEqual(plan.operations, []);
});

test("unknown legacy fields require review and block all writes", () => {
  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ roots: [syntheticRoot(undefined, { unapprovedField: true })] }),
  );
  assert.equal(plan.candidates[0].classification, "unknownFieldReview");
  assert.deepEqual(plan.operations, []);
});

test("maintenance and unknown attendance mapping are ambiguous", () => {
  for (const overrides of [
    { maintenanceMode: true },
    { attendanceManagementMode: "UNKNOWN_MODE" },
  ]) {
    const plan = planCompanySettingsMigration(
      syntheticMigrationSnapshot({ roots: [syntheticRoot(undefined, overrides)] }),
    );
    assert.equal(plan.candidates[0].classification, "ambiguousMapping");
    assert.deepEqual(plan.operations, []);
  }
});

test("invalid required source values block all writes", () => {
  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ roots: [syntheticRoot(undefined, { companyName: null })] }),
  );
  assert.equal(plan.candidates[0].classification, "invalidSource");
  assert.deepEqual(plan.operations, []);
});

test("manifest/root mismatch, orphan target, audit, and active marker block", () => {
  const cases = [
    syntheticMigrationSnapshot({ roots: [] }),
    syntheticMigrationSnapshot({
      manifest: [],
      roots: [],
      targets: expectedTargets(),
    }),
    syntheticMigrationSnapshot({ audits: [{ path: `${SYNTHETIC_CCB_COMPANIES[0]}/SettingAudits/audit-a`, value: encodeJsAsFirestoreValue({}) }] }),
    syntheticMigrationSnapshot({ roots: [syntheticRoot(undefined, { schemaVersion: 1 })] }),
  ];
  const expected = ["rootMissingOrOrphan", "rootMissingOrOrphan", "targetConflict", "targetConflict"];
  cases.forEach((snapshot, index) => {
    const plan = planCompanySettingsMigration(snapshot);
    assert.equal(plan.candidates[0].classification, expected[index]);
    assert.deepEqual(plan.operations, []);
  });
});

test("unverified edition blocks even otherwise eligible synthetic data", () => {
  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ editionVerified: false }),
  );
  assert.equal(plan.candidates[0].classification, "editionUnverified");
  assert.equal(plan.exitCode, COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER);
});

test("unverified edition also blocks an empty candidate universe", () => {
  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ editionVerified: false, manifest: [], roots: [] }),
  );
  assert.equal(plan.exitCode, COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER);
  assert.equal(plan.findings[0].classification, "editionUnverified");
});

test("digest is deterministic, source-sensitive, and type tagged", () => {
  const first = planCompanySettingsMigration(syntheticMigrationSnapshot()).planDigest;
  const second = planCompanySettingsMigration(syntheticMigrationSnapshot()).planDigest;
  const changedRoot = syntheticRoot();
  changedRoot.value = encodeJsAsFirestoreValue(syntheticLegacyCompany({ minuteInterval: 10 }));
  const changed = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ roots: [changedRoot] }),
  ).planDigest;
  assert.equal(first, second);
  assert.notEqual(first, changed);
  assert.notDeepEqual(
    canonicalizeFirestoreValue({ integerValue: "1" }),
    canonicalizeFirestoreValue({ doubleValue: 1 }),
  );
});

test("fresh re-plan resumes remaining tenants without deleting successful targets", () => {
  const second = SYNTHETIC_CCB_COMPANIES[1];
  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({
      manifest: [...SYNTHETIC_CCB_COMPANIES],
      roots: [syntheticRoot(), syntheticRoot(second)],
      targets: expectedTargets(),
    }),
  );
  assert.equal(plan.exitCode, COMPANY_SETTINGS_EXIT_CODES.CHANGES);
  assert.equal(plan.candidates[0].classification, "alreadyEquivalent");
  assert.equal(plan.candidates[1].classification, "eligibleCreate");
  assert.equal(plan.operations.length, 1);
  assert.equal(plan.operations[0].companyPath, second);
});

test("integer and double target encodings are not considered equivalent", () => {
  const targets = expectedTargets();
  const operations = targets.find(({ path }) => path.endsWith("/Settings/operations"));
  operations.value.mapValue.fields.minuteInterval = { doubleValue: 5 };
  const plan = planCompanySettingsMigration(syntheticMigrationSnapshot({ targets }));
  assert.equal(plan.candidates[0].classification, "targetConflict");
  assert.deepEqual(plan.operations, []);
});

test("canonical Firestore encoding handles public REST value kinds", () => {
  const value = {
    mapValue: {
      fields: {
        timestamp: { timestampValue: "2027-01-15T08:00:00Z" },
        point: { geoPointValue: { latitude: 35.0, longitude: 139.5 } },
        ref: { referenceValue: "projects/demo/databases/(default)/documents/X/Y" },
        bytes: { bytesValue: Buffer.from("synthetic").toString("base64") },
        list: { arrayValue: { values: [{ nullValue: null }, { booleanValue: true }] } },
      },
    },
  };
  assert.equal(canonicalizeFirestoreValue(value)[0], "map");
  assert.throws(() => canonicalizeFirestoreValue({ stringValue: "x", integerValue: "1" }));
  assert.throws(() => canonicalizeFirestoreValue({ doubleValue: "1.0" }));
});

test("summary contains only counts, digest, and opaque subjects", () => {
  const summary = summarizeCompanySettingsPlan(
    planCompanySettingsMigration(syntheticMigrationSnapshot()),
  );
  const serialized = JSON.stringify(summary);
  assert.equal(summary.createDocumentCount, 8);
  assert.equal(serialized.includes("Companies/"), false);
  assert.equal(serialized.includes("codex-company"), false);
  assert.equal(serialized.includes("Codex架空警備"), false);
});

test("fixed commit, schema version, and receipt digests are fail closed", () => {
  for (const overrides of [
    { fixedCommit: "short" },
    { schemaPackageVersion: "latest" },
    { targetManifestDigest: "invalid" },
    { rulesReceiptDigest: "invalid" },
    { actorUid: "operator@example.com" },
  ]) {
    assert.throws(() => planCompanySettingsMigration(syntheticMigrationSnapshot(overrides)));
  }
});

test("manifest digest binds the exact approved Company root set", () => {
  const manifest = [...SYNTHETIC_CCB_COMPANIES];
  assert.equal(
    createCompanySettingsManifestDigest(manifest),
    createCompanySettingsManifestDigest([...manifest].reverse()),
  );
  assert.throws(() =>
    planCompanySettingsMigration(
      syntheticMigrationSnapshot({
        manifest,
        targetManifestDigest: createCompanySettingsManifestDigest([manifest[0]]),
      }),
    ),
  );
});
