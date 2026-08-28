import {
  createCompanySettingsManifestDigest,
  encodeJsAsFirestoreValue,
} from "../../scripts/migrate-company-settings.mjs";

export const SYNTHETIC_CCB_ACTOR = "ccb-local-synthetic-operator";
export const SYNTHETIC_CCB_TIMESTAMP = Object.freeze({
  seconds: 1_800_000_000,
  nanoseconds: 0,
});

export const SYNTHETIC_CCB_COMPANIES = Object.freeze([
  "Companies/codex-company-a",
  "Companies/codex-company-b",
]);

export function syntheticLegacyCompany(overrides = {}) {
  return {
    companyName: "Codex架空警備株式会社",
    companyNameKana: "コーデックスカクウケイビカブシキガイシャ",
    zipcode: "1000001",
    prefCode: "13",
    city: "千代田区",
    address: "架空1-1",
    building: null,
    tel: "03-0000-0000",
    fax: null,
    invoiceNumber: "T1234567890123",
    bankName: "架空銀行",
    branchName: "架空支店",
    accountType: "普通",
    accountNumber: "1234567",
    accountHolder: "コーデックスカクウケイビ",
    minuteInterval: 5,
    roundSetting: "ROUND",
    firstDayOfWeek: 1,
    attendanceManagementMode: "ACTUAL_DATE",
    siteOrder: [{ siteId: "synthetic-site-a", shiftType: "DAY" }],
    scheduleOrder: [{ siteId: "synthetic-site-b", shiftType: "NIGHT" }],
    maintenanceMode: false,
    ...overrides,
  };
}

export function syntheticRoot(path = SYNTHETIC_CCB_COMPANIES[0], overrides = {}) {
  const data = syntheticLegacyCompany(overrides);
  return {
    path,
    value: encodeJsAsFirestoreValue(data),
    updateTime: "2026-08-28T00:00:00.000000000Z",
  };
}

export function syntheticMigrationSnapshot(overrides = {}) {
  const snapshot = {
    editionVerified: true,
    projectId: "demo-air-guard-v2-codex",
    databaseId: "(default)",
    databaseType: "FIRESTORE_NATIVE",
    edition: "STANDARD",
    editionReceiptDigest: "e".repeat(64),
    actorUid: SYNTHETIC_CCB_ACTOR,
    timestamp: SYNTHETIC_CCB_TIMESTAMP,
    fixedCommit: "0ab844fa009a753c8def16f96415608c45580bd6",
    schemaPackageVersion: "2.4.2-dev.167",
    schemaContractVersion: 1,
    rulesReceiptDigest: null,
    manifest: [SYNTHETIC_CCB_COMPANIES[0]],
    roots: [syntheticRoot()],
    targets: [],
    audits: [],
    unexpectedDocuments: [],
    ...overrides,
  };
  snapshot.targetManifestDigest = overrides.targetManifestDigest ??
    createCompanySettingsManifestDigest(snapshot.manifest);
  return snapshot;
}
