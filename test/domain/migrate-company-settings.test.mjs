import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { mapLegacyCompanyToConfigurationV1 } from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

import {
  CODEX_COMPANY_SETTINGS_MIGRATION_TARGET,
  COMPANY_SETTINGS_EXIT_CODES,
  COMPANY_SETTINGS_TARGETS,
  applyCompanySettingsMigrationPlan,
  assertCompanySettingsMigrationTarget,
  canonicalizeFirestoreValue,
  createCodexCompanySettingsPlanInput,
  createCompanySettingsManifestDigest,
  encodeJsAsFirestoreValue,
  parseCompanySettingsMigrationArgs,
  planCompanySettingsMigration,
  readCompanySettingsMigrationPlan,
  readCompanySettingsMigrationState,
  runCompanySettingsMigrationCli,
  summarizeCompanySettingsMigrationError,
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

function codexTargetEnvironment(overrides = {}) {
  return {
    GCLOUD_PROJECT: CODEX_COMPANY_SETTINGS_MIGRATION_TARGET.projectId,
    FIRESTORE_EMULATOR_HOST: CODEX_COMPANY_SETTINGS_MIGRATION_TARGET.firestoreHost,
    AIR_GUARD_EXTERNAL_EFFECTS: "deny",
    ...overrides,
  };
}

function restDocument(record) {
  return {
    name: `projects/${CODEX_COMPANY_SETTINGS_MIGRATION_TARGET.projectId}` +
      `/databases/${CODEX_COMPANY_SETTINGS_MIGRATION_TARGET.databaseId}/documents/${record.path}`,
    fields: record.value.mapValue.fields,
    createTime: record.updateTime,
    updateTime: record.updateTime,
  };
}

function createFakeFirestoreRest({
  concurrentTarget = false,
  roots = [syntheticRoot()],
  failCommitCompanyPath = null,
  loseCommitResponse = false,
  failRecoveryRead = false,
} = {}) {
  const records = [...roots];
  const calls = [];
  let transactionQueryCount = 0;
  let rollbackCount = 0;
  let commitCount = 0;
  let commitResponseLost = false;

  function response(value, url, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      url,
      text: async () => value === null ? "" : JSON.stringify(value),
    };
  }

  function collectionRecords(collectionId, companyPath = null) {
    return records.filter(({ path }) =>
      path.split("/").at(-2) === collectionId &&
      (companyPath === null || path.startsWith(`${companyPath}/`)),
    );
  }

  const fetchImpl = async (url, options = {}) => {
    const method = options.method ?? "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: String(url), method, body, headers: options.headers, redirect: options.redirect });
    if (
      commitResponseLost &&
      failRecoveryRead &&
      (method === "GET" || (String(url).endsWith(":runQuery") && !body?.transaction))
    ) {
      throw new Error("synthetic recovery read failure");
    }
    if (method === "GET" && String(url).includes("/documents/Companies?")) {
      return response({ documents: records.filter(({ path }) => /^Companies\/[^/]+$/u.test(path)).map(restDocument) }, String(url));
    }
    if (String(url).endsWith(":beginTransaction")) {
      return response({ transaction: "synthetic-transaction" }, String(url));
    }
    if (String(url).endsWith(":batchGet")) {
      const prefix = "/documents/";
      const path = body.documents[0].slice(body.documents[0].indexOf(prefix) + prefix.length);
      const root = records.find((record) => record.path === path);
      return response(
        root
          ? [{ found: restDocument(root), readTime: root.updateTime }]
          : [{ missing: body.documents[0], readTime: "2026-08-28T00:00:00Z" }],
        String(url),
      );
    }
    if (String(url).endsWith(":rollback")) {
      rollbackCount += 1;
      return response(null, String(url));
    }
    if (String(url).endsWith(":commit")) {
      const prefix = "/documents/";
      const firstPath = body.writes[0].update.name.slice(
        body.writes[0].update.name.indexOf(prefix) + prefix.length,
      );
      const companyPath = firstPath.split("/").slice(0, 2).join("/");
      if (companyPath === failCommitCompanyPath) {
        return response({ error: { status: "ABORTED" } }, String(url), 409);
      }
      commitCount += 1;
      for (const [index, write] of body.writes.entries()) {
        assert.deepEqual(write.currentDocument, { exists: false });
        const path = write.update.name.slice(write.update.name.indexOf(prefix) + prefix.length);
        assert.equal(records.some((record) => record.path === path), false);
        records.push({
          path,
          value: { mapValue: { fields: write.update.fields } },
          updateTime: `2026-08-28T00:10:${String(index).padStart(2, "0")}.000000000Z`,
        });
      }
      if (loseCommitResponse) {
        commitResponseLost = true;
        return {
          ok: true,
          status: 200,
          url: String(url),
          text: async () => {
            throw new Error("synthetic lost commit response");
          },
        };
      }
      return response({ writeResults: body.writes.map(() => ({ updateTime: "2026-08-28T00:10:00Z" })) }, String(url));
    }
    if (String(url).endsWith(":runQuery")) {
      const collectionId = body.structuredQuery.from[0].collectionId;
      const isTransactionQuery = typeof body.transaction === "string";
      const parentMatch = /\/documents\/(Companies\/[^/:]+):runQuery$/u.exec(String(url));
      const companyPath = parentMatch ? decodeURIComponent(parentMatch[1]) : null;
      if (isTransactionQuery) {
        transactionQueryCount += 1;
        if (
          concurrentTarget &&
          collectionId === "Settings" &&
          !records.some(({ path }) =>
            path === `${companyPath}/Settings/profile`,
          )
        ) {
          records.push(expectedTargets(companyPath)[0]);
        }
      }
      return response(
        collectionRecords(collectionId, companyPath).map((record) => ({ document: restDocument(record) })),
        String(url),
      );
    }
    return response({ error: { status: "NOT_FOUND" } }, String(url), 404);
  };
  return {
    fetchImpl,
    calls,
    records,
    get transactionQueryCount() { return transactionQueryCount; },
    get rollbackCount() { return rollbackCount; },
    get commitCount() { return commitCount; },
  };
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

test("Codex-local target guard rejects remote, credential, and external-effect drift", () => {
  assert.equal(
    assertCompanySettingsMigrationTarget("codex-local", codexTargetEnvironment()).remote,
    false,
  );
  for (const [target, env] of [
    ["dev", codexTargetEnvironment()],
    ["codex-local", codexTargetEnvironment({ GCLOUD_PROJECT: "air-guard-v2-dev" })],
    ["codex-local", codexTargetEnvironment({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" })],
    ["codex-local", codexTargetEnvironment({ AIR_GUARD_EXTERNAL_EFFECTS: "allow" })],
    ["codex-local", codexTargetEnvironment({ GOOGLE_APPLICATION_CREDENTIALS: "credential.json" })],
    ["codex-local", codexTargetEnvironment({ FIREBASE_CONFIG: JSON.stringify({ projectId: "other" }) })],
  ]) {
    assert.throws(
      () => assertCompanySettingsMigrationTarget(target, env),
      (error) => error.exitCode === COMPANY_SETTINGS_EXIT_CODES.TARGET_REJECTED,
    );
  }
});

test("public REST reader rejects a modified target before fetch", async () => {
  let fetched = false;
  await assert.rejects(
    readCompanySettingsMigrationState({
      target: { ...CODEX_COMPANY_SETTINGS_MIGRATION_TARGET, firestoreHost: "127.0.0.1:8080" },
      fetchImpl: async () => {
        fetched = true;
        throw new Error("must not fetch");
      },
    }),
    (error) => error.exitCode === COMPANY_SETTINGS_EXIT_CODES.TARGET_REJECTED,
  );
  assert.equal(fetched, false);
});

test("REST transport disables redirects before sending any request", async () => {
  const calls = [];
  await assert.rejects(
    readCompanySettingsMigrationState({
      fetchImpl: async (url, options) => {
        calls.push({ url: String(url), redirect: options.redirect });
        if (options.redirect !== "error") {
          calls.push({ url: "https://example.invalid/redirected", redirect: "followed" });
        }
        return {
          ok: false,
          status: 307,
          url: String(url),
          text: async () => "",
        };
      },
    }),
    /status 307/u,
  );
  assert.equal(calls.length, 4);
  assert.equal(calls.every(({ url }) => url.startsWith("http://127.0.0.1:18080/")), true);
  assert.equal(calls.every(({ redirect }) => redirect === "error"), true);
});

test("CLI requires explicit synthetic target inputs before any REST request", () => {
  const valid = [
    "--target", "codex-local",
    "--manifest-file", "synthetic-manifest.json",
    "--actor-uid", SYNTHETIC_CCB_ACTOR,
    "--timestamp", "2027-01-15T08:00:00.000000000Z",
    "--fixed-commit", "a".repeat(40),
  ];
  assert.equal(parseCompanySettingsMigrationArgs(valid).apply, false);
  assert.equal(
    parseCompanySettingsMigrationArgs([...valid, "--apply", "--plan-digest", "b".repeat(64)]).apply,
    true,
  );
  for (const invalidTimestamp of [
    "2026-02-31T08:00:00Z",
    "2025-02-29T08:00:00Z",
    "0000-01-01T00:00:00Z",
  ]) {
    const invalid = [...valid];
    invalid[invalid.indexOf("--timestamp") + 1] = invalidTimestamp;
    assert.throws(
      () => parseCompanySettingsMigrationArgs(invalid),
      (error) => error.exitCode === COMPANY_SETTINGS_EXIT_CODES.USAGE,
    );
  }
  for (const args of [
    [],
    valid.slice(0, -2),
    [...valid, "--apply"],
    [...valid, "--plan-digest", "b".repeat(64)],
    [...valid, "--unknown"],
  ]) {
    assert.throws(
      () => parseCompanySettingsMigrationArgs(args),
      (error) => error.exitCode === COMPANY_SETTINGS_EXIT_CODES.USAGE,
    );
  }
});

test("CLI terminal summaries report the same exit code as the process contract", async () => {
  const rest = createFakeFirestoreRest();
  const args = [
    "--target", "codex-local",
    "--manifest-file", "synthetic-manifest.json",
    "--actor-uid", SYNTHETIC_CCB_ACTOR,
    "--timestamp", "2027-01-15T08:00:00.000000000Z",
    "--fixed-commit", "a".repeat(40),
  ];
  const dependencies = {
    env: codexTargetEnvironment(),
    fetchImpl: rest.fetchImpl,
    readText: (path) => typeof path === "string"
      ? JSON.stringify([SYNTHETIC_CCB_COMPANIES[0]])
      : "rules_version = '2'; synthetic-only",
  };
  const dryRun = await runCompanySettingsMigrationCli(args, dependencies);
  assert.equal(dryRun.exitCode, COMPANY_SETTINGS_EXIT_CODES.CHANGES);
  assert.equal(dryRun.summary.exitCode, COMPANY_SETTINGS_EXIT_CODES.CHANGES);

  const changed = await runCompanySettingsMigrationCli(
    [...args, "--apply", "--plan-digest", "0".repeat(64)],
    dependencies,
  );
  assert.equal(changed.exitCode, COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE);
  assert.equal(changed.summary.exitCode, COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE);

  const applied = await runCompanySettingsMigrationCli(
    [...args, "--apply", "--plan-digest", dryRun.summary.planDigest],
    dependencies,
  );
  assert.equal(applied.exitCode, COMPANY_SETTINGS_EXIT_CODES.CLEAN);
  assert.equal(applied.summary.exitCode, COMPANY_SETTINGS_EXIT_CODES.CLEAN);
  assert.equal(applied.summary.status, "applied");

  const clean = await runCompanySettingsMigrationCli(args, dependencies);
  assert.equal(clean.exitCode, COMPANY_SETTINGS_EXIT_CODES.CLEAN);
  assert.equal(clean.summary.exitCode, COMPANY_SETTINGS_EXIT_CODES.CLEAN);
  const noOp = await runCompanySettingsMigrationCli(
    [...args, "--apply", "--plan-digest", clean.summary.planDigest],
    dependencies,
  );
  assert.equal(noOp.exitCode, COMPANY_SETTINGS_EXIT_CODES.CLEAN);
  assert.equal(noOp.summary.exitCode, COMPANY_SETTINGS_EXIT_CODES.CLEAN);

  const blockedRest = createFakeFirestoreRest({
    roots: [syntheticRoot(undefined, { unapprovedField: true })],
  });
  const blocked = await runCompanySettingsMigrationCli(
    [...args, "--apply", "--plan-digest", "f".repeat(64)],
    { ...dependencies, fetchImpl: blockedRest.fetchImpl },
  );
  assert.equal(blocked.exitCode, COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER);
  assert.equal(blocked.summary.exitCode, COMPANY_SETTINGS_EXIT_CODES.DATA_BLOCKER);
  assert.equal(blocked.summary.status, "blocked");
  assert.equal(blockedRest.calls.some(({ url }) => url.endsWith(":beginTransaction")), false);
});

test("REST create-only apply rechecks a typed transaction and passes fresh post-check", async () => {
  const rest = createFakeFirestoreRest();
  const planInput = createCodexCompanySettingsPlanInput({
    manifest: [SYNTHETIC_CCB_COMPANIES[0]],
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
    fixedCommit: "a".repeat(40),
    rulesText: "rules_version = '2'; synthetic-only",
  });
  const plan = await readCompanySettingsMigrationPlan({ planInput, fetchImpl: rest.fetchImpl });
  assert.equal(plan.exitCode, COMPANY_SETTINGS_EXIT_CODES.CHANGES);
  const result = await applyCompanySettingsMigrationPlan({
    planInput,
    plan,
    approvedPlanDigest: plan.planDigest,
    fetchImpl: rest.fetchImpl,
  });
  assert.equal(rest.commitCount, 1);
  assert.equal(rest.rollbackCount, 0);
  assert.equal(rest.transactionQueryCount, 3);
  assert.equal(rest.calls.every(({ headers }) => headers.authorization === "Bearer owner"), true);
  assert.equal(rest.calls.every(({ redirect }) => redirect === "error"), true);
  assert.equal(rest.records.filter(({ path }) => /\/(?:Settings|PrivateSettings)\//u.test(path)).length, 8);
  assert.equal(rest.records.filter(({ path }) => path.includes("/SettingAudits/")).length, 0);
  assert.deepEqual(rest.records.find(({ path }) => path === SYNTHETIC_CCB_COMPANIES[0]), syntheticRoot());
  assert.deepEqual(result.postCheck, {
    status: "clean",
    appliedTenantCount: 1,
    createdDocumentCount: 8,
    updatedDocumentCount: 0,
    deletedDocumentCount: 0,
    rootWriteCount: 0,
    auditWriteCount: 0,
  });
  assert.equal(result.afterPlan.candidates[0].classification, "alreadyEquivalent");
});

test("transaction drift rolls back without commit or target repair", async () => {
  const rest = createFakeFirestoreRest({ concurrentTarget: true });
  const planInput = createCodexCompanySettingsPlanInput({
    manifest: [SYNTHETIC_CCB_COMPANIES[0]],
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
    fixedCommit: "a".repeat(40),
    rulesText: "rules_version = '2'; synthetic-only",
  });
  const plan = await readCompanySettingsMigrationPlan({ planInput, fetchImpl: rest.fetchImpl });
  await assert.rejects(
    applyCompanySettingsMigrationPlan({
      planInput,
      plan,
      approvedPlanDigest: plan.planDigest,
      fetchImpl: rest.fetchImpl,
    }),
    (error) => error.exitCode === COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
  );
  assert.equal(rest.commitCount, 0);
  assert.equal(rest.rollbackCount, 1);
  assert.equal(rest.records.filter(({ path }) => path.endsWith("/Settings/profile")).length, 1);
  assert.equal(rest.records.filter(({ path }) => path.endsWith("/Settings/billing")).length, 0);
});

test("partial multi-tenant failure preserves creates and returns a fresh resume plan", async () => {
  const second = SYNTHETIC_CCB_COMPANIES[1];
  const rest = createFakeFirestoreRest({
    roots: [syntheticRoot(), syntheticRoot(second)],
    failCommitCompanyPath: second,
  });
  const planInput = createCodexCompanySettingsPlanInput({
    manifest: [...SYNTHETIC_CCB_COMPANIES],
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
    fixedCommit: "a".repeat(40),
    rulesText: "rules_version = '2'; synthetic-only",
  });
  const plan = await readCompanySettingsMigrationPlan({ planInput, fetchImpl: rest.fetchImpl });
  let failure;
  try {
    await applyCompanySettingsMigrationPlan({
      planInput,
      plan,
      approvedPlanDigest: plan.planDigest,
      fetchImpl: rest.fetchImpl,
    });
    assert.fail("partial apply must fail");
  } catch (error) {
    failure = error;
  }
  assert.equal(failure.exitCode, COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE);
  assert.equal(failure.appliedTenantCount, 1);
  assert.equal(failure.createdDocumentCount, 8);
  assert.equal(failure.recoveryPlanSummary.exitCode, COMPANY_SETTINGS_EXIT_CODES.CHANGES);
  assert.equal(failure.recoveryPlanSummary.counts.alreadyEquivalent, 1);
  assert.equal(failure.recoveryPlanSummary.counts.eligibleCreate, 1);
  assert.equal(rest.commitCount, 1);
  assert.equal(rest.rollbackCount, 1);
  assert.equal(
    rest.records.filter(({ path }) => path.startsWith(`${SYNTHETIC_CCB_COMPANIES[0]}/Settings/`) || path.startsWith(`${SYNTHETIC_CCB_COMPANIES[0]}/PrivateSettings/`)).length,
    8,
  );
  assert.equal(
    rest.records.filter(({ path }) => path.startsWith(`${second}/Settings/`) || path.startsWith(`${second}/PrivateSettings/`)).length,
    0,
  );
  assert.equal(rest.calls.some(({ method }) => method === "DELETE"), false);
});

test("lost commit response distinguishes acknowledged and freshly observed creates", async () => {
  const rest = createFakeFirestoreRest({ loseCommitResponse: true });
  const planInput = createCodexCompanySettingsPlanInput({
    manifest: [SYNTHETIC_CCB_COMPANIES[0]],
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
    fixedCommit: "a".repeat(40),
    rulesText: "rules_version = '2'; synthetic-only",
  });
  const plan = await readCompanySettingsMigrationPlan({ planInput, fetchImpl: rest.fetchImpl });
  let failure;
  try {
    await applyCompanySettingsMigrationPlan({
      planInput,
      plan,
      approvedPlanDigest: plan.planDigest,
      fetchImpl: rest.fetchImpl,
    });
    assert.fail("lost commit response must remain an apply failure");
  } catch (error) {
    failure = error;
  }
  const summary = summarizeCompanySettingsMigrationError(failure);
  assert.equal(summary.acknowledgedAppliedTenantCount, 0);
  assert.equal(summary.acknowledgedCreatedDocumentCount, 0);
  assert.equal(summary.commitOutcomeMayBeUnknown, true);
  assert.equal(summary.observedCreatedTenantCount, 1);
  assert.equal(summary.observedCreatedDocumentCount, 8);
  assert.equal(summary.recoveryPlan.status, "clean");
  assert.equal(summary.stateVerificationRequired, false);
  assert.equal(summary.resumeRequired, true);
  assert.equal(rest.records.filter(({ path }) => /\/(?:Settings|PrivateSettings)\//u.test(path)).length, 8);
  assert.equal(rest.rollbackCount, 0);
  assert.equal(rest.calls.some(({ method }) => method === "DELETE"), false);
});

test("lost commit response and failed recovery read require state verification", async () => {
  const rest = createFakeFirestoreRest({
    loseCommitResponse: true,
    failRecoveryRead: true,
  });
  const planInput = createCodexCompanySettingsPlanInput({
    manifest: [SYNTHETIC_CCB_COMPANIES[0]],
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
    fixedCommit: "a".repeat(40),
    rulesText: "rules_version = '2'; synthetic-only",
  });
  const plan = await readCompanySettingsMigrationPlan({ planInput, fetchImpl: rest.fetchImpl });
  let failure;
  try {
    await applyCompanySettingsMigrationPlan({
      planInput,
      plan,
      approvedPlanDigest: plan.planDigest,
      fetchImpl: rest.fetchImpl,
    });
    assert.fail("lost commit and recovery responses must fail");
  } catch (error) {
    failure = error;
  }
  const summary = summarizeCompanySettingsMigrationError(failure);
  assert.equal(summary.acknowledgedAppliedTenantCount, 0);
  assert.equal(summary.commitOutcomeMayBeUnknown, true);
  assert.equal(summary.observedCreatedTenantCount, null);
  assert.equal(summary.recoveryPlan, null);
  assert.equal(summary.stateVerificationRequired, true);
  assert.equal(summary.resumeRequired, true);
  assert.equal(rest.records.filter(({ path }) => /\/(?:Settings|PrivateSettings)\//u.test(path)).length, 8);
  assert.equal(rest.rollbackCount, 0);
  assert.equal(rest.calls.some(({ method }) => method === "DELETE"), false);
});

test("digest mismatch stops before beginning a transaction", async () => {
  const rest = createFakeFirestoreRest();
  const planInput = createCodexCompanySettingsPlanInput({
    manifest: [SYNTHETIC_CCB_COMPANIES[0]],
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
    fixedCommit: "a".repeat(40),
    rulesText: "rules_version = '2'; synthetic-only",
  });
  const plan = await readCompanySettingsMigrationPlan({ planInput, fetchImpl: rest.fetchImpl });
  await assert.rejects(
    applyCompanySettingsMigrationPlan({
      planInput,
      plan,
      approvedPlanDigest: "0".repeat(64),
      fetchImpl: rest.fetchImpl,
    }),
    (error) => error.exitCode === COMPANY_SETTINGS_EXIT_CODES.APPLY_INCOMPLETE,
  );
  assert.equal(rest.calls.some(({ url }) => url.endsWith(":beginTransaction")), false);
  assert.equal(rest.commitCount, 0);
});
