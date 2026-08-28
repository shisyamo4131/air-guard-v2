import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPANY_CONFIGURATION_MODE,
  CompanyConfigurationReadError,
  isCompanyConfigurationActive,
  resolveCompatibleCompany,
} from "../../utils/companyConfiguration/resolveCompatibleCompany.js";

const timestamp = Object.freeze({ seconds: 1_800_000_000, nanoseconds: 0 });

function metadata(revision = 1) {
  return {
    schemaVersion: 1,
    revision,
    createdAt: timestamp,
    createdBy: "provider-operator",
    updatedAt: timestamp,
    updatedBy: "provider-operator",
  };
}

function activeRoot(overrides = {}) {
  return {
    schemaVersion: 1,
    configurationState: "CCB_V1_ACTIVE",
    status: "ACTIVE",
    createdAt: timestamp,
    createdBy: "provider-operator",
    updatedAt: timestamp,
    updatedBy: "provider-operator",
    companyName: "旧会社名",
    docId: "legacy-framework-field",
    ...overrides,
  };
}

function activeSettings(overrides = {}) {
  return {
    profile: {
      ...metadata(),
      companyName: "株式会社テスト",
      companyNameKana: "カブシキガイシャテスト",
      zipcode: "1000001",
      prefCode: "13",
      city: "千代田区",
      address: "千代田1-1",
      building: null,
      tel: "03-1234-5678",
      fax: null,
    },
    billing: {
      ...metadata(),
      invoiceNumber: "1234567890123",
      bankName: null,
      branchName: null,
      accountType: null,
      accountNumber: null,
      accountHolder: null,
    },
    operations: {
      ...metadata(),
      minuteInterval: 5,
      roundSetting: "ROUND",
      firstDayOfWeek: 1,
      attendanceSummaryMode: "LABOR_STANDARD",
    },
    arrangement: {
      ...metadata(),
      siteOrder: [{ siteId: "site-1", shiftType: "DAY" }],
      scheduleOrder: [{ siteId: "site-2", shiftType: "NIGHT" }],
    },
    entitlement: {
      ...metadata(),
      entitlementState: "DISABLED",
      planCode: null,
      featureCodes: [],
      employeeLimit: null,
    },
    maintenance: {
      ...metadata(),
      maintenanceMode: false,
      maintenanceReason: null,
      maintenanceStartAt: null,
    },
    ...overrides,
  };
}

test("markerが揃わないCompanyはlegacy rootをそのまま正本にする", () => {
  const root = {
    companyName: "Legacy Company",
    schemaVersion: 1,
    unknownLegacyField: "preserved",
  };
  assert.equal(isCompanyConfigurationActive(root), false);

  const resolved = resolveCompatibleCompany({ companyId: "company-1", root });
  assert.equal(resolved.mode, COMPANY_CONFIGURATION_MODE.LEGACY);
  assert.deepEqual(resolved.companyData, { ...root, docId: "company-1" });
  assert.equal(resolved.root, null);
  assert.equal(resolved.settings, null);
});

test("active marker後はroot projectionと6 Settingsを厳密検証して現行表示形へ写す", () => {
  const resolved = resolveCompatibleCompany({
    companyId: "company-1",
    root: activeRoot(),
    settings: activeSettings(),
  });

  assert.equal(resolved.mode, COMPANY_CONFIGURATION_MODE.ACTIVE);
  assert.equal(resolved.root.status, "ACTIVE");
  assert.equal(resolved.companyData.docId, "company-1");
  assert.equal(resolved.companyData.companyName, "株式会社テスト");
  assert.equal(resolved.companyData.createdAt, timestamp);
  assert.equal(resolved.companyData.updatedAt, timestamp);
  assert.equal("revision" in resolved.companyData, false);
  assert.equal(resolved.companyData.minuteInterval, 5);
  assert.equal(resolved.companyData.attendanceManagementMode, "ACTUAL_DATE");
  assert.deepEqual(resolved.companyData.siteOrder, [
    { siteId: "site-1", shiftType: "DAY" },
  ]);
  assert.equal(resolved.companyData.maintenanceMode, false);
  assert.equal("subscription" in resolved.companyData, false);
  assert.equal("stripeCustomerId" in resolved.companyData, false);
});

test("OPERATION_COUNTは既存画面互換のOPERATION_DATEへ写す", () => {
  const settings = activeSettings();
  settings.operations.attendanceSummaryMode = "OPERATION_COUNT";
  const resolved = resolveCompatibleCompany({
    companyId: "company-1",
    root: activeRoot(),
    settings,
  });
  assert.equal(resolved.companyData.attendanceManagementMode, "OPERATION_DATE");
});

test("SUSPENDEDとCLOSEDはclient通常画面をfail closedにする", () => {
  for (const status of ["SUSPENDED", "CLOSED"]) {
    const resolved = resolveCompatibleCompany({
      companyId: "company-1",
      root: activeRoot({ status }),
      settings: activeSettings(),
    });
    assert.equal(resolved.companyData.maintenanceMode, true);
  }
});

test("active marker後にSettingsが欠けた場合はlegacyへfallbackしない", () => {
  const settings = activeSettings();
  delete settings.billing;
  assert.throws(
    () =>
      resolveCompatibleCompany({
        companyId: "company-1",
        root: activeRoot(),
        settings,
      }),
    (error) =>
      error instanceof CompanyConfigurationReadError &&
      error.code === "MISSING_ACTIVE_SETTING" &&
      error.path === "$.Settings.billing",
  );
});

test("active marker後のinvalid Settingsはpackage parserでfail closedにする", () => {
  const settings = activeSettings();
  settings.operations.minuteInterval = 6;
  assert.throws(
    () =>
      resolveCompatibleCompany({
        companyId: "company-1",
        root: activeRoot(),
        settings,
      }),
    (error) =>
      error?.code === "INVALID_VALUE" && error?.path === "$.minuteInterval",
  );
});

test("active rootの未知fieldはactivation projectionで拒否する", () => {
  assert.throws(
    () =>
      resolveCompatibleCompany({
        companyId: "company-1",
        root: activeRoot({ unexpected: true }),
        settings: activeSettings(),
      }),
    (error) => error?.code === "UNKNOWN_FIELD" && error?.path === "$.unexpected",
  );
});

test("client CompanyはActive時の旧root updateを実行前に拒否する", async () => {
  const { default: Company } = await import("../../schemas/Company.js");
  const company = new Company();
  company._companyConfigurationMode = COMPANY_CONFIGURATION_MODE.ACTIVE;

  await assert.rejects(
    () => company.update(),
    (error) =>
      error instanceof CompanyConfigurationReadError &&
      error.code === "LEGACY_COMPANY_WRITE_DISABLED",
  );
});
