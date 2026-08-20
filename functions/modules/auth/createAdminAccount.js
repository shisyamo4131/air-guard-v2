/*****************************************************************************
 * @file ./functions/modules/auth/createAdminAccount.js
 * @description 初期Company・管理者User・email予約を一貫して作成します。
 *****************************************************************************/
import { Company, User } from "@shisyamo4131/air-guard-v2-schemas";
import { createUserEmailReservationId } from "./createTemporaryUser.js";
import {
  INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES,
  InitialAdminAccountPolicyError,
  assertInitialAdminRetryState,
  resolveInitialAdminAccountInput,
  resolveInitialAdminAuthIdentity,
  resolveInitialAdminReservation,
} from "./initialAdminAccountPolicy.js";

export const CREATE_ADMIN_ACCOUNT_ERROR_CODES = Object.freeze({
  AUTH_SERVICE_INVALID: "auth-service-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  CANDIDATE_CONFLICT: "candidate-conflict",
});

export class CreateAdminAccountError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "CreateAdminAccountError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new CreateAdminAccountError(code, message, options);
}

function assertMayCreate(identity) {
  if (
    identity.tokenCompanyId !== undefined ||
    identity.currentCompanyId !== undefined
  ) {
    throw new InitialAdminAccountPolicyError(
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.EXISTING_STATE_INVALID,
      "[createAdminAccount] Company claim exists without a reservation",
    );
  }
}

/**
 * @param {Object} param
 * @returns {Promise<{success:boolean,companyId:string,userId:string}>}
 */
export async function createAdminAccount({
  auth,
  firestore,
  tokenUid,
  tokenEmail,
  tokenEmailVerified,
  tokenCompanyId,
  tokenIsSuperUser,
  input,
} = {}) {
  const resolvedInput = resolveInitialAdminAccountInput(input);
  if (
    !auth ||
    typeof auth.getUser !== "function" ||
    typeof auth.setCustomUserClaims !== "function"
  ) {
    fail(
      CREATE_ADMIN_ACCOUNT_ERROR_CODES.AUTH_SERVICE_INVALID,
      "[createAdminAccount] Auth service is invalid",
    );
  }
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.collection !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    fail(
      CREATE_ADMIN_ACCOUNT_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      "[createAdminAccount] Firestore service is invalid",
    );
  }

  const authUser = await auth.getUser(tokenUid);
  const identity = resolveInitialAdminAuthIdentity({
    tokenUid,
    tokenEmail,
    tokenEmailVerified,
    tokenCompanyId,
    tokenIsSuperUser,
    authUser,
  });
  const emailReservationRef = firestore.doc(
    `UserEmailReservations/${createUserEmailReservationId(identity.email)}`,
  );
  const candidateCompanyRef = firestore.collection("Companies").doc();
  const candidateUserRef = firestore.doc(
    `Companies/${candidateCompanyRef.id}/Users/${identity.uid}`,
  );

  const result = await firestore.runTransaction(async (transaction) => {
    const reservationSnapshot = await transaction.get(emailReservationRef);
    if (reservationSnapshot.exists) {
      const reservation = resolveInitialAdminReservation({
        reservation: reservationSnapshot.data(),
        uid: identity.uid,
      });
      const existingUserRef = firestore.doc(
        `Companies/${reservation.companyId}/Users/${identity.uid}`,
      );
      const existingCompanyRef = firestore.doc(
        `Companies/${reservation.companyId}`,
      );
      const existingUserSnapshot = await transaction.get(existingUserRef);
      const existingCompanySnapshot = await transaction.get(existingCompanyRef);
      assertInitialAdminRetryState({
        identity,
        reservation,
        user: existingUserSnapshot.exists ? existingUserSnapshot.data() : null,
        company: existingCompanySnapshot.exists
          ? existingCompanySnapshot.data()
          : null,
      });
      return { companyId: reservation.companyId, userId: identity.uid };
    }

    assertMayCreate(identity);
    const candidateCompanySnapshot = await transaction.get(candidateCompanyRef);
    const candidateUserSnapshot = await transaction.get(candidateUserRef);
    if (candidateCompanySnapshot.exists || candidateUserSnapshot.exists) {
      fail(
        CREATE_ADMIN_ACCOUNT_ERROR_CODES.CANDIDATE_CONFLICT,
        "[createAdminAccount] Candidate document already exists",
      );
    }

    const company = new Company({
      companyName: resolvedInput.companyName,
      companyNameKana: resolvedInput.companyNameKana,
    });
    await company.create({
      docId: candidateCompanyRef.id,
      transaction,
    });

    const user = new User({
      email: identity.email,
      displayName: resolvedInput.displayName,
      companyId: candidateCompanyRef.id,
      isAdmin: true,
      isTemporary: false,
      disabled: false,
    });
    await user.create({
      docId: identity.uid,
      transaction,
      prefix: `Companies/${candidateCompanyRef.id}`,
    });
    transaction.create(emailReservationRef, {
      companyId: candidateCompanyRef.id,
      userId: identity.uid,
    });
    return { companyId: candidateCompanyRef.id, userId: identity.uid };
  });

  const latestAuthUser = await auth.getUser(identity.uid);
  const latestIdentity = resolveInitialAdminAuthIdentity({
    tokenUid,
    tokenEmail,
    tokenEmailVerified,
    tokenCompanyId,
    tokenIsSuperUser,
    authUser: latestAuthUser,
  });
  if (
    latestIdentity.currentCompanyId !== undefined &&
    latestIdentity.currentCompanyId !== result.companyId
  ) {
    throw new InitialAdminAccountPolicyError(
      INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES.EXISTING_STATE_INVALID,
      "[createAdminAccount] Auth company changed after Firestore commit",
    );
  }

  await auth.setCustomUserClaims(identity.uid, {
    ...latestIdentity.currentClaims,
    companyId: result.companyId,
    isSuperUser: latestIdentity.isSuperUser,
  });

  return { success: true, ...result };
}
