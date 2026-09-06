import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import { EmployeeOperationError } from "../shared/employeeContract.js";
import { archiveEmployee } from "../modules/employees/archiveEmployee.js";

// Factory only. Normal apis/index.js deliberately does not publish this API.
export function createArchiveEmployeeCallable(resolveAllowedTenants) {
  return onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です。");
    try {
      return await archiveEmployee({ firestore: getFirestore(), input: request.data, resolveAllowedTenants,
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
