import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveCallableAuthIdentity } from "../modules/auth/resolveCallableAuthIdentity.js";
import { mapCallableAuthIdentityError } from "../modules/auth/mappers/mapCallableAuthIdentityError.js";
import { EmployeeOperationError } from "../shared/employeeContract.js";
import { OperationWriteError } from "../shared/operationReferences.js";
import { updateBillingPaymentDate as update } from "../modules/billings/updateBillingPaymentDate.js";

export const updateBillingPaymentDate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です。");
  try {
    return await update({ firestore: getFirestore(), input: request.data,
      resolveIdentity: () => resolveCallableAuthIdentity({ auth: getAuth(), tokenUid: request.auth.uid, tokenEmail: request.auth.token?.email, tokenEmailVerified: request.auth.token?.email_verified, tokenCompanyId: request.auth.token?.companyId, tokenIsSuperUser: request.auth.token?.isSuperUser }),
    });
  } catch (error) {
    if (error instanceof OperationWriteError) throw new HttpsError(error.code, error.message);
    if (error instanceof EmployeeOperationError) throw new HttpsError("invalid-argument", "日付を確認してください。");
    const mapped = mapCallableAuthIdentityError(error);
    if (mapped) throw new HttpsError(mapped.code, mapped.message);
    throw new HttpsError("internal", "保存結果を確認できません。再送せず、最新情報を確認してください。");
  }
});
