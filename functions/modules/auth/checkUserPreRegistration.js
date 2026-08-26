/*****************************************************************************
 * @file ./functions/modules/auth/checkUserPreRegistration.js
 * @description email予約pointerから一般Userの事前登録状態を確認します。
 *****************************************************************************/
import { createUserEmailReservationId } from "./createTemporaryUser.js";
import { normalizeTemporaryUserEmail } from "./policies/temporaryUserCreationPolicy.js";

export const CHECK_USER_PRE_REGISTRATION_ERROR_CODES = Object.freeze({
  INPUT_INVALID: "input-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
});

export class CheckUserPreRegistrationError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "CheckUserPreRegistrationError";
    this.code = code;
  }
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

function resolveReservationPointer(value) {
  if (
    !isPlainObject(value) ||
    Object.keys(value).sort().join("\0") !== "companyId\0userId" ||
    !isSafeDocumentId(value.companyId) ||
    !isSafeDocumentId(value.userId)
  ) {
    return null;
  }
  return value;
}

function resolveEligibleUser(value, { companyId, email }) {
  if (
    !isPlainObject(value) ||
    value.companyId !== companyId ||
    value.email !== email ||
    value.isTemporary !== true ||
    value.isAdmin !== false ||
    value.disabled !== false
  ) {
    return null;
  }

  if (value.employeeId === undefined || value.employeeId === null) {
    return Object.freeze({ employeeId: null });
  }
  if (!isSafeDocumentId(value.employeeId)) return null;
  return Object.freeze({ employeeId: value.employeeId });
}

function employeeReservationMatches(value, userId) {
  return Boolean(
    isPlainObject(value) &&
      Object.keys(value).sort().join("\0") === "userId" &&
      isSafeDocumentId(value.userId) &&
      value.userId === userId,
  );
}

/** Firestoreへ接続する前に匿名入力を検証・正規化します。 */
export function resolveCheckUserPreRegistrationEmail(email) {
  try {
    return normalizeTemporaryUserEmail(email);
  } catch (error) {
    throw new CheckUserPreRegistrationError(
      CHECK_USER_PRE_REGISTRATION_ERROR_CODES.INPUT_INVALID,
      "[checkUserPreRegistration] Email is invalid",
      { cause: error },
    );
  }
}

/**
 * 匿名利用者へ詳細を返さず、正規の予約lifecycleにある仮Userだけを確認します。
 * @param {Object} param
 * @param {Object} param.firestore - Firestore service
 * @param {string} param.email - 確認対象email
 * @returns {Promise<{isPreRegistered: boolean}>}
 */
export async function checkUserPreRegistration({ firestore, email } = {}) {
  const normalizedEmail = resolveCheckUserPreRegistrationEmail(email);

  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throw new CheckUserPreRegistrationError(
      CHECK_USER_PRE_REGISTRATION_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[checkUserPreRegistration] Firestore service is invalid",
    );
  }

  const emailReservationRef = firestore.doc(
    `UserEmailReservations/${createUserEmailReservationId(normalizedEmail)}`,
  );

  const isPreRegistered = await firestore.runTransaction(
    async (transaction) => {
      const reservationSnapshot = await transaction.get(emailReservationRef);
      if (!reservationSnapshot.exists) return false;

      const pointer = resolveReservationPointer(reservationSnapshot.data());
      if (!pointer) return false;

      const userRef = firestore.doc(
        `Companies/${pointer.companyId}/Users/${pointer.userId}`,
      );
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) return false;

      const user = resolveEligibleUser(userSnapshot.data(), {
        companyId: pointer.companyId,
        email: normalizedEmail,
      });
      if (!user) return false;
      if (!user.employeeId) return true;

      const employeeReservationRef = firestore.doc(
        `Companies/${pointer.companyId}/EmployeeUserReservations/${user.employeeId}`,
      );
      const employeeReservationSnapshot = await transaction.get(
        employeeReservationRef,
      );
      return (
        employeeReservationSnapshot.exists &&
        employeeReservationMatches(
          employeeReservationSnapshot.data(),
          pointer.userId,
        )
      );
    },
  );

  return { isPreRegistered };
}
