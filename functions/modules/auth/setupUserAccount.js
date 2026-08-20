/*****************************************************************************
 * @file ./functions/modules/auth/setupUserAccount.js
 * @description email予約pointerから一般Userを本登録します。
 *****************************************************************************/
import { User } from "@shisyamo4131/air-guard-v2-schemas";
import { createUserEmailReservationId } from "./createTemporaryUser.js";
import {
  resolveUserAccountSetupIdentity,
  resolveUserAccountSetupRegistration,
  resolveUserAccountSetupReservation,
} from "./userAccountSetupPolicy.js";

export const USER_ACCOUNT_SETUP_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  AUTH_SERVICE_INVALID: "auth-service-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  EMAIL_RESERVATION_NOT_FOUND: "email-reservation-not-found",
  TARGET_USER_NOT_FOUND: "target-user-not-found",
  TARGET_USER_ALREADY_EXISTS: "target-user-already-exists",
  EMPLOYEE_RESERVATION_NOT_FOUND: "employee-reservation-not-found",
  EMPLOYEE_RESERVATION_INVALID: "employee-reservation-invalid",
  EMPLOYEE_RESERVATION_MISMATCH: "employee-reservation-mismatch",
});

export class UserAccountSetupError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "UserAccountSetupError";
    this.code = code;
  }
}

function throwSetupError(code, message, options) {
  throw new UserAccountSetupError(code, message, options);
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

function assertEmployeeReservation(snapshot, expectedUserId) {
  if (!snapshot.exists) {
    throwSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_NOT_FOUND,
      "[setupUserAccount] Employee reservation was not found",
    );
  }
  const data = snapshot.data();
  if (
    !isPlainObject(data) ||
    Object.keys(data).sort().join("\0") !== "userId" ||
    !isSafeDocumentId(data.userId)
  ) {
    throwSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_INVALID,
      "[setupUserAccount] Employee reservation is invalid",
    );
  }
  if (data.userId !== expectedUserId) {
    throwSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.EMPLOYEE_RESERVATION_MISMATCH,
      "[setupUserAccount] Employee reservation does not match User",
    );
  }
}

/**
 * Authenticationの確認済みemailに対応する予約pointerから一般Userを本登録します。
 */
export async function setupUserAccount({
  auth,
  firestore,
  authUid,
  authEmail,
  authEmailVerified,
} = {}) {
  const identity = resolveUserAccountSetupIdentity({
    authUid,
    authEmail,
    authEmailVerified,
  });

  if (!auth || typeof auth.setCustomUserClaims !== "function") {
    throwSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.AUTH_SERVICE_INVALID,
      "[setupUserAccount] Auth service must provide setCustomUserClaims",
    );
  }
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throwSetupError(
      USER_ACCOUNT_SETUP_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[setupUserAccount] Firestore service is invalid",
    );
  }

  const emailReservationRef = firestore.doc(
    `UserEmailReservations/${createUserEmailReservationId(identity.email)}`,
  );

  const registration = await firestore.runTransaction(async (transaction) => {
    const reservationSnapshot = await transaction.get(emailReservationRef);
    if (!reservationSnapshot.exists) {
      throwSetupError(
        USER_ACCOUNT_SETUP_ERROR_CODES.EMAIL_RESERVATION_NOT_FOUND,
        "[setupUserAccount] Email reservation was not found",
      );
    }
    const reservation = resolveUserAccountSetupReservation({
      identity,
      reservation: reservationSnapshot.data(),
    });

    const sourceUserRef = firestore.doc(
      `Companies/${reservation.companyId}/Users/${reservation.userId}`,
    );
    const sourceUserSnapshot = await transaction.get(sourceUserRef);
    if (!sourceUserSnapshot.exists) {
      throwSetupError(
        USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_NOT_FOUND,
        "[setupUserAccount] Reserved User was not found",
      );
    }
    const sourceUserData = sourceUserSnapshot.data();
    const state = resolveUserAccountSetupRegistration({
      identity,
      reservation,
      user: sourceUserData,
    });

    const targetUserRef = firestore.doc(
      `Companies/${reservation.companyId}/Users/${identity.authUid}`,
    );
    if (
      state.mode === "temporary" &&
      reservation.userId !== identity.authUid
    ) {
      const targetUserSnapshot = await transaction.get(targetUserRef);
      if (targetUserSnapshot.exists) {
        throwSetupError(
          USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_ALREADY_EXISTS,
          "[setupUserAccount] Registered User already exists",
        );
      }
    }

    let employeeReservationRef = null;
    if (state.employeeId) {
      employeeReservationRef = firestore.doc(
        `Companies/${reservation.companyId}/EmployeeUserReservations/${state.employeeId}`,
      );
      const employeeReservationSnapshot = await transaction.get(
        employeeReservationRef,
      );
      assertEmployeeReservation(
        employeeReservationSnapshot,
        reservation.userId,
      );
    }

    if (state.mode === "temporary") {
      const temporaryUser = new User({
        ...sourceUserData,
        docId: reservation.userId,
      });
      const registeredUser = new User({
        ...temporaryUser.toObject(),
        docId: identity.authUid,
        isTemporary: false,
      });
      const prefix = `Companies/${reservation.companyId}`;

      if (reservation.userId === identity.authUid) {
        await registeredUser.update({ transaction, prefix });
      } else {
        await registeredUser.create({
          docId: identity.authUid,
          transaction,
          prefix,
        });
        await temporaryUser.delete({ transaction, prefix });
        transaction.update(emailReservationRef, {
          userId: identity.authUid,
        });
        if (employeeReservationRef) {
          transaction.update(employeeReservationRef, {
            userId: identity.authUid,
          });
        }
      }
    }

    return {
      companyId: reservation.companyId,
      employeeId: state.employeeId,
      mode: state.mode,
    };
  });

  await auth.setCustomUserClaims(identity.authUid, {
    companyId: registration.companyId,
    isSuperUser: false,
  });

  return {
    success: true,
    companyId: registration.companyId,
    userId: identity.authUid,
  };
}
