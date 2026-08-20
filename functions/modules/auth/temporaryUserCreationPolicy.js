/*****************************************************************************
 * @file ./functions/modules/auth/temporaryUserCreationPolicy.js
 * @description 仮登録User作成入力を検証し、server管理fieldを確定します。
 *****************************************************************************/
import {
  EMPLOYMENT_STATUS_VALUES,
  TAG_SIZE_VALUES,
} from "@shisyamo4131/air-guard-v2-schemas/constants";
import { ROLE_PRESETS } from "../../constants/rolePresets.js";

const EMAIL_MAX_LENGTH = 50;
const DISPLAY_NAME_MAX_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STANDALONE_ALLOWED_FIELDS = new Set([
  "email",
  "displayName",
  "roles",
  "tagSize",
  "receiveConfirmedArrangementNotification",
  "receiveArrivedArrangementNotification",
  "receiveLeavedArrangementNotification",
]);
const EMPLOYEE_LINKED_ALLOWED_FIELDS = new Set([
  "employeeId",
  "email",
  "roles",
]);
const NOTIFICATION_FIELDS = [
  "receiveConfirmedArrangementNotification",
  "receiveArrivedArrangementNotification",
  "receiveLeavedArrangementNotification",
];
const VALID_TAG_SIZES = new Set(
  Object.values(TAG_SIZE_VALUES).map(({ value }) => value),
);

export const TEMPORARY_USER_CREATION_POLICY_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  INPUT_INVALID: "input-invalid",
  UNEXPECTED_FIELD: "unexpected-field",
  IDENTIFIER_INVALID: "identifier-invalid",
  EMAIL_INVALID: "email-invalid",
  DISPLAY_NAME_INVALID: "display-name-invalid",
  ROLES_INVALID: "roles-invalid",
  ROLE_INVALID: "role-invalid",
  ROLE_DUPLICATED: "role-duplicated",
  TAG_SIZE_INVALID: "tag-size-invalid",
  NOTIFICATION_FLAG_INVALID: "notification-flag-invalid",
  EMPLOYEE_INVALID: "employee-invalid",
  EMPLOYEE_NOT_ACTIVE: "employee-not-active",
});

export class TemporaryUserCreationPolicyError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "TemporaryUserCreationPolicyError";
    this.code = code;
  }
}

function throwPolicyError(code, message) {
  throw new TemporaryUserCreationPolicyError(code, message);
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

function assertDocumentId(value, fieldName) {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    value.includes("/")
  ) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.IDENTIFIER_INVALID,
      `[temporaryUserCreationPolicy] ${fieldName} is invalid`,
    );
  }
}

function assertAllowedFields(input, allowedFields) {
  if (!isPlainObject(input)) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.INPUT_INVALID,
      "[temporaryUserCreationPolicy] input must be a plain object",
    );
  }

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      throwPolicyError(
        TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
        `[temporaryUserCreationPolicy] unexpected field: ${field}`,
      );
    }
  }
}

/**
 * emailを予約文書とUser保存で共通使用するcanonical表現へ変換します。
 * @param {unknown} value
 * @returns {string}
 * @throws {TemporaryUserCreationPolicyError}
 */
export function normalizeTemporaryUserEmail(value) {
  if (typeof value !== "string") {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMAIL_INVALID,
      "[normalizeTemporaryUserEmail] email must be a string",
    );
  }

  const email = value.trim().toLowerCase();
  if (
    !email ||
    email.length > EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMAIL_INVALID,
      "[normalizeTemporaryUserEmail] email is invalid",
    );
  }

  return email;
}

function resolveDisplayName(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    value.length > DISPLAY_NAME_MAX_LENGTH
  ) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.DISPLAY_NAME_INVALID,
      "[temporaryUserCreationPolicy] displayName is invalid",
    );
  }

  return value;
}

function resolveRoles(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.ROLES_INVALID,
      "[temporaryUserCreationPolicy] roles must be an array",
    );
  }

  const roles = [];
  const seen = new Set();
  for (const role of value) {
    if (typeof role !== "string" || !ROLE_PRESETS[role]) {
      throwPolicyError(
        TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.ROLE_INVALID,
        "[temporaryUserCreationPolicy] role must be a known preset",
      );
    }
    if (seen.has(role)) {
      throwPolicyError(
        TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.ROLE_DUPLICATED,
        "[temporaryUserCreationPolicy] roles must not contain duplicates",
      );
    }
    seen.add(role);
    roles.push(role);
  }

  return roles;
}

function resolveTagSize(value) {
  const tagSize =
    value === undefined ? TAG_SIZE_VALUES.MEDIUM.value : value;
  if (typeof tagSize !== "string" || !VALID_TAG_SIZES.has(tagSize)) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.TAG_SIZE_INVALID,
      "[temporaryUserCreationPolicy] tagSize is invalid",
    );
  }

  return tagSize;
}

function resolveNotificationFlags(input) {
  return Object.fromEntries(
    NOTIFICATION_FIELDS.map((field) => {
      const value = input[field] === undefined ? false : input[field];
      if (typeof value !== "boolean") {
        throwPolicyError(
          TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.NOTIFICATION_FLAG_INVALID,
          `[temporaryUserCreationPolicy] ${field} must be a boolean`,
        );
      }
      return [field, value];
    }),
  );
}

function resolveServerManagedFields(companyId) {
  assertDocumentId(companyId, "companyId");

  return {
    companyId,
    isTemporary: true,
    isAdmin: false,
    disabled: false,
  };
}

/**
 * 単独仮登録Userの作成dataを確定します。
 * 会社管理者とusers:write保有者はいずれも既知のrole presetを設定できます。
 * @param {Object} param
 * @param {string} param.companyId
 * @param {Object} param.input
 * @returns {Object}
 */
export function resolveStandaloneTemporaryUserData({ companyId, input } = {}) {
  if (companyId === undefined || input === undefined) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[resolveStandaloneTemporaryUserData] required fields are missing",
    );
  }

  assertAllowedFields(input, STANDALONE_ALLOWED_FIELDS);

  return {
    email: normalizeTemporaryUserEmail(input.email),
    displayName: resolveDisplayName(input.displayName),
    roles: resolveRoles(input.roles),
    tagSize: resolveTagSize(input.tagSize),
    ...resolveNotificationFlags(input),
    ...resolveServerManagedFields(companyId),
  };
}

/**
 * Employee連携仮登録Userの作成dataを確定します。
 * displayNameはclient入力ではなく、serverが取得したEmployeeから解決します。
 * rolesは任意の既知presetだけを受け入れ、未指定時は空配列にします。
 * Employeeは在職中（ACTIVE）の場合だけ連携できます。
 * @param {Object} param
 * @param {string} param.companyId
 * @param {Object} param.input
 * @param {string[]} [param.input.roles]
 * @param {Object} param.employee
 * @returns {Object}
 */
export function resolveEmployeeLinkedTemporaryUserData({
  companyId,
  input,
  employee,
} = {}) {
  if (companyId === undefined || input === undefined || employee === undefined) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[resolveEmployeeLinkedTemporaryUserData] required fields are missing",
    );
  }

  assertAllowedFields(input, EMPLOYEE_LINKED_ALLOWED_FIELDS);
  assertDocumentId(input.employeeId, "employeeId");
  if (!isPlainObject(employee)) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMPLOYEE_INVALID,
      "[resolveEmployeeLinkedTemporaryUserData] employee is invalid",
    );
  }
  if (
    typeof employee.employmentStatus !== "string" ||
    !Object.values(EMPLOYMENT_STATUS_VALUES).some(
      ({ value }) => value === employee.employmentStatus,
    )
  ) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMPLOYEE_INVALID,
      "[resolveEmployeeLinkedTemporaryUserData] employmentStatus is invalid",
    );
  }
  if (employee.employmentStatus !== EMPLOYMENT_STATUS_VALUES.ACTIVE.value) {
    throwPolicyError(
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMPLOYEE_NOT_ACTIVE,
      "[resolveEmployeeLinkedTemporaryUserData] employee is not active",
    );
  }

  return {
    email: normalizeTemporaryUserEmail(input.email),
    displayName: resolveDisplayName(employee.displayName),
    employeeId: input.employeeId,
    roles: resolveRoles(input.roles),
    tagSize: TAG_SIZE_VALUES.MEDIUM.value,
    ...Object.fromEntries(NOTIFICATION_FIELDS.map((field) => [field, false])),
    ...resolveServerManagedFields(companyId),
  };
}
