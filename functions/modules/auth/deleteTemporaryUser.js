/*****************************************************************************
 * @file ./functions/modules/auth/deleteTemporaryUser.js
 * @description 検証済みの実行者が同じ会社の仮登録Userを削除します。
 * @method deleteTemporaryUser
 *****************************************************************************/
import { assertTemporaryUserCanBeDeleted } from "./temporaryUserDeletionPolicy.js";
import { assertActorCanManageTemporaryUsers } from "./temporaryUserManagementPolicy.js";

export const DELETE_TEMPORARY_USER_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  IDENTIFIER_INVALID: "identifier-invalid",
  FIRESTORE_SERVICE_INVALID: "firestore-service-invalid",
  ACTOR_USER_NOT_FOUND: "actor-user-not-found",
  TARGET_USER_NOT_FOUND: "target-user-not-found",
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

    transaction.delete(targetUserRef);

    const employeeId = targetUser.employeeId || null;
    return {
      success: true,
      userId: targetUserId,
      linkType: employeeId ? "employee-linked" : "standalone",
      employeeId,
    };
  });
}
