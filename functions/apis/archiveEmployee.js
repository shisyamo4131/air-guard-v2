import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import { EmployeeOperationError } from "../shared/employeeContract.js";
import {
  archiveEmployee as archiveEmployeeUseCase,
} from "../modules/employees/archiveEmployee.js";

export function createArchiveEmployeeCallable() {
  return onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です。");
    try {
      return await archiveEmployeeUseCase({ firestore: getFirestore(), input: request.data,
        resolveIdentity: () => resolveCallableAuthIdentity({ auth: getAuth(), tokenUid: request.auth.uid, tokenEmail: request.auth.token?.email, tokenEmailVerified: request.auth.token?.email_verified, tokenCompanyId: request.auth.token?.companyId, tokenIsSuperUser: request.auth.token?.isSuperUser }),
      });
    } catch (error) {
      if (error instanceof EmployeeOperationError) throw new HttpsError(error.code, error.message);
      const identityError = mapCallableAuthIdentityError(error);
      if (identityError) throw new HttpsError(identityError.code, identityError.message);
      throw new HttpsError("internal", "アーカイブ事前確認に失敗しました。現在の従業員情報を確認してください。");
    }
  });
}

// The normal and Codex test entrypoints share the same authenticated
// same-tenant Employee actor boundary. Environment-specific tenant allowlists
// are not part of the archive authorization contract.
export const archiveEmployee = createArchiveEmployeeCallable();
