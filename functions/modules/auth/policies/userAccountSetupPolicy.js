/*****************************************************************************
 * @file ./functions/modules/auth/policies/userAccountSetupPolicy.js
 * @description 一般User本登録のidentity・予約・User状態を純粋検証します。
 *****************************************************************************/
import { normalizeTemporaryUserEmail } from "./temporaryUserCreationPolicy.js";

export const USER_ACCOUNT_SETUP_POLICY_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  AUTH_UID_INVALID: "auth-uid-invalid",
  AUTH_EMAIL_INVALID: "auth-email-invalid",
  EMAIL_VERIFIED_STATE_INVALID: "email-verified-state-invalid",
  EMAIL_NOT_VERIFIED: "email-not-verified",
  REGISTRATION_NOT_FOUND: "registration-not-found",
  REGISTRATION_NOT_UNIQUE: "registration-not-unique",
  RESERVATION_STATE_INVALID: "reservation-state-invalid",
  REGISTRATION_STATE_INVALID: "registration-state-invalid",
  REGISTRATION_COMPANY_MISMATCH: "registration-company-mismatch",
  REGISTRATION_EMAIL_MISMATCH: "registration-email-mismatch",
  REGISTRATION_NOT_TEMPORARY: "registration-not-temporary",
});

export class UserAccountSetupPolicyError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "UserAccountSetupPolicyError";
    this.code = code;
  }
}

function throwPolicyError(code, message, options) {
  throw new UserAccountSetupPolicyError(code, message, options);
}

function isSafeDocumentId(value) {
  return (
    typeof value === "string" &&
    Boolean(value) &&
    value.trim() === value &&
    !value.includes("/")
  );
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

/** Firestore read前にAuthentication identityを検証します。 */
export function resolveUserAccountSetupIdentity({
  authUid,
  authEmail,
  authEmailVerified,
} = {}) {
  if (!isSafeDocumentId(authUid)) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.AUTH_UID_INVALID,
      "[resolveUserAccountSetupIdentity] Auth UID is invalid",
    );
  }
  if (typeof authEmailVerified !== "boolean") {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_VERIFIED_STATE_INVALID,
      "[resolveUserAccountSetupIdentity] Email verified state is invalid",
    );
  }
  if (authEmailVerified !== true) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_NOT_VERIFIED,
      "[resolveUserAccountSetupIdentity] Email is not verified",
    );
  }

  let email;
  try {
    email = normalizeTemporaryUserEmail(authEmail);
  } catch (error) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.AUTH_EMAIL_INVALID,
      "[resolveUserAccountSetupIdentity] Auth email is invalid",
      { cause: error },
    );
  }

  return Object.freeze({ authUid, email });
}

/** root email予約のbodyを検証してsafe pointerを返します。 */
export function resolveUserAccountSetupReservation({
  identity,
  reservation,
} = {}) {
  if (!identity || typeof identity !== "object") {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[resolveUserAccountSetupReservation] Identity is missing",
    );
  }
  if (
    !isPlainObject(reservation) ||
    Object.keys(reservation).sort().join("\0") !== "companyId\0userId" ||
    !isSafeDocumentId(reservation.companyId) ||
    !isSafeDocumentId(reservation.userId)
  ) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.RESERVATION_STATE_INVALID,
      "[resolveUserAccountSetupReservation] Reservation is invalid",
    );
  }

  return Object.freeze({
    companyId: reservation.companyId,
    userId: reservation.userId,
  });
}

/** 予約pointer先Userを本登録候補または安全な再試行状態として検証します。 */
export function resolveUserAccountSetupRegistration({
  identity,
  reservation,
  user,
} = {}) {
  if (!identity || !reservation || !isPlainObject(user)) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID,
      "[resolveUserAccountSetupRegistration] Registration is invalid",
    );
  }
  if (
    typeof user.companyId !== "string" ||
    typeof user.email !== "string" ||
    typeof user.isTemporary !== "boolean" ||
    user.isAdmin !== false ||
    user.disabled !== false
  ) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID,
      "[resolveUserAccountSetupRegistration] User state is invalid",
    );
  }
  if (user.companyId !== reservation.companyId) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_COMPANY_MISMATCH,
      "[resolveUserAccountSetupRegistration] Company does not match reservation",
    );
  }

  let userEmail;
  try {
    userEmail = normalizeTemporaryUserEmail(user.email);
  } catch (error) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID,
      "[resolveUserAccountSetupRegistration] User email is invalid",
      { cause: error },
    );
  }
  if (userEmail !== identity.email || user.email !== userEmail) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_EMAIL_MISMATCH,
      "[resolveUserAccountSetupRegistration] Email does not match identity",
    );
  }

  const employeeId =
    user.employeeId === undefined ||
    user.employeeId === null
      ? null
      : user.employeeId;
  if (employeeId !== null && !isSafeDocumentId(employeeId)) {
    throwPolicyError(
      USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID,
      "[resolveUserAccountSetupRegistration] Employee ID is invalid",
    );
  }

  if (user.isTemporary === true) {
    return Object.freeze({ mode: "temporary", employeeId });
  }
  if (reservation.userId === identity.authUid) {
    return Object.freeze({ mode: "registered-retry", employeeId });
  }

  throwPolicyError(
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_TEMPORARY,
    "[resolveUserAccountSetupRegistration] User is not temporary",
  );
}
