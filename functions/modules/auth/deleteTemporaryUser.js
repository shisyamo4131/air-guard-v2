/*****************************************************************************
 * @file ./functions/modules/auth/deleteTemporaryUser.js
 * @description 検証済みの実行者が同じ会社の仮登録Userを削除します。
 * @method deleteTemporaryUser
 *****************************************************************************/
import { assertTemporaryUserCanBeDeleted } from "./policies/temporaryUserDeletionPolicy.js";
import { assertActorCanManageTemporaryUsers } from "./policies/temporaryUserManagementPolicy.js";
import { createUserEmailReservationId } from "./createTemporaryUser.js";
import { TemporaryUserCreationPolicyError } from "./policies/temporaryUserCreationPolicy.js";

export const DELETE_TEMPORARY_USER_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  IDENTIFIER_INVALID: "identifier-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  ACTOR_USER_NOT_FOUND: "actor-user-not-found",
  TARGET_USER_NOT_FOUND: "target-user-not-found",
  TARGET_EMAIL_INVALID: "target-email-invalid",
  EMAIL_RESERVATION_NOT_FOUND: "email-reservation-not-found",
  EMAIL_RESERVATION_INVALID: "email-reservation-invalid",
  EMAIL_RESERVATION_MISMATCH: "email-reservation-mismatch",
  EMPLOYEE_RESERVATION_NOT_FOUND: "employee-reservation-not-found",
  EMPLOYEE_RESERVATION_INVALID: "employee-reservation-invalid",
  EMPLOYEE_RESERVATION_MISMATCH: "employee-reservation-mismatch",
});

export class DeleteTemporaryUserError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "DeleteTemporaryUserError";
    this.code = code;
  }
}

function isValidDocumentId(value) {
  return value.trim() === value && !value.includes("/");
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

function assertReservation({
  snapshot,
  expected,
  notFoundCode,
  invalidCode,
  mismatchCode,
  label,
}) {
  if (!snapshot.exists) {
    throw new DeleteTemporaryUserError(
      notFoundCode,
      `[deleteTemporaryUser] ${label} reservation was not found`,
    );
  }

  const data = snapshot.data();
  const expectedKeys = Object.keys(expected).sort();
  if (
    !isPlainObject(data) ||
    Object.keys(data).sort().join("\0") !== expectedKeys.join("\0") ||
    expectedKeys.some(
      (key) => typeof data[key] !== "string" || !data[key],
    )
  ) {
    throw new DeleteTemporaryUserError(
      invalidCode,
      `[deleteTemporaryUser] ${label} reservation is invalid`,
    );
  }

  if (expectedKeys.some((key) => data[key] !== expected[key])) {
    throw new DeleteTemporaryUserError(
      mismatchCode,
      `[deleteTemporaryUser] ${label} reservation does not match target`,
    );
  }
}

/**
 * 同じ会社の仮登録Userドキュメントだけをtransaction内で削除します。
 * @param {Object} param
 * @param {Object} param.firestore
 * @param {string} param.companyId
 * @param {string} param.actorUid
 * @param {string} param.targetUserId
 * @returns {Promise<{
 *   success: boolean,
 *   userId: string,
 *   linkType: "standalone" | "employee-linked",
 *   employeeId: string | null,
 * }>}
 * @throws {DeleteTemporaryUserError}
 * @throws {TemporaryUserManagementPolicyError}
 * @throws {TemporaryUserDeletionPolicyError}
 */
export async function deleteTemporaryUser({
  firestore,
  companyId,
  actorUid,
  targetUserId,
} = {}) {
  if (
    typeof companyId !== "string" ||
    !companyId ||
    typeof actorUid !== "string" ||
    !actorUid ||
    typeof targetUserId !== "string" ||
    !targetUserId
  ) {
    throw new DeleteTemporaryUserError(
      DELETE_TEMPORARY_USER_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[deleteTemporaryUser] Required fields are missing",
    );
  }

  if (
    !isValidDocumentId(companyId) ||
    !isValidDocumentId(actorUid) ||
    !isValidDocumentId(targetUserId)
  ) {
    throw new DeleteTemporaryUserError(
      DELETE_TEMPORARY_USER_ERROR_CODES.IDENTIFIER_INVALID,
      "[deleteTemporaryUser] Document identifier is invalid",
    );
  }

  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throw new DeleteTemporaryUserError(
      DELETE_TEMPORARY_USER_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[deleteTemporaryUser] Firestore service is invalid",
    );
  }

  const actorUserRef = firestore.doc(
    `Companies/${companyId}/Users/${actorUid}`,
  );
  const targetUserRef = firestore.doc(
    `Companies/${companyId}/Users/${targetUserId}`,
  );

  return firestore.runTransaction(async (transaction) => {
    const actorSnapshot = await transaction.get(actorUserRef);
    if (!actorSnapshot.exists) {
      throw new DeleteTemporaryUserError(
        DELETE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND,
        "[deleteTemporaryUser] Actor User was not found",
      );
    }

    const actorUser = actorSnapshot.data();
    assertActorCanManageTemporaryUsers({ companyId, actorUser });

    const targetSnapshot = await transaction.get(targetUserRef);
    if (!targetSnapshot.exists) {
      throw new DeleteTemporaryUserError(
        DELETE_TEMPORARY_USER_ERROR_CODES.TARGET_USER_NOT_FOUND,
        "[deleteTemporaryUser] Target User was not found",
      );
    }

    const targetUser = targetSnapshot.data();

    assertTemporaryUserCanBeDeleted({ companyId, targetUser });

    let emailReservationId;
    try {
      emailReservationId = createUserEmailReservationId(targetUser.email);
    } catch (error) {
      if (error instanceof TemporaryUserCreationPolicyError) {
        throw new DeleteTemporaryUserError(
          DELETE_TEMPORARY_USER_ERROR_CODES.TARGET_EMAIL_INVALID,
          "[deleteTemporaryUser] Target email is invalid",
          { cause: error },
        );
      }
      throw error;
    }

    const emailReservationRef = firestore.doc(
      `UserEmailReservations/${emailReservationId}`,
    );
    const emailReservationSnapshot = await transaction.get(
      emailReservationRef,
    );
    assertReservation({
      snapshot: emailReservationSnapshot,
      expected: { companyId, userId: targetUserId },
      notFoundCode:
        DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_NOT_FOUND,
      invalidCode:
        DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_INVALID,
      mismatchCode:
        DELETE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_MISMATCH,
      label: "Email",
    });

    const employeeId = targetUser.employeeId || null;
    let employeeReservationRef = null;
    if (employeeId) {
      employeeReservationRef = firestore.doc(
        `Companies/${companyId}/EmployeeUserReservations/${employeeId}`,
      );
      const employeeReservationSnapshot = await transaction.get(
        employeeReservationRef,
      );
      assertReservation({
        snapshot: employeeReservationSnapshot,
        expected: { userId: targetUserId },
        notFoundCode:
          DELETE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_NOT_FOUND,
        invalidCode:
          DELETE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_INVALID,
        mismatchCode:
          DELETE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_MISMATCH,
        label: "Employee",
      });
    }

    transaction.delete(targetUserRef);
    transaction.delete(emailReservationRef);
    if (employeeReservationRef) transaction.delete(employeeReservationRef);

    return {
      success: true,
      userId: targetUserId,
      linkType: employeeId ? "employee-linked" : "standalone",
      employeeId,
    };
  });
}
