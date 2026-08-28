import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
    updateTime: "2026-08-28T00:01:00.000000000Z",
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
    syntheticMigrationSnapshot({ audits: [{ path: `${SYNTHETIC_CCB_COMPANIES[0]}/SettingAudits/audit-a`, value: encodeJsAsFirestoreValue({}), updateTime: "2026-08-28T00:02:00.000000000Z" }] }),
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

test("edition verification accepts only the boolean true", () => {
  for (const editionVerified of [false, "false", "true", 1, null]) {
    const plan = planCompanySettingsMigration(
      syntheticMigrationSnapshot({ editionVerified }),
    );
    assert.equal(plan.candidates[0].classification, "editionUnverified");
    assert.equal(plan.operations.length, 0);
    assert.equal(plan.exitCode, COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER);
  }
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
  const changedUpdateTime = syntheticRoot();
  changedUpdateTime.updateTime = "2026-08-28T00:00:01.000000000Z";
  assert.notEqual(
    first,
    planCompanySettingsMigration(
      syntheticMigrationSnapshot({ roots: [changedUpdateTime] }),
    ).planDigest,
  );
  assert.notDeepEqual(
    canonicalizeFirestoreValue({ integerValue: "1" }),
    canonicalizeFirestoreValue({ doubleValue: 1 }),
  );
});

test("digest binds project, database, edition, and edition receipt", () => {
  const baseline = planCompanySettingsMigration(syntheticMigrationSnapshot()).planDigest;
  for (const overrides of [
    { projectId: "demo-air-guard-v2-other" },
    { databaseId: "ccb-local" },
    { databaseType: "DATASTORE_MODE" },
    { edition: "ENTERPRISE" },
    { editionReceiptDigest: "f".repeat(64) },
  ]) {
    assert.notEqual(
      baseline,
      planCompanySettingsMigration(syntheticMigrationSnapshot(overrides)).planDigest,
    );
  }
});

test("digest binds target body and target updateTime", () => {
  const targets = expectedTargets();
  const baseline = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ targets }),
  ).planDigest;
  const changedBody = expectedTargets();
  changedBody[0].value = encodeJsAsFirestoreValue({ changed: true });
  const changedTime = expectedTargets();
  changedTime[0].updateTime = "2026-08-28T00:01:01.000000000Z";
  assert.notEqual(
    baseline,
    planCompanySettingsMigration(syntheticMigrationSnapshot({ targets: changedBody })).planDigest,
  );
  assert.notEqual(
    baseline,
    planCompanySettingsMigration(syntheticMigrationSnapshot({ targets: changedTime })).planDigest,
  );
});

test("digest binds audit and unexpected document snapshots", () => {
  const audit = {
    path: `${SYNTHETIC_CCB_COMPANIES[0]}/SettingAudits/audit-a`,
    value: encodeJsAsFirestoreValue({ revision: 1 }),
    updateTime: "2026-08-28T00:02:00.000000000Z",
  };
  const auditBaseline = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ audits: [audit] }),
  ).planDigest;
  assert.notEqual(
    auditBaseline,
    planCompanySettingsMigration(
      syntheticMigrationSnapshot({
        audits: [{ ...audit, value: encodeJsAsFirestoreValue({ revision: 2 }) }],
      }),
    ).planDigest,
  );
  assert.notEqual(
    auditBaseline,
    planCompanySettingsMigration(
      syntheticMigrationSnapshot({
        audits: [{ ...audit, updateTime: "2026-08-28T00:02:01.000000000Z" }],
      }),
    ).planDigest,
  );

  const unexpected = {
    path: `${SYNTHETIC_CCB_COMPANIES[0]}/Unexpected/document-a`,
    value: encodeJsAsFirestoreValue({ state: "A" }),
    updateTime: "2026-08-28T00:03:00.000000000Z",
  };
  const unexpectedBaseline = planCompanySettingsMigration(
    syntheticMigrationSnapshot({ unexpectedDocuments: [unexpected] }),
  ).planDigest;
  assert.notEqual(
    unexpectedBaseline,
    planCompanySettingsMigration(
      syntheticMigrationSnapshot({
        unexpectedDocuments: [{ ...unexpected, path: `${SYNTHETIC_CCB_COMPANIES[0]}/Unexpected/document-b` }],
      }),
    ).planDigest,
  );
  assert.notEqual(
    unexpectedBaseline,
    planCompanySettingsMigration(
      syntheticMigrationSnapshot({
        unexpectedDocuments: [{ ...unexpected, value: encodeJsAsFirestoreValue({ state: "B" }) }],
      }),
    ).planDigest,
  );
});

test("primary classification follows priority while every finding is retained", () => {
  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({
      editionVerified: "false",
      roots: [syntheticRoot(undefined, { unapprovedField: true })],
      targets: expectedTargets().slice(0, 1),
    }),
  );
  assert.equal(plan.candidates[0].classification, "editionUnverified");
  const codes = new Set(plan.findings.map(({ code }) => code));
  assert.equal(codes.has("edition-unverified"), true);
  assert.equal(codes.has("legacy-unknown-field"), true);
  assert.equal(codes.has("target-partial"), true);
  const summary = summarizeCompanySettingsPlan(plan);
  assert.equal(summary.counts.editionUnverified, 1);
  assert.equal(summary.findingCounts["edition-unverified"], 1);
  assert.equal(summary.findingCounts["legacy-unknown-field"], 1);
  assert.equal(summary.findingCounts["target-partial"], 1);
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

test("summary contains only counts and digest without per-subject identifiers", () => {
  const summary = summarizeCompanySettingsPlan(
    planCompanySettingsMigration(syntheticMigrationSnapshot()),
  );
  const serialized = JSON.stringify(summary);
  assert.equal(summary.createDocumentCount, 8);
  assert.equal(serialized.includes("Companies/"), false);
  assert.equal(serialized.includes("codex-company"), false);
  assert.equal(serialized.includes("Codex架空警備"), false);
  assert.equal("subjects" in summary, false);
});

test("fixed commit, schema version, and receipt digests are fail closed", () => {
  for (const overrides of [
    { fixedCommit: "short" },
    { schemaPackageVersion: "latest" },
    { schemaContractVersion: 2 },
    { editionReceiptDigest: "invalid" },
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

test("manifest and candidate ordering uses UTF-8 bytes rather than UTF-16", () => {
  const bmp = "Companies/\uFFFD";
  const supplementary = "Companies/\u{10000}";
  const utf8Order = [bmp, supplementary];
  assert.deepEqual([bmp, supplementary].sort(), [supplementary, bmp]);
  const expectedDigest = createHash("sha256")
    .update(
      `airguard:ccb-v1:target-manifest:v1\0${JSON.stringify(utf8Order)}`,
      "utf8",
    )
    .digest("hex");
  assert.equal(createCompanySettingsManifestDigest([supplementary, bmp]), expectedDigest);

  const plan = planCompanySettingsMigration(
    syntheticMigrationSnapshot({
      manifest: [supplementary, bmp],
      roots: [syntheticRoot(supplementary), syntheticRoot(bmp)],
    }),
  );
  assert.deepEqual(plan.candidates.map(({ companyPath }) => companyPath), utf8Order);
});
