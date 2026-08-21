/*****************************************************************************
 * @file ./functions/modules/auth/createTemporaryUser.js
 * @description 仮登録Userと一意性予約文書を同じtransactionで作成します。
 *****************************************************************************/
import { createHash } from "node:crypto";
import { User } from "@shisyamo4131/air-guard-v2-schemas";
import {
  resolveEmployeeLinkedTemporaryUserData,
  resolveEmployeeLinkedTemporaryUserInput,
  resolveStandaloneTemporaryUserData,
  normalizeTemporaryUserEmail,
} from "./temporaryUserCreationPolicy.js";
import { assertActorCanManageTemporaryUsers } from "./temporaryUserManagementPolicy.js";

export const CREATE_TEMPORARY_USER_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  IDENTIFIER_INVALID: "identifier-invalid",
  AUTH_SERVICE_INVALID: "auth-service-invalid",
  AUTH_EMAIL_INVALID: "auth-email-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  ACTOR_USER_NOT_FOUND: "actor-user-not-found",
  AUTH_EMAIL_ALREADY_EXISTS: "auth-email-already-exists",
  EMAIL_RESERVATION_EXISTS: "email-reservation-exists",
  EMAIL_USER_EXISTS: "email-user-exists",
  EMPLOYEE_NOT_FOUND: "employee-not-found",
  EMPLOYEE_RESERVATION_EXISTS: "employee-reservation-exists",
  EMPLOYEE_USER_EXISTS: "employee-user-exists",
});

export class CreateTemporaryUserError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "CreateTemporaryUserError";
    this.code = code;
  }
}

function throwCreateError(code, message, options) {
  throw new CreateTemporaryUserError(code, message, options);
}

function assertRequiredIdentity({ companyId, actorUid, input }) {
  if (
    typeof companyId !== "string" ||
    !companyId ||
    typeof actorUid !== "string" ||
    !actorUid ||
    input === undefined
  ) {
    throwCreateError(
      CREATE_TEMPORARY_USER_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[createTemporaryUser] Required fields are missing",
    );
  }

  for (const [field, value] of Object.entries({ companyId, actorUid })) {
    if (value.trim() !== value || value.includes("/")) {
      throwCreateError(
        CREATE_TEMPORARY_USER_ERROR_CODES.IDENTIFIER_INVALID,
        `[createTemporaryUser] ${field} is invalid`,
      );
    }
  }
}

function assertServices({ auth, firestore }) {
  if (!auth || typeof auth.getUserByEmail !== "function") {
    throwCreateError(
      CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_SERVICE_INVALID,
      "[createTemporaryUser] Auth service is invalid",
    );
  }

  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.collection !== "function" ||
    typeof firestore.collectionGroup !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throwCreateError(
      CREATE_TEMPORARY_USER_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[createTemporaryUser] Firestore service is invalid",
    );
  }
}

function snapshotHasDocuments(snapshot) {
  if (snapshot?.empty === true) return false;
  if (snapshot?.empty === false) return true;
  return Array.isArray(snapshot?.docs) && snapshot.docs.length > 0;
}

function isAuthUserNotFound(error) {
  return (
    error?.code === "auth/user-not-found" ||
    error?.errorInfo?.code === "auth/user-not-found"
  );
}

function isAuthEmailInvalid(error) {
  return (
    error?.code === "auth/invalid-email" ||
    error?.errorInfo?.code === "auth/invalid-email"
  );
}

async function assertAuthEmailAvailable(auth, email) {
  try {
    await auth.getUserByEmail(email);
  } catch (error) {
    if (isAuthUserNotFound(error)) return;
    if (isAuthEmailInvalid(error)) {
      throwCreateError(
        CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_EMAIL_INVALID,
        "[createTemporaryUser] Authentication rejected the email format",
        { cause: error },
      );
    }
    throw error;
  }

  throwCreateError(
    CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS,
    "[createTemporaryUser] Authentication email already exists",
  );
}

async function readActorUser(reference) {
  if (!reference || typeof reference.get !== "function") {
    throwCreateError(
      CREATE_TEMPORARY_USER_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[createTemporaryUser] Actor reference is invalid",
    );
  }

  const snapshot = await reference.get();
  if (!snapshot.exists) {
    throwCreateError(
      CREATE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND,
      "[createTemporaryUser] Actor User was not found",
    );
  }

  return snapshot.data();
}

async function readTransactionActor(transaction, reference) {
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists) {
    throwCreateError(
      CREATE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND,
      "[createTemporaryUser] Actor User was not found in transaction",
    );
  }

  return snapshot.data();
}

/**
 * emailをcanonical化し、予約文書IDを生成します。
 * @param {string} email
 * @returns {string}
 */
export function createUserEmailReservationId(email) {
  const normalizedEmail = normalizeTemporaryUserEmail(email);
  return createHash("sha256").update(normalizedEmail, "utf8").digest("hex");
}

async function createTemporaryUser({
  auth,
  firestore,
  companyId,
  actorUid,
  input,
  linkType,
}) {
  assertRequiredIdentity({ companyId, actorUid, input });
  assertServices({ auth, firestore });

  const standalone = linkType === "standalone";
  const resolvedInput = standalone
    ? resolveStandaloneTemporaryUserData({ companyId, input })
    : resolveEmployeeLinkedTemporaryUserInput(input);
  const normalizedEmail = resolvedInput.email;
  const employeeId = standalone ? null : resolvedInput.employeeId;

  const actorRef = firestore.doc(`Companies/${companyId}/Users/${actorUid}`);
  const preflightActor = await readActorUser(actorRef);
  assertActorCanManageTemporaryUsers({
    companyId,
    actorUser: preflightActor,
    requestedRoles: resolvedInput.roles,
  });

  await assertAuthEmailAvailable(auth, normalizedEmail);

  const usersCollectionPath = `Companies/${companyId}/Users`;
  const newUserRef = firestore.collection(usersCollectionPath).doc();
  const emailReservationRef = firestore.doc(
    `UserEmailReservations/${createUserEmailReservationId(normalizedEmail)}`,
  );
  const emailUsersQuery = firestore
    .collectionGroup("Users")
    .where("email", "==", normalizedEmail)
    .limit(2);
  const employeeRef = employeeId
    ? firestore.doc(`Companies/${companyId}/Employees/${employeeId}`)
    : null;
  const employeeReservationRef = employeeId
    ? firestore.doc(
        `Companies/${companyId}/EmployeeUserReservations/${employeeId}`,
      )
    : null;
  const employeeUsersQuery = employeeId
    ? firestore
        .collection(usersCollectionPath)
        .where("employeeId", "==", employeeId)
        .limit(2)
    : null;

  return firestore.runTransaction(async (transaction) => {
    const actorUser = await readTransactionActor(transaction, actorRef);
    assertActorCanManageTemporaryUsers({
      companyId,
      actorUser,
      requestedRoles: resolvedInput.roles,
    });

    const emailReservationSnapshot = await transaction.get(
      emailReservationRef,
    );
    if (emailReservationSnapshot.exists) {
      throwCreateError(
        CREATE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_EXISTS,
        "[createTemporaryUser] Email reservation already exists",
      );
    }

    const emailUsersSnapshot = await transaction.get(emailUsersQuery);
    if (snapshotHasDocuments(emailUsersSnapshot)) {
      throwCreateError(
        CREATE_TEMPORARY_USER_ERROR_CODES.EMAIL_USER_EXISTS,
        "[createTemporaryUser] User email already exists",
      );
    }

    let userData = resolvedInput;
    if (!standalone) {
      const employeeSnapshot = await transaction.get(employeeRef);
      if (!employeeSnapshot.exists) {
        throwCreateError(
          CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_NOT_FOUND,
          "[createTemporaryUser] Employee was not found",
        );
      }

      const employeeReservationSnapshot = await transaction.get(
        employeeReservationRef,
      );
      if (employeeReservationSnapshot.exists) {
        throwCreateError(
          CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_EXISTS,
          "[createTemporaryUser] Employee reservation already exists",
        );
      }

      const employeeUsersSnapshot = await transaction.get(employeeUsersQuery);
      if (snapshotHasDocuments(employeeUsersSnapshot)) {
        throwCreateError(
          CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_USER_EXISTS,
          "[createTemporaryUser] Employee User already exists",
        );
      }

      userData = resolveEmployeeLinkedTemporaryUserData({
        companyId,
        input: resolvedInput,
        employee: employeeSnapshot.data(),
      });
    }

    const user = new User(userData);
    await user.create({
      docId: newUserRef.id,
      transaction,
      prefix: `Companies/${companyId}`,
    });

    transaction.create(emailReservationRef, {
      companyId,
      userId: newUserRef.id,
    });
    if (employeeReservationRef) {
      transaction.create(employeeReservationRef, { userId: newUserRef.id });
    }

    return {
      success: true,
      userId: newUserRef.id,
      linkType,
      employeeId,
    };
  });
}

/**
 * 単独仮登録Userを作成します。
 */
export function createStandaloneTemporaryUser(input = {}) {
  return createTemporaryUser({ ...input, linkType: "standalone" });
}

/**
 * Employee連携仮登録Userを作成します。
 */
export function createEmployeeLinkedTemporaryUser(input = {}) {
  return createTemporaryUser({ ...input, linkType: "employee-linked" });
}
