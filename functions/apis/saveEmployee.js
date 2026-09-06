import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import { EmployeeOperationError } from "../shared/employeeContract.js";
import { saveEmployee } from "../modules/employees/saveEmployee.js";
import { geocodeEmployee } from "../modules/employees/geocodeEmployee.js";

function callable(operation) {
  return onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です。");
    try {
      return await saveEmployee({ firestore: getFirestore(), operation, input: request.data, geocode: geocodeEmployee,
        resolveIdentity: () => resolveCallableAuthIdentity({ auth: getAuth(), tokenUid: request.auth.uid, tokenEmail: request.auth.token?.email, tokenEmailVerified: request.auth.token?.email_verified, tokenCompanyId: request.auth.token?.companyId, tokenIsSuperUser: request.auth.token?.isSuperUser }),
      });
    } catch (error) {
      if (error instanceof EmployeeOperationError) throw new HttpsError(error.code, error.message);
      const identityError = mapCallableAuthIdentityError(error);
      if (identityError) throw new HttpsError(identityError.code, identityError.message);
      throw new HttpsError("internal", "保存結果を確認できません。再登録せず、最新情報を確認してください。");
    }
  });
}
export const createEmployee = callable("create");
export const updateEmployeeBasic = callable("basic");
export const updateEmployeeNationality = callable("nationality");
export const updateEmployeeSecurity = callable("security");
export const updateEmployeeCertifications = callable("certifications");
export const transitionEmployeeInsurance = callable("insurance");
