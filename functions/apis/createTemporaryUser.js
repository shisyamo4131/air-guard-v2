/*****************************************************************************
 * @file ./functions/apis/createTemporaryUser.js
 * @description 単独／Employee連携の仮登録Userを作成するCallable APIです。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  createEmployeeLinkedTemporaryUser as createEmployeeLinkedTemporaryUserUseCase,
  createStandaloneTemporaryUser as createStandaloneTemporaryUserUseCase,
} from "../modules/auth/createTemporaryUser.js";
import { mapCreateTemporaryUserError } from "../modules/auth/mappers/mapCreateTemporaryUserError.js";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";

async function handleCreateRequest(request, { operation, useCase }) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const token = request.auth.token ?? {};
  const auth = getAuth();

  try {
    const actorIdentity = await resolveCallableAuthIdentity({
      auth,
      tokenUid: request.auth.uid,
      tokenEmail: token.email,
      tokenEmailVerified: token.email_verified,
      tokenCompanyId: token.companyId,
      tokenIsSuperUser: token.isSuperUser,
    });

    return await useCase({
      auth,
      firestore: getFirestore(),
      companyId: actorIdentity.companyId,
      actorUid: actorIdentity.uid,
      input: request.data,
    });
  } catch (error) {
    const mappedError = mapCreateTemporaryUserError(error);
    const errorCode = error?.code;

    logger.error("Temporary User creation failed", {
      operation,
      errorName:
        typeof error?.name === "string" ? error.name : "UnknownError",
      errorCode:
        typeof errorCode === "string" || typeof errorCode === "number"
          ? errorCode
          : "unknown",
      callableCode: mappedError.code,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
}

export const createStandaloneTemporaryUser = onCall((request) =>
  handleCreateRequest(request, {
    operation: "standalone",
    useCase: createStandaloneTemporaryUserUseCase,
  }),
);

export const createEmployeeLinkedTemporaryUser = onCall((request) =>
  handleCreateRequest(request, {
    operation: "employee-linked",
    useCase: createEmployeeLinkedTemporaryUserUseCase,
  }),
);
