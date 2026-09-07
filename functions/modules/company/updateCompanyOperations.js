/*****************************************************************************
 * @file ./functions/modules/company/updateCompanyOperations.js
 * @description Company通常設定をoperation所有fieldだけで更新します。
 *****************************************************************************/
import { FieldValue } from "firebase-admin/firestore";
import {
  CompanyConfigurationValidationError,
  parseUpdateCompanyOperationsInputV1,
} from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

export const COMPANY_OPERATIONS_FIELDS = Object.freeze([
  "minuteInterval",
  "roundSetting",
  "firstDayOfWeek",
  "attendanceManagementMode",
]);

const ATTENDANCE_SUMMARY_MODE_BY_LEGACY = Object.freeze({
  ACTUAL_DATE: "LABOR_STANDARD",
  OPERATION_DATE: "OPERATION_COUNT",
});

const LEGACY_ATTENDANCE_MODE_BY_SUMMARY = Object.freeze({
  LABOR_STANDARD: "ACTUAL_DATE",
  OPERATION_COUNT: "OPERATION_DATE",
});

export const COMPANY_OPERATIONS_UPDATE_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "invalid-input",
  INVALID_DEPENDENCY: "invalid-dependency",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  COMPANY_NOT_FOUND: "company-not-found",
});

export class CompanyOperationsUpdateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "CompanyOperationsUpdateError";
    this.code = code;
  }
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertIdentifier(value, name) {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    value.includes("/")
  ) {
    throw new CompanyOperationsUpdateError(
      COMPANY_OPERATIONS_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      `[updateCompanyOperations] ${name} is invalid`,
    );
  }
}

export function parseCompanyOperationsChanges(input) {
  if (
    !isPlainRecord(input) ||
    Object.keys(input).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(input, "changes") ||
    !isPlainRecord(input.changes)
  ) {
    throw new CompanyOperationsUpdateError(
      COMPANY_OPERATIONS_UPDATE_ERROR_CODES.INVALID_INPUT,
      "[updateCompanyOperations] Input must contain only a changes object",
    );
  }

  const entries = Object.entries(input.changes);
  if (
    entries.length === 0 ||
    entries.some(([field]) => !COMPANY_OPERATIONS_FIELDS.includes(field))
  ) {
    throw new CompanyOperationsUpdateError(
      COMPANY_OPERATIONS_UPDATE_ERROR_CODES.INVALID_INPUT,
      "[updateCompanyOperations] Changes are empty or contain an unmanaged field",
    );
  }

  return Object.fromEntries(entries);
}

function currentOperations(company) {
  return Object.fromEntries(
    COMPANY_OPERATIONS_FIELDS.map((field) => [field, company[field] ?? null]),
  );
}

function toAttendanceSummaryModeForCandidate(value) {
  if (value === null || value === undefined || value === "") {
    return "LABOR_STANDARD";
  }
  return ATTENDANCE_SUMMARY_MODE_BY_LEGACY[value];
}

function normalizeOperations(value) {
  const hasLegacyAttendanceMode =
    value.attendanceManagementMode !== null &&
    value.attendanceManagementMode !== undefined &&
    value.attendanceManagementMode !== "";
  const canonical = parseUpdateCompanyOperationsInputV1({
    expectedRevision: 1,
    value: {
      minuteInterval: value.minuteInterval,
      roundSetting: value.roundSetting,
      firstDayOfWeek: value.firstDayOfWeek,
      attendanceSummaryMode: toAttendanceSummaryModeForCandidate(
        value.attendanceManagementMode,
      ),
    },
  }).value;

  return {
    minuteInterval: canonical.minuteInterval,
    roundSetting: canonical.roundSetting,
    firstDayOfWeek: canonical.firstDayOfWeek,
    attendanceManagementMode: hasLegacyAttendanceMode
      ? LEGACY_ATTENDANCE_MODE_BY_SUMMARY[canonical.attendanceSummaryMode]
      : value.attendanceManagementMode,
  };
}

export function buildCompanyOperationsUpdate(company, changes) {
  if (
    Object.hasOwn(changes, "attendanceManagementMode") &&
    !Object.hasOwn(
      ATTENDANCE_SUMMARY_MODE_BY_LEGACY,
      changes.attendanceManagementMode,
    )
  ) {
    throw new CompanyOperationsUpdateError(
      COMPANY_OPERATIONS_UPDATE_ERROR_CODES.INVALID_INPUT,
      "[updateCompanyOperations] Invalid attendance management mode change",
    );
  }

  let normalized;
  try {
    normalized = normalizeOperations({
      ...currentOperations(company),
      ...changes,
    });
  } catch (error) {
    if (error instanceof CompanyConfigurationValidationError) {
      throw new CompanyOperationsUpdateError(
        COMPANY_OPERATIONS_UPDATE_ERROR_CODES.INVALID_INPUT,
        `[updateCompanyOperations] Invalid Company operations at ${error.path}`,
        { cause: error },
      );
    }
    throw error;
  }

  return Object.fromEntries(
    Object.keys(changes)
      .filter(
        (field) => !Object.is(company[field] ?? null, normalized[field]),
      )
      .map((field) => [field, normalized[field]]),
  );
}

function assertActor(identity, actorUser) {
  if (
    identity.isSuperUser !== false ||
    !isPlainRecord(actorUser) ||
    actorUser.companyId !== identity.companyId ||
    actorUser.isTemporary !== false ||
    actorUser.disabled !== false ||
    actorUser.isAdmin !== true
  ) {
    throw new CompanyOperationsUpdateError(
      COMPANY_OPERATIONS_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[updateCompanyOperations] Actor is not an active Company administrator",
    );
  }
}

export async function updateCompanyOperations({
  firestore,
  identity,
  input,
  serverTimestampFactory = () => FieldValue.serverTimestamp(),
} = {}) {
  if (!firestore || typeof firestore.doc !== "function") {
    throw new CompanyOperationsUpdateError(
      COMPANY_OPERATIONS_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      "[updateCompanyOperations] Firestore service is invalid",
    );
  }
  if (!identity || typeof identity !== "object") {
    throw new CompanyOperationsUpdateError(
      COMPANY_OPERATIONS_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      "[updateCompanyOperations] Identity is invalid",
    );
  }
  assertIdentifier(identity.companyId, "companyId");
  assertIdentifier(identity.uid, "actorUid");

  const changes = parseCompanyOperationsChanges(input);
  const companyRef = firestore.doc(`Companies/${identity.companyId}`);
  const actorRef = firestore.doc(
    `Companies/${identity.companyId}/Users/${identity.uid}`,
  );

  let updatedFields = [];
  await firestore.runTransaction(async (transaction) => {
    const actorSnapshot = await transaction.get(actorRef);
    assertActor(identity, actorSnapshot.exists ? actorSnapshot.data() : null);

    const companySnapshot = await transaction.get(companyRef);
    if (!companySnapshot.exists) {
      throw new CompanyOperationsUpdateError(
        COMPANY_OPERATIONS_UPDATE_ERROR_CODES.COMPANY_NOT_FOUND,
        "[updateCompanyOperations] Company was not found",
      );
    }

    const update = buildCompanyOperationsUpdate(
      companySnapshot.data(),
      changes,
    );
    updatedFields = Object.keys(update);
    if (updatedFields.length === 0) return;

    transaction.update(companyRef, {
      ...update,
      updatedAt: serverTimestampFactory(),
      uid: identity.uid,
    });
  });

  return {
    success: true,
    updated: updatedFields.length > 0,
    updatedFields,
  };
}
