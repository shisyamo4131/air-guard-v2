/*****************************************************************************
 * @file ./functions/modules/auth/checkEmailAvailability.js
 * @description 初期管理者signup用emailの助言的な利用可否を確認します。
 *****************************************************************************/
import { createUserEmailReservationId } from "./createTemporaryUser.js";
import { normalizeTemporaryUserEmail } from "./policies/temporaryUserCreationPolicy.js";

export const CHECK_EMAIL_AVAILABILITY_ERROR_CODES = Object.freeze({
  INPUT_INVALID: "input-invalid",
  AUTH_SERVICE_INVALID: "auth-service-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  EMAIL_EXISTS: "email-exists",
});

export class CheckEmailAvailabilityError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "CheckEmailAvailabilityError";
    this.code = code;
  }
}

export function resolveCheckEmailAvailabilityEmail(email) {
  try {
    return normalizeTemporaryUserEmail(email);
  } catch (error) {
    throw new CheckEmailAvailabilityError(
      CHECK_EMAIL_AVAILABILITY_ERROR_CODES.INPUT_INVALID,
      "[checkEmailAvailability] Email is invalid",
      { cause: error },
    );
  }
}

export async function checkEmailAvailability({ auth, firestore, email } = {}) {
  const normalizedEmail = resolveCheckEmailAvailabilityEmail(email);
  if (!auth || typeof auth.getUserByEmail !== "function") {
    throw new CheckEmailAvailabilityError(
      CHECK_EMAIL_AVAILABILITY_ERROR_CODES.AUTH_SERVICE_INVALID,
      "[checkEmailAvailability] Auth service is invalid",
    );
  }
  if (!firestore || typeof firestore.doc !== "function") {
    throw new CheckEmailAvailabilityError(
      CHECK_EMAIL_AVAILABILITY_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[checkEmailAvailability] Firestore service is invalid",
    );
  }

  try {
    await auth.getUserByEmail(normalizedEmail);
    throw new CheckEmailAvailabilityError(
      CHECK_EMAIL_AVAILABILITY_ERROR_CODES.EMAIL_EXISTS,
      "[checkEmailAvailability] Email already exists in Auth",
    );
  } catch (error) {
    if (error instanceof CheckEmailAvailabilityError) throw error;
    const code = error?.code ?? error?.errorInfo?.code;
    if (code === "auth/invalid-email") {
      throw new CheckEmailAvailabilityError(
        CHECK_EMAIL_AVAILABILITY_ERROR_CODES.INPUT_INVALID,
        "[checkEmailAvailability] Auth rejected the email format",
        { cause: error },
      );
    }
    if (code !== "auth/user-not-found") throw error;
  }

  const reservationRef = firestore.doc(
    `UserEmailReservations/${createUserEmailReservationId(normalizedEmail)}`,
  );
  const reservationSnapshot = await reservationRef.get();
  if (reservationSnapshot.exists) {
    throw new CheckEmailAvailabilityError(
      CHECK_EMAIL_AVAILABILITY_ERROR_CODES.EMAIL_EXISTS,
      "[checkEmailAvailability] Email reservation exists",
    );
  }
  return { available: true };
}
