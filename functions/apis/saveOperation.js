import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import { EmployeeOperationError } from "../shared/employeeContract.js";
import { OperationWriteError } from "../shared/operationReferences.js";
import { saveOperation as save } from "../modules/operations/saveOperation.js";

export const saveOperation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です。");
  try {
    return await save({ firestore: getFirestore(), input: request.data,
      resolveIdentity: () => resolveCallableAuthIdentity({ auth: getAuth(), tokenUid: request.auth.uid, tokenEmail: request.auth.token?.email, tokenEmailVerified: request.auth.token?.email_verified, tokenCompanyId: request.auth.token?.companyId, tokenIsSuperUser: request.auth.token?.isSuperUser }),
    });
  } catch (error) {
    if (error instanceof OperationWriteError) throw new HttpsError(error.code, error.message);
    if (error instanceof EmployeeOperationError) throw new HttpsError("invalid-argument", "入力情報を確認してください。");
    const identityError = mapCallableAuthIdentityError(error);
    if (identityError) throw new HttpsError(identityError.code, identityError.message);
    throw new HttpsError("internal", "保存結果を確認できません。再送せず、最新情報を確認してください。");
  }
});
