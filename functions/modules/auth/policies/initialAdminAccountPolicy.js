/*****************************************************************************
 * @file ./functions/modules/auth/policies/initialAdminAccountPolicy.js
 * @description 初期会社管理者の入力・Auth identity・既存状態を純粋検証します。
 *****************************************************************************/
import { normalizeTemporaryUserEmail } from "./temporaryUserCreationPolicy.js";

const INPUT_FIELDS = Object.freeze([
  "companyName",
  "companyNameKana",
  "displayName",
]);
const LENGTHS = Object.freeze({
  companyName: 20,
  companyNameKana: 40,
  displayName: 6,
});

export const INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES = Object.freeze({
  INPUT_INVALID: "input-invalid",
  AUTH_IDENTITY_INVALID: "auth-identity-invalid",
  RESERVATION_INVALID: "reservation-invalid",
  RESERVATION_CONFLICT: "reservation-conflict",
  EXISTING_STATE_INVALID: "existing-state-invalid",
});

export class InitialAdminAccountPolicyError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "InitialAdminAccountPolicyError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new InitialAdminAccountPolicyError(code, message, options);
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

function isSafeDocumentId(value) {
  return (
    typeof value === "string" &&
    Boolean(value) &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function optionalSafeCompanyId(value) {
  return value === undefined || isSafeDocumentId(value);
}

function isValidRequiredString(value, maxLength) {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    value === value.trim() &&
    value.length <= maxLength
  );
}

export function resolveInitialAdminAccountInput(input) {
  if (
    !isPlainObject(input) ||
    Object.keys(input).sort().join("\0") !== [...INPUT_FIELDS].sort().join("\0")
  ) {
    fail(
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.INPUT_INVALID,
      "[initialAdminAccountPolicy] Input shape is invalid",
    );
  }
  const result = {};
  for (const field of INPUT_FIELDS) {
    const value = input[field];
    if (!isValidRequiredString(value, LENGTHS[field])) {
      fail(
        INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.INPUT_INVALID,
        "[initialAdminAccountPolicy] Input field is invalid",
      );
    }
    result[field] = value;
  }
  return Object.freeze(result);
}

export function resolveInitialAdminAuthIdentity({
  tokenUid,
  tokenEmail,
  tokenEmailVerified,
  tokenCompanyId,
  tokenIsSuperUser,
  authUser,
} = {}) {
  const claims = authUser?.customClaims ?? {};
  const currentCompanyId = claims.companyId;
  const currentIsSuperUser = claims.isSuperUser;
  let email;
  let currentEmail;
  try {
    email = normalizeTemporaryUserEmail(tokenEmail);
    currentEmail = normalizeTemporaryUserEmail(authUser?.email);
  } catch (error) {
    fail(
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.AUTH_IDENTITY_INVALID,
      "[initialAdminAccountPolicy] Auth email is invalid",
      { cause: error },
    );
  }

  if (
    !isSafeDocumentId(tokenUid) ||
    !authUser ||
    typeof authUser !== "object" ||
    Array.isArray(authUser) ||
    authUser.uid !== tokenUid ||
    tokenEmailVerified !== true ||
    authUser.emailVerified !== true ||
    authUser.disabled !== false ||
    currentEmail !== email ||
    !isPlainObject(claims) ||
    !optionalSafeCompanyId(tokenCompanyId) ||
    !optionalSafeCompanyId(currentCompanyId) ||
    (tokenCompanyId !== undefined && tokenCompanyId !== currentCompanyId) ||
    (tokenIsSuperUser !== undefined && typeof tokenIsSuperUser !== "boolean") ||
    (currentIsSuperUser !== undefined && typeof currentIsSuperUser !== "boolean") ||
    (tokenIsSuperUser !== undefined && tokenIsSuperUser !== currentIsSuperUser)
  ) {
    fail(
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.AUTH_IDENTITY_INVALID,
      "[initialAdminAccountPolicy] Auth identity is invalid",
    );
  }

  return Object.freeze({
    uid: tokenUid,
    email,
    tokenCompanyId,
    currentCompanyId,
    isSuperUser: currentIsSuperUser === true,
    currentClaims: Object.freeze({ ...claims }),
  });
}

export function resolveInitialAdminReservation({ reservation, uid } = {}) {
  if (
    !isPlainObject(reservation) ||
    Object.keys(reservation).sort().join("\0") !== "companyId\0userId" ||
    !isSafeDocumentId(reservation.companyId) ||
    !isSafeDocumentId(reservation.userId)
  ) {
    fail(
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.RESERVATION_INVALID,
      "[initialAdminAccountPolicy] Reservation is invalid",
    );
  }
  if (reservation.userId !== uid) {
    fail(
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.RESERVATION_CONFLICT,
      "[initialAdminAccountPolicy] Reservation belongs to another User",
    );
  }
  return Object.freeze({ ...reservation });
}

export function assertInitialAdminRetryState({
  identity,
  reservation,
  user,
  company,
} = {}) {
  if (
    !identity ||
    !isPlainObject(reservation) ||
    Object.keys(reservation).sort().join("\0") !== "companyId\0userId" ||
    !isSafeDocumentId(reservation.companyId) ||
    !isSafeDocumentId(reservation.userId) ||
    reservation.userId !== identity.uid ||
    !isPlainObject(user) ||
    !isPlainObject(company) ||
    user.companyId !== reservation.companyId ||
    user.email !== identity.email ||
    user.isAdmin !== true ||
    user.isTemporary !== false ||
    user.disabled !== false ||
    !isValidRequiredString(company.companyName, LENGTHS.companyName) ||
    !isValidRequiredString(company.companyNameKana, LENGTHS.companyNameKana) ||
    (identity.tokenCompanyId !== undefined &&
      identity.tokenCompanyId !== reservation.companyId) ||
    (identity.currentCompanyId !== undefined &&
      identity.currentCompanyId !== reservation.companyId)
  ) {
    fail(
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.EXISTING_STATE_INVALID,
      "[initialAdminAccountPolicy] Existing administrator state is invalid",
    );
  }
}

export const INITIAL_ADMIN_ACCOUNT_POLICY_LENGTHS = LENGTHS;
