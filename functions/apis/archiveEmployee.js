import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import { EmployeeOperationError } from "../shared/employeeContract.js";
import {
  archiveEmployee as archiveEmployeeUseCase,
  configuredArchiveTenants,
} from "../modules/employees/archiveEmployee.js";

export function createArchiveEmployeeCallable(resolveAllowedTenants) {
  return onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です。");
    try {
      return await archiveEmployeeUseCase({ firestore: getFirestore(), input: request.data, resolveAllowedTenants,
        resolveIdentity: () => resolveCallableAuthIdentity({ auth: getAuth(), tokenUid: request.auth.uid, tokenEmail: request.auth.token?.email, tokenEmailVerified: request.auth.token?.email_verified, tokenCompanyId: request.auth.token?.companyId, tokenIsSuperUser: request.auth.token?.isSuperUser }),
      });
    } catch (error) {
      if (error instanceof EmployeeOperationError) throw new HttpsError(error.code, error.message);
      const identityError = mapCallableAuthIdentityError(error);
      if (identityError) throw new HttpsError(identityError.code, identityError.message);
      throw new HttpsError("internal", "アーカイブ結果を確認できません。同じ操作から結果を確認してください。");
    }
  });
}

// The normal entrypoint remains fail-closed until the runtime tenant allowlist
// is configured. The Codex-only entrypoint injects its separate demo resolver.
export const archiveEmployee = createArchiveEmployeeCallable(
  configuredArchiveTenants,
);
