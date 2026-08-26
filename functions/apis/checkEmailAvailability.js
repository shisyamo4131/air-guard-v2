/*****************************************************************************
 * @file ./functions/apis/checkEmailAvailability.js
 * @description 新規会社の管理者signup用emailを助言的に事前確認します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  CHECK_EMAIL_AVAILABILITY_ERROR_CODES,
  CheckEmailAvailabilityError,
  checkEmailAvailability as checkEmailAvailabilityUseCase,
  resolveCheckEmailAvailabilityEmail,
} from "../modules/auth/checkEmailAvailability.js";

export const checkEmailAvailability = onCall(async (request) => {
  try {
    const email = resolveCheckEmailAvailabilityEmail(request.data?.email);
    return await checkEmailAvailabilityUseCase({
      auth: getAuth(),
      firestore: getFirestore(),
      email,
    });
  } catch (error) {
    let code = "internal";
    let message = "メールアドレスチェック中に予期しないエラーが発生しました。";
    if (error instanceof CheckEmailAvailabilityError) {
      if (error.code === CHECK_EMAIL_AVAILABILITY_ERROR_CODES.INPUT_INVALID) {
        code = "invalid-argument";
        message = "メールアドレスの形式が正しくありません。";
      } else if (error.code === CHECK_EMAIL_AVAILABILITY_ERROR_CODES.EMAIL_EXISTS) {
        code = "already-exists";
        message = "このメールアドレスは既に使用されています。";
      }
    }
    if (code === "internal") {
      logger.error("Administrator email preflight failed", {
        operation: "check-administrator-email-availability",
        errorName: typeof error?.name === "string" ? error.name : "UnknownError",
        errorCode:
          typeof error?.code === "string" || typeof error?.code === "number"
            ? error.code
            : "unknown",
        callableCode: code,
      });
    }
    throw new HttpsError(code, message);
  }
});
