/*****************************************************************************
 * @file ./functions/modules/auth/policies/userLifecyclePolicy.js
 * @description UWB-07のEmployee退職、単独本登録User削除、誤退職訂正を
 * 副作用なしで検証します。
 *****************************************************************************/
import { resolveRolePermissions, RolePermissionError } from "./rolePermissions.js";
import {
  assertUserDocumentCompany,
  UserAuthCompanyPolicyError,
} from "./userAuthCompanyPolicy.js";

const RETIREMENT_INPUT_FIELDS = new Set([
  "operationId",
  "employeeId",
  "terminationDate",
  "reasonOfTermination",
]);
const STANDALONE_USER_DELETION_INPUT_FIELDS = new Set([
  "operationId",
  "targetUserId",
  "reason",
]);
const REINSTATEMENT_INPUT_FIELDS = new Set([
  "operationId",
  "employeeId",
  "reversesOperationId",
  "correctionReasonCode",
]);
const REINSTATEMENT_CONTEXT_INPUT_FIELDS = new Set(["employeeId"]);
const LIFECYCLE_HISTORY_INPUT_FIELDS = new Set(["cursor"]);
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_REASON_LENGTH = 20;

export const EMPLOYEE_REINSTATEMENT_REASON_CODES = Object.freeze({
  MISTAKEN_RETIREMENT: "MISTAKEN_RETIREMENT",
});

export const USER_LIFECYCLE_POLICY_ERROR_CODES = Object.freeze({
  INPUT_INVALID: "input-invalid",
  UNEXPECTED_FIELD: "unexpected-field",
  OPERATION_ID_INVALID: "operation-id-invalid",
  IDENTIFIER_INVALID: "identifier-invalid",
  DATE_INVALID: "date-invalid",
  REASON_INVALID: "reason-invalid",
  CORRECTION_REASON_INVALID: "correction-reason-invalid",
  ACTOR_DISABLED_STATE_INVALID: "actor-disabled-state-invalid",
  ACTOR_NOT_ACTIVE: "actor-not-active",
  ACTOR_ADMIN_STATE_INVALID: "actor-admin-state-invalid",
  ACTOR_ROLES_INVALID: "actor-roles-invalid",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  SELF_OPERATION_DENIED: "self-operation-denied",
  EMPLOYEE_INVALID: "employee-invalid",
  EMPLOYEE_STATE_INVALID: "employee-state-invalid",
  TERMINATION_DATE_BEFORE_HIRE: "termination-date-before-hire",
  TERMINATION_DATE_IN_FUTURE: "termination-date-in-future",
  TARGET_USER_INVALID: "target-user-invalid",
  TARGET_ADMIN_STATE_INVALID: "target-admin-state-invalid",
  TARGET_IS_ADMIN: "target-is-admin",
  TARGET_SUPER_USER_STATE_INVALID: "target-super-user-state-invalid",
  TARGET_IS_SUPER_USER: "target-is-super-user",
  TARGET_HAS_EMPLOYEE: "target-has-employee",
});

export class UserLifecyclePolicyError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "UserLifecyclePolicyError";
    this.code = code;
  }
}

function throwPolicyError(code, message, options = {}) {
  throw new UserLifecyclePolicyError(code, message, options);
}

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function assertExactFields(input, allowedFields) {
  if (!isPlainObject(input)) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.INPUT_INVALID,
      "[userLifecyclePolicy] input must be a plain object",
    );
  }

  const fields = Object.keys(input);
  if (fields.length !== allowedFields.size) {
    const unexpected = fields.find((field) => !allowedFields.has(field));
    throwPolicyError(
      unexpected
        ? USER_LIFECYCLE_POLICY_ERROR_CODES.UNEXPECTED_FIELD
        : USER_LIFECYCLE_POLICY_ERROR_CODES.INPUT_INVALID,
      unexpected
        ? `[userLifecyclePolicy] unexpected field: ${unexpected}`
        : "[userLifecyclePolicy] input fields are incomplete",
    );
  }

  for (const field of fields) {
    if (!allowedFields.has(field)) {
      throwPolicyError(
        USER_LIFECYCLE_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
        `[userLifecyclePolicy] unexpected field: ${field}`,
      );
    }
  }
}

function resolveOperationId(value, fieldName = "operationId") {
  if (typeof value !== "string" || !UUID_V4_PATTERN.test(value)) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.OPERATION_ID_INVALID,
      `[userLifecyclePolicy] ${fieldName} must be a lower-case UUID v4`,
    );
  }
  return value;
}

function resolveDocumentId(value, fieldName) {
  if (
    typeof value !== "string" ||
    !value ||
    /\s/u.test(value) ||
    value.includes("/")
  ) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.IDENTIFIER_INVALID,
      `[userLifecyclePolicy] ${fieldName} is invalid`,
    );
  }
  return value;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function resolveDateOnly(value, fieldName) {
  if (typeof value !== "string") {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.DATE_INVALID,
      `[userLifecyclePolicy] ${fieldName} must be YYYY-MM-DD`,
    );
  }

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.DATE_INVALID,
      `[userLifecyclePolicy] ${fieldName} must be YYYY-MM-DD`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1]
  ) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.DATE_INVALID,
      `[userLifecyclePolicy] ${fieldName} is not a real calendar date`,
    );
  }

  return value;
}

function resolveReason(value, fieldName) {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    value.length > MAX_REASON_LENGTH
  ) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.REASON_INVALID,
      `[userLifecyclePolicy] ${fieldName} is invalid`,
    );
  }
  return value;
}

function resolveActorPermissions({ companyId, actorUser }) {
  if (!isPlainObject(actorUser)) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.INPUT_INVALID,
      "[userLifecyclePolicy] actor User is invalid",
    );
  }

  assertUserDocumentCompany({ pathCompanyId: companyId, userData: actorUser });

  if (typeof actorUser.disabled !== "boolean") {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_DISABLED_STATE_INVALID,
      "[userLifecyclePolicy] actor disabled state is invalid",
    );
  }
  if (actorUser.disabled) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ACTIVE,
      "[userLifecyclePolicy] actor is not active",
    );
  }
  if (typeof actorUser.isAdmin !== "boolean") {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_ADMIN_STATE_INVALID,
      "[userLifecyclePolicy] actor admin state is invalid",
    );
  }

  try {
    return Object.freeze({
      isAdmin: actorUser.isAdmin,
      permissions: resolveRolePermissions(actorUser.roles),
    });
  } catch (error) {
    if (error instanceof RolePermissionError) {
      throwPolicyError(
        USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_ROLES_INVALID,
        "[userLifecyclePolicy] actor roles are invalid",
        { cause: error },
      );
    }
    throw error;
  }
}

function assertCompanyAdministrator({ companyId, actorUser }) {
  const actor = resolveActorPermissions({ companyId, actorUser });
  if (!actor.isAdmin) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[userLifecyclePolicy] operation requires a company administrator",
    );
  }
}

/**
 * UWB-07Aのexact inputを検証します。
 */
export function resolveEmployeeRetirementInput(input) {
  assertExactFields(input, RETIREMENT_INPUT_FIELDS);
  return Object.freeze({
    operationId: resolveOperationId(input.operationId),
    employeeId: resolveDocumentId(input.employeeId, "employeeId"),
    terminationDate: resolveDateOnly(input.terminationDate, "terminationDate"),
    reasonOfTermination: resolveReason(
      input.reasonOfTermination,
      "reasonOfTermination",
    ),
  });
}

/**
 * UWB-07Aのactorを検証します。会社管理者またはstrict preset由来の
 * employees:terminateだけを許可し、本人Employeeの退職を拒否します。
 */
export function assertEmployeeRetirementActor({
  companyId,
  actorUser,
  employeeId,
} = {}) {
  resolveDocumentId(companyId, "companyId");
  resolveDocumentId(employeeId, "employeeId");
  const actor = resolveActorPermissions({ companyId, actorUser });

  if (
    !actor.isAdmin &&
    !actor.permissions.includes("employees:terminate")
  ) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[assertEmployeeRetirementActor] actor cannot terminate Employees",
    );
  }

  if (actorUser.employeeId === employeeId) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.SELF_OPERATION_DENIED,
      "[assertEmployeeRetirementActor] actor cannot terminate self Employee",
    );
  }

  if (
    actorUser.employeeId !== undefined &&
    actorUser.employeeId !== null
  ) {
    try {
      resolveDocumentId(actorUser.employeeId, "actorUser.employeeId");
    } catch (error) {
      if (error instanceof UserLifecyclePolicyError) {
        throwPolicyError(
          USER_LIFECYCLE_POLICY_ERROR_CODES.INPUT_INVALID,
          "[assertEmployeeRetirementActor] actor employeeId is invalid",
          { cause: error },
        );
      }
      throw error;
    }
  }
}

/**
 * UWB-07AのEmployee状態と日付範囲を検証します。
 * dateOfHireとserverTodayJstはuse-caseがJSTのYYYY-MM-DDへ正規化して渡します。
 */
export function assertEmployeeRetirementTarget({
  employee,
  terminationDate,
  serverTodayJst,
} = {}) {
  if (!isPlainObject(employee)) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.EMPLOYEE_INVALID,
      "[assertEmployeeRetirementTarget] Employee is invalid",
    );
  }
  if (employee.employmentStatus !== "ACTIVE") {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.EMPLOYEE_STATE_INVALID,
      "[assertEmployeeRetirementTarget] Employee must be active",
    );
  }

  const hireDate = resolveDateOnly(employee.dateOfHire, "dateOfHire");
  const resolvedTerminationDate = resolveDateOnly(
    terminationDate,
    "terminationDate",
  );
  const today = resolveDateOnly(serverTodayJst, "serverTodayJst");

  if (resolvedTerminationDate < hireDate) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TERMINATION_DATE_BEFORE_HIRE,
      "[assertEmployeeRetirementTarget] termination precedes hire",
    );
  }
  if (resolvedTerminationDate > today) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TERMINATION_DATE_IN_FUTURE,
      "[assertEmployeeRetirementTarget] future termination is not allowed",
    );
  }
}

/**
 * UWB-07Bのexact inputを検証します。
 */
export function resolveStandaloneRegisteredUserDeletionInput(input) {
  assertExactFields(input, STANDALONE_USER_DELETION_INPUT_FIELDS);
  return Object.freeze({
    operationId: resolveOperationId(input.operationId),
    targetUserId: resolveDocumentId(input.targetUserId, "targetUserId"),
    reason: resolveReason(input.reason, "reason"),
  });
}

/**
 * UWB-07Bのactorを会社管理者へ限定します。
 */
export function assertStandaloneRegisteredUserDeletionActor({
  companyId,
  actorUser,
} = {}) {
  resolveDocumentId(companyId, "companyId");
  assertCompanyAdministrator({ companyId, actorUser });
}

/**
 * UWB-07Bの対象を同社の単独本登録・非管理者・非super-userへ限定します。
 */
export function assertStandaloneRegisteredUserDeletionTarget({
  companyId,
  actorUid,
  targetUserId,
  targetUser,
  targetAuthIsSuperUser,
} = {}) {
  resolveDocumentId(companyId, "companyId");
  resolveDocumentId(actorUid, "actorUid");
  resolveDocumentId(targetUserId, "targetUserId");
  if (!isPlainObject(targetUser)) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_USER_INVALID,
      "[assertStandaloneRegisteredUserDeletionTarget] target User is invalid",
    );
  }

  assertUserDocumentCompany({ pathCompanyId: companyId, userData: targetUser });

  if (actorUid === targetUserId) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.SELF_OPERATION_DENIED,
      "[assertStandaloneRegisteredUserDeletionTarget] self deletion is denied",
    );
  }
  if (typeof targetUser.disabled !== "boolean") {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_USER_INVALID,
      "[assertStandaloneRegisteredUserDeletionTarget] disabled state is invalid",
    );
  }
  if (typeof targetUser.isAdmin !== "boolean") {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
      "[assertStandaloneRegisteredUserDeletionTarget] admin state is invalid",
    );
  }
  if (targetUser.isAdmin) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_IS_ADMIN,
      "[assertStandaloneRegisteredUserDeletionTarget] admin target is denied",
    );
  }
  if (typeof targetAuthIsSuperUser !== "boolean") {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_SUPER_USER_STATE_INVALID,
      "[assertStandaloneRegisteredUserDeletionTarget] super-user state is invalid",
    );
  }
  if (targetAuthIsSuperUser) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_IS_SUPER_USER,
      "[assertStandaloneRegisteredUserDeletionTarget] super-user target is denied",
    );
  }
  if (targetUser.employeeId !== undefined && targetUser.employeeId !== null) {
    try {
      resolveDocumentId(targetUser.employeeId, "targetUser.employeeId");
    } catch (error) {
      if (error instanceof UserLifecyclePolicyError) {
        throwPolicyError(
          USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_USER_INVALID,
          "[assertStandaloneRegisteredUserDeletionTarget] Employee link is invalid",
          { cause: error },
        );
      }
      throw error;
    }

    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.TARGET_HAS_EMPLOYEE,
      "[assertStandaloneRegisteredUserDeletionTarget] Employee-linked target is denied",
    );
  }
}

/**
 * UWB-07Cのexact inputを検証します。
 */
export function resolveEmployeeReinstatementInput(input) {
  assertExactFields(input, REINSTATEMENT_INPUT_FIELDS);
  if (
    input.correctionReasonCode !==
    EMPLOYEE_REINSTATEMENT_REASON_CODES.MISTAKEN_RETIREMENT
  ) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.CORRECTION_REASON_INVALID,
      "[resolveEmployeeReinstatementInput] correction reason is invalid",
    );
  }

  return Object.freeze({
    operationId: resolveOperationId(input.operationId),
    employeeId: resolveDocumentId(input.employeeId, "employeeId"),
    reversesOperationId: resolveOperationId(
      input.reversesOperationId,
      "reversesOperationId",
    ),
    correctionReasonCode: input.correctionReasonCode,
  });
}

/** UWB-07C UIへ返す最小訂正contextのexact inputを検証します。 */
export function resolveEmployeeReinstatementContextInput(input) {
  assertExactFields(input, REINSTATEMENT_CONTEXT_INPUT_FIELDS);
  return Object.freeze({
    employeeId: resolveDocumentId(input.employeeId, "employeeId"),
  });
}

/**
 * UWB-07履歴一覧readerのexact inputを検証します。
 */
export function resolveLifecycleOperationHistoryInput(input) {
  assertExactFields(input, LIFECYCLE_HISTORY_INPUT_FIELDS);
  if (input.cursor === null) {
    return Object.freeze({ cursor: null });
  }
  return Object.freeze({ cursor: resolveOperationId(input.cursor, "cursor") });
}

/**
 * 履歴一覧を閲覧できる有効な本登録会社管理者かを検証します。
 * roleや直接permissionは会社管理者判定の代替にしません。
 */
export function assertLifecycleOperationHistoryActor({
  companyId,
  actorUser,
} = {}) {
  resolveDocumentId(companyId, "companyId");
  try {
    assertCompanyAdministrator({ companyId, actorUser });
  } catch (error) {
    if (
      error instanceof UserAuthCompanyPolicyError ||
      (error instanceof UserLifecyclePolicyError &&
        error.code === USER_LIFECYCLE_POLICY_ERROR_CODES.INPUT_INVALID)
    ) {
      throwPolicyError(
        USER_LIFECYCLE_POLICY_ERROR_CODES.ACTOR_NOT_ALLOWED,
        "[assertLifecycleOperationHistoryActor] actor is not an active registered company administrator",
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * UWB-07Cのactorを会社管理者へ限定します。
 */
export function assertEmployeeReinstatementActor({
  companyId,
  actorUser,
} = {}) {
  resolveDocumentId(companyId, "companyId");
  assertCompanyAdministrator({ companyId, actorUser });
}

/**
 * UWB-07Cの対象Employeeが退職状態であることを検証します。
 * source operation、head、reservation、lockの検証はoperation use-caseで行います。
 */
export function assertEmployeeReinstatementTarget({ employee } = {}) {
  if (!isPlainObject(employee)) {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.EMPLOYEE_INVALID,
      "[assertEmployeeReinstatementTarget] Employee is invalid",
    );
  }
  if (employee.employmentStatus !== "RESIGNED") {
    throwPolicyError(
      USER_LIFECYCLE_POLICY_ERROR_CODES.EMPLOYEE_STATE_INVALID,
      "[assertEmployeeReinstatementTarget] Employee must be resigned",
    );
  }
}
