import {
  createCompanySettingAuditsArtifactDigest,
  createCompanySettingAuditsManifestDigest,
  COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_CONTRACT,
  COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_PACKAGE,
} from "../../scripts/restore-company-setting-audits.mjs";
import { encodeJsAsFirestoreValue } from "../../scripts/migrate-company-settings.mjs";

export const SYNTHETIC_AUDIT_COMPANY_PATH = "Companies/synthetic-ccb-tenant";
export const SYNTHETIC_AUDIT_CONTEXT = Object.freeze({
  projectId: "demo-air-guard-v2-codex",
  databaseId: "(default)",
});
export const SYNTHETIC_AUDIT_SNAPSHOT_READ_TIME =
  "2026-08-28T12:00:01.000000000Z";

export function syntheticSettingAudit(overrides = {}) {
  return {
    schemaVersion: 1,
    settingType: "PROFILE",
    fromRevision: 1,
    toRevision: 2,
    actorUid: "synthetic-operator",
    createdAt: { seconds: 1_787_000_000, nanoseconds: 123_000_000 },
    changes: [
      { field: "companyName", before: "旧社名", after: "新社名" },
      { field: "tel", before: null, after: "03-1234-5678" },
    ],
    ...overrides,
  };
}

export function syntheticAuditRecord(id = "audit-001", value = syntheticSettingAudit()) {
  return {
    path: `${SYNTHETIC_AUDIT_COMPANY_PATH}/SettingAudits/${id}`,
    value: encodeJsAsFirestoreValue(value),
  };
}

export function syntheticAuditRestoreInput({
  sourceAudits = [syntheticAuditRecord()],
  targetAudits = [],
  manifest = sourceAudits.map(({ path }) => path),
  source = SYNTHETIC_AUDIT_CONTEXT,
  target = SYNTHETIC_AUDIT_CONTEXT,
  companyPath = SYNTHETIC_AUDIT_COMPANY_PATH,
  schemaPackageVersion = COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_PACKAGE,
  schemaContractVersion = COMPANY_SETTING_AUDIT_RESTORE_SCHEMA_CONTRACT,
} = {}) {
  const input = {
    source,
    target,
    targetSnapshotReadTime: SYNTHETIC_AUDIT_SNAPSHOT_READ_TIME,
    companyPath,
    schemaPackageVersion,
    schemaContractVersion,
    manifest,
    manifestDigest: createCompanySettingAuditsManifestDigest(manifest),
    sourceAudits,
    artifactDigest: createCompanySettingAuditsArtifactDigest({
      source,
      companyPath,
      schemaPackageVersion,
      schemaContractVersion,
      sourceAudits,
    }),
    targetObservations: [
      ...manifest.map((path) => {
        const targetAudit = targetAudits.find((record) => record.path === path);
        return targetAudit
          ? {
            ...structuredClone(targetAudit),
            exists: true,
            readTime: SYNTHETIC_AUDIT_SNAPSHOT_READ_TIME,
          }
          : {
            path,
            exists: false,
            readTime: SYNTHETIC_AUDIT_SNAPSHOT_READ_TIME,
          };
      }),
      ...targetAudits
        .filter((record) => !manifest.includes(record.path))
        .map((record) => ({
          ...structuredClone(record),
          exists: true,
          readTime: SYNTHETIC_AUDIT_SNAPSHOT_READ_TIME,
        })),
    ],
  };
  return structuredClone(input);
}

export function syntheticExistingAudit(record = syntheticAuditRecord()) {
  return {
    ...structuredClone(record),
    updateTime: "2026-08-28T12:00:00.000000000Z",
  };
}
