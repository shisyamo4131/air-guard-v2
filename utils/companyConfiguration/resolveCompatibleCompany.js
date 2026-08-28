import {
  COMPANY_CONFIGURATION_SCHEMA_VERSION,
  COMPANY_CONFIGURATION_STATE,
  parseCompanyArrangementV1,
  parseCompanyBillingV1,
  parseCompanyEntitlementV1,
  parseCompanyMaintenanceV1,
  parseCompanyOperationsV1,
  parseCompanyProfileV1,
  parseCompanyRootProjectionV1,
} from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

export const COMPANY_CONFIGURATION_MODE = Object.freeze({
  INITIALIZING: "INITIALIZING",
  LEGACY: "LEGACY",
  ACTIVE: COMPANY_CONFIGURATION_STATE,
  ERROR: "ERROR",
});

const ACTIVE_SETTING_NAMES = Object.freeze([
  "profile",
  "billing",
  "operations",
  "arrangement",
  "entitlement",
  "maintenance",
]);

const ATTENDANCE_MODE_TO_LEGACY = Object.freeze({
  LABOR_STANDARD: "ACTUAL_DATE",
  OPERATION_COUNT: "OPERATION_DATE",
});

const PROFILE_FIELDS = Object.freeze([
  "companyName",
  "companyNameKana",
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
  "tel",
  "fax",
]);

const BILLING_FIELDS = Object.freeze([
  "invoiceNumber",
  "bankName",
  "branchName",
  "accountType",
  "accountNumber",
  "accountHolder",
]);

const pick = (source, fields) =>
  Object.fromEntries(fields.map((field) => [field, source[field]]));

export class CompanyConfigurationReadError extends Error {
  constructor(code, path, options = {}) {
    super(`[CompanyConfiguration] ${code} at ${path}`, options);
    this.name = "CompanyConfigurationReadError";
    this.code = code;
    this.path = path;
  }
}

export function isCompanyConfigurationActive(root) {
  return (
    root?.schemaVersion === COMPANY_CONFIGURATION_SCHEMA_VERSION &&
    root?.configurationState === COMPANY_CONFIGURATION_STATE
  );
}

function requireActiveSettings(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new CompanyConfigurationReadError(
      "MISSING_ACTIVE_SETTINGS",
      "$.Settings",
    );
  }
  for (const name of ACTIVE_SETTING_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(settings, name)) {
      throw new CompanyConfigurationReadError(
        "MISSING_ACTIVE_SETTING",
        `$.Settings.${name}`,
      );
    }
  }
}

/**
 * Company rootとclient-visible Settingsを、現行画面が読めるCompany形状へ解決する。
 * Active markerが揃った後はcomplete Settingsを厳密検証し、legacyへ戻さない。
 */
export function resolveCompatibleCompany({ companyId, root, settings } = {}) {
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new CompanyConfigurationReadError("MISSING_COMPANY_ROOT", "$.root");
  }

  if (!isCompanyConfigurationActive(root)) {
    return {
      mode: COMPANY_CONFIGURATION_MODE.LEGACY,
      companyData: { ...root, docId: companyId },
      root: null,
      settings: null,
    };
  }

  requireActiveSettings(settings);

  const parsedRoot = parseCompanyRootProjectionV1(root);
  const parsedSettings = {
    profile: parseCompanyProfileV1(settings.profile),
    billing: parseCompanyBillingV1(settings.billing),
    operations: parseCompanyOperationsV1(settings.operations),
    arrangement: parseCompanyArrangementV1(settings.arrangement),
    entitlement: parseCompanyEntitlementV1(settings.entitlement),
    maintenance: parseCompanyMaintenanceV1(settings.maintenance),
  };

  const attendanceManagementMode =
    ATTENDANCE_MODE_TO_LEGACY[
      parsedSettings.operations.attendanceSummaryMode
    ];
  if (!attendanceManagementMode) {
    throw new CompanyConfigurationReadError(
      "UNSUPPORTED_ATTENDANCE_SUMMARY_MODE",
      "$.Settings.operations.attendanceSummaryMode",
    );
  }

  return {
    mode: COMPANY_CONFIGURATION_MODE.ACTIVE,
    companyData: {
      docId: companyId,
      createdAt: parsedRoot.createdAt,
      updatedAt: parsedRoot.updatedAt,
      ...pick(parsedSettings.profile, PROFILE_FIELDS),
      ...pick(parsedSettings.billing, BILLING_FIELDS),
      minuteInterval: parsedSettings.operations.minuteInterval,
      roundSetting: parsedSettings.operations.roundSetting,
      firstDayOfWeek: parsedSettings.operations.firstDayOfWeek,
      attendanceManagementMode,
      siteOrder: parsedSettings.arrangement.siteOrder,
      scheduleOrder: parsedSettings.arrangement.scheduleOrder,
      maintenanceMode:
        parsedRoot.status !== "ACTIVE" ||
        parsedSettings.maintenance.maintenanceMode,
      maintenanceReason: parsedSettings.maintenance.maintenanceReason,
      maintenanceStartAt: parsedSettings.maintenance.maintenanceStartAt,
    },
    root: parsedRoot,
    settings: parsedSettings,
  };
}

export { ACTIVE_SETTING_NAMES };
