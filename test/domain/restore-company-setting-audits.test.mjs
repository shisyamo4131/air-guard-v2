import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES,
  createCompanySettingAuditsArtifactDigest,
  createCompanySettingAuditsManifestDigest,
  planCompanySettingAuditsRestore,
  summarizeCompanySettingAuditsRestorePlan,
} from "../../scripts/restore-company-setting-audits.mjs";
import {
  canonicalizeFirestoreValue,
  decodeFirestoreValue,
  encodeJsAsFirestoreValue,
} from "../../scripts/migrate-company-settings.mjs";
import {
  SYNTHETIC_AUDIT_COMPANY_PATH,
  syntheticAuditRecord,
  syntheticAuditRestoreInput,
  syntheticExistingAudit,
  syntheticSettingAudit,
} from "../fixtures/company-setting-audit-restore.mjs";

test("absent valid audit plans one create-only write", () => {
  const plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput());
  assert.equal(plan.status, "changes");
  assert.equal(plan.exitCode, COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES.CHANGES);
  assert.equal(plan.counts.eligibleCreate, 1);
  assert.equal(plan.counts.create, 1);
  assert.equal(plan.counts.update, 0);
  assert.equal(plan.counts.delete, 0);
  assert.equal(plan.counts.clear, 0);
  assert.equal(plan.counts.merge, 0);
  assert.deepEqual(plan.operations[0].currentDocument, { exists: false });
  assert.equal(plan.operations[0].kind, "create");
});

test("canonical equivalent existing audit is a clean skip", () => {
  const source = syntheticAuditRecord();
  const plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput({
    sourceAudits: [source],
    targetAudits: [syntheticExistingAudit(source)],
  }));
  assert.equal(plan.status, "clean");
  assert.equal(plan.exitCode, COMPANY_SETTING_AUDIT_RESTORE_EXIT_CODES.CLEAN);
  assert.equal(plan.counts.alreadyEquivalent, 1);
  assert.equal(plan.operations.length, 0);
});

test("map key order is equivalent while divergent target blocks every create", () => {
  const first = syntheticAuditRecord("audit-001");
  const second = syntheticAuditRecord("audit-002", syntheticSettingAudit({ fromRevision: 2, toRevision: 3 }));
  const reordered = structuredClone(first.value);
  reordered.mapValue.fields = Object.fromEntries(Object.entries(reordered.mapValue.fields).reverse());
  let plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput({
    sourceAudits: [first],
    targetAudits: [syntheticExistingAudit({ ...first, value: reordered })],
  }));
  assert.equal(plan.status, "clean");

  const conflict = structuredClone(first);
  conflict.value.mapValue.fields.actorUid = { stringValue: "different-operator" };
  plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput({
    sourceAudits: [first, second],
    targetAudits: [syntheticExistingAudit(conflict)],
  }));
  assert.equal(plan.status, "blocked");
  assert.equal(plan.counts.targetConflict, 1);
  assert.equal(plan.counts.create, 0);
  assert.equal(plan.operations.length, 0);
});

test("same ID and company scope are mandatory", () => {
  const source = syntheticAuditRecord();
  const wrongCompany = structuredClone(source);
  wrongCompany.path = wrongCompany.path.replace(SYNTHETIC_AUDIT_COMPANY_PATH, "Companies/other-tenant");
  const input = syntheticAuditRestoreInput({
    sourceAudits: [source],
    targetAudits: [syntheticExistingAudit(wrongCompany)],
  });
  const plan = planCompanySettingAuditsRestore(input);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.counts.scopeMismatch, 1);
  assert.equal(plan.operations.length, 0);
});

test("unrelated valid audit IDs in the same company are ignored", () => {
  const unrelated = syntheticExistingAudit(syntheticAuditRecord("outside-manifest"));
  const plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput({ targetAudits: [unrelated] }));
  assert.equal(plan.status, "changes");
  assert.equal(plan.counts.eligibleCreate, 1);
  assert.equal(plan.operations.length, 1);
});

test("every manifest path requires an explicit present or absent target observation", () => {
  for (const targetObservations of [null, {}, []]) {
    const input = syntheticAuditRestoreInput();
    input.targetObservations = targetObservations;
    const plan = planCompanySettingAuditsRestore(input);
    assert.equal(plan.status, "blocked");
    assert.equal(plan.counts.create, 0);
    assert.equal(plan.operations.length, 0);
    assert.equal(
      plan.findings.some(({ code }) =>
        code === "TARGET_OBSERVATIONS_NOT_ARRAY" || code === "MISSING_TARGET_OBSERVATION"),
      true,
    );
  }
});

test("incomplete target observation blocks all otherwise eligible creates", () => {
  const first = syntheticAuditRecord("audit-001");
  const second = syntheticAuditRecord("audit-002", syntheticSettingAudit({ fromRevision: 2, toRevision: 3 }));
  const input = syntheticAuditRestoreInput({ sourceAudits: [first, second] });
  input.targetObservations = input.targetObservations.filter(({ path }) => path === first.path);
  const plan = planCompanySettingAuditsRestore(input);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.counts.targetConflict, 1);
  assert.equal(plan.counts.create, 0);
  assert.equal(plan.operations.length, 0);
});

test("target observations must share one causal snapshot", () => {
  const first = syntheticAuditRecord("audit-001");
  const second = syntheticAuditRecord("audit-002", syntheticSettingAudit({ fromRevision: 2, toRevision: 3 }));
  let input = syntheticAuditRestoreInput({ sourceAudits: [first, second] });
  input.targetObservations[1].readTime = "2026-08-28T12:00:02.000000000Z";
  let plan = planCompanySettingAuditsRestore(input);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.operations.length, 0);

  input = syntheticAuditRestoreInput({
    sourceAudits: [first],
    targetAudits: [syntheticExistingAudit(first)],
  });
  input.targetObservations[0].updateTime = "2026-08-28T12:00:02.000000000Z";
  plan = planCompanySettingAuditsRestore(input);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.operations.length, 0);
});

test("manifest and artifact digests are mandatory and bind source values", () => {
  const manifestInput = syntheticAuditRestoreInput();
  manifestInput.manifestDigest = "0".repeat(64);
  let plan = planCompanySettingAuditsRestore(manifestInput);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.operations.length, 0);

  const artifactInput = syntheticAuditRestoreInput();
  artifactInput.sourceAudits[0].value.mapValue.fields.actorUid = { stringValue: "modified" };
  plan = planCompanySettingAuditsRestore(artifactInput);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.operations.length, 0);
  assert.equal(plan.findings.some(({ code }) => code === "ARTIFACT_DIGEST_MISMATCH"), true);
});

test("cross-project or cross-database restore is blocked", () => {
  for (const target of [
    { projectId: "other-project", databaseId: "(default)" },
    { projectId: "demo-air-guard-v2-codex", databaseId: "other" },
  ]) {
    const plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput({ target }));
    assert.equal(plan.status, "blocked");
    assert.equal(plan.operations.length, 0);
  }
});

test("schema, revision, change order, mask, and timestamp violations block globally", () => {
  const invalidAudits = [
    syntheticSettingAudit({ schemaVersion: 2 }),
    syntheticSettingAudit({ toRevision: 4 }),
    syntheticSettingAudit({ changes: [...syntheticSettingAudit().changes].reverse() }),
    {
      ...syntheticSettingAudit(),
      settingType: "BILLING",
      changes: [{ field: "bankName", before: "secret", after: "***" }],
    },
  ];
  for (const [index, audit] of invalidAudits.entries()) {
    const sourceAudits = [syntheticAuditRecord(`invalid-${index}`, audit)];
    const plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput({ sourceAudits }));
    assert.equal(plan.status, "blocked");
    assert.equal(plan.counts.invalidSource, 1);
    assert.equal(plan.operations.length, 0);
  }

  const invalidTimestamp = syntheticAuditRecord("invalid-timestamp");
  invalidTimestamp.value.mapValue.fields.createdAt = {
    timestampValue: "2026-02-31T12:00:00.000000000Z",
  };
  const timestampInput = syntheticAuditRestoreInput();
  timestampInput.manifest = [invalidTimestamp.path];
  timestampInput.manifestDigest = createCompanySettingAuditsManifestDigest(timestampInput.manifest);
  timestampInput.sourceAudits = [invalidTimestamp];
  timestampInput.artifactDigest = "invalid-artifact-digest";
  const timestampPlan = planCompanySettingAuditsRestore(timestampInput);
  assert.equal(timestampPlan.status, "blocked");
  assert.equal(timestampPlan.operations.length, 0);
});

test("parser normalization is rejected as noncanonical source", () => {
  const source = syntheticAuditRecord();
  source.value.mapValue.fields.actorUid = { stringValue: "  synthetic-operator  " };
  const input = syntheticAuditRestoreInput({ sourceAudits: [source] });
  const plan = planCompanySettingAuditsRestore(input);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.counts.invalidSource, 1);
  assert.equal(plan.operations.length, 0);
});

test("malformed Firestore wire values never share a digest or become operations", () => {
  assert.throws(() => canonicalizeFirestoreValue({ integerValue: true }));
  assert.throws(() => canonicalizeFirestoreValue({ integerValue: 1 }));
  assert.throws(() => canonicalizeFirestoreValue({ integerValue: "01" }));
  assert.throws(() => canonicalizeFirestoreValue({ integerValue: "9223372036854775808" }));
  assert.throws(() => canonicalizeFirestoreValue({ bytesValue: "not base64" }));
  assert.throws(() => canonicalizeFirestoreValue({
    arrayValue: { values: [], unexpected: true },
  }));
  assert.throws(() => canonicalizeFirestoreValue({
    mapValue: { fields: {}, unexpected: true },
  }));
  assert.throws(() => canonicalizeFirestoreValue({
    geoPointValue: { latitude: 91, longitude: 0 },
  }));

  const input = syntheticAuditRestoreInput();
  input.sourceAudits[0].value.mapValue.fields.schemaVersion = { integerValue: true };
  const plan = planCompanySettingAuditsRestore(input);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.counts.invalidSource, 1);
  assert.equal(plan.operations.length, 0);
});

test("duplicates and incomplete manifest block globally", () => {
  const source = syntheticAuditRecord();
  const duplicate = syntheticAuditRestoreInput({ sourceAudits: [source] });
  duplicate.sourceAudits.push(structuredClone(source));
  duplicate.artifactDigest = createCompanySettingAuditsArtifactDigest({
    source: duplicate.source,
    companyPath: duplicate.companyPath,
    schemaPackageVersion: duplicate.schemaPackageVersion,
    schemaContractVersion: duplicate.schemaContractVersion,
    sourceAudits: duplicate.sourceAudits,
  });
  let plan = planCompanySettingAuditsRestore(duplicate);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.operations.length, 0);

  const missing = syntheticAuditRestoreInput();
  missing.manifest.push(`${SYNTHETIC_AUDIT_COMPANY_PATH}/SettingAudits/missing`);
  missing.manifestDigest = createCompanySettingAuditsManifestDigest(missing.manifest);
  plan = planCompanySettingAuditsRestore(missing);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.operations.length, 0);
});

test("partial rerun skips existing equivalent IDs and creates only absent IDs", () => {
  const first = syntheticAuditRecord("audit-001");
  const second = syntheticAuditRecord("audit-002", syntheticSettingAudit({ fromRevision: 2, toRevision: 3 }));
  const plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput({
    sourceAudits: [second, first],
    targetAudits: [syntheticExistingAudit(first)],
  }));
  assert.equal(plan.status, "changes");
  assert.equal(plan.counts.alreadyEquivalent, 1);
  assert.equal(plan.counts.eligibleCreate, 1);
  assert.equal(plan.operations.length, 1);
  assert.equal(plan.operations[0].path.endsWith("/audit-002"), true);
});

test("plan digest is stable across source and target input ordering", () => {
  const first = syntheticAuditRecord("audit-001");
  const second = syntheticAuditRecord("audit-002", syntheticSettingAudit({ fromRevision: 2, toRevision: 3 }));
  const firstInput = syntheticAuditRestoreInput({
    sourceAudits: [first, second],
    targetAudits: [syntheticExistingAudit(first), syntheticExistingAudit(second)],
  });
  const secondInput = syntheticAuditRestoreInput({
    sourceAudits: [second, first],
    targetAudits: [syntheticExistingAudit(second), syntheticExistingAudit(first)],
    manifest: firstInput.manifest,
  });
  assert.equal(
    planCompanySettingAuditsRestore(firstInput).planDigest,
    planCompanySettingAuditsRestore(secondInput).planDigest,
  );
});

test("planned Firestore values are detached and immutable", () => {
  const input = syntheticAuditRestoreInput();
  const plan = planCompanySettingAuditsRestore(input);
  const before = structuredClone(plan.operations[0].value);
  input.sourceAudits[0].value.mapValue.fields.actorUid.stringValue = "mutated-after-plan";
  assert.deepEqual(plan.operations[0].value, before);
  assert.equal(Object.isFrozen(plan.operations[0].value), true);
  assert.equal(Object.isFrozen(plan.operations[0].value.mapValue.fields), true);
});

test("integer and double encodings are divergent target values", () => {
  const source = syntheticAuditRecord("numeric", {
    ...syntheticSettingAudit(),
    settingType: "OPERATIONS",
    changes: [{ field: "minuteInterval", before: 10, after: 15 }],
  });
  const target = syntheticExistingAudit(source);
  target.value.mapValue.fields.changes.arrayValue.values[0]
    .mapValue.fields.after = { doubleValue: 15 };
  const plan = planCompanySettingAuditsRestore(syntheticAuditRestoreInput({
    sourceAudits: [source],
    targetAudits: [target],
  }));
  assert.equal(plan.status, "blocked");
  assert.equal(plan.counts.targetConflict, 1);
  assert.equal(plan.operations.length, 0);
});

test("plan digest binds target observations and output summary is aggregate-only", () => {
  const absent = planCompanySettingAuditsRestore(syntheticAuditRestoreInput());
  const source = syntheticAuditRecord();
  const existingInput = syntheticAuditRestoreInput({
    sourceAudits: [source],
    targetAudits: [syntheticExistingAudit(source)],
  });
  const existing = planCompanySettingAuditsRestore(existingInput);
  assert.notEqual(absent.planDigest, existing.planDigest);

  const summary = summarizeCompanySettingAuditsRestorePlan(absent);
  const serialized = JSON.stringify(summary);
  assert.equal(summary.operationalRestoreAvailable, false);
  assert.equal(summary.applyImplemented, false);
  assert.equal(serialized.includes("synthetic-ccb-tenant"), false);
  assert.equal(serialized.includes("audit-001"), false);
  assert.equal(serialized.includes("synthetic-operator"), false);
  assert.equal(serialized.includes("旧社名"), false);
});

test("Firestore codec preserves actor, timestamp, change values, and integer types", () => {
  const value = syntheticAuditRecord().value;
  const decoded = decodeFirestoreValue(value);
  assert.deepEqual(decoded, syntheticSettingAudit());
  assert.deepEqual(encodeJsAsFirestoreValue(decoded), value);
});
