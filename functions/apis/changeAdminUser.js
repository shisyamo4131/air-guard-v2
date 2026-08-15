/*****************************************************************************
 * @file ./functions/apis/changeAdminUser.js
 * @description 同じ会社のUserへ会社管理者権限を移譲するCallable APIです。
 * @method changeAdminUser 検証済みの移譲元から移譲先へ管理者権限を移します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { transferCompanyAdmin } from "../modules/auth/transferCompanyAdmin.js";
import { mapCompanyAdminTransferError } from "../modules/auth/mapCompanyAdminTransferError.js";

/**
 * 会社管理者の権限を別のUserへ移譲します。
 *
 * @param {Object} request - Callableリクエスト
 * @param {Object} request.auth - 認証情報
 * @param {Object} request.data - リクエストデータ
 * @param {string} request.data.from - 移譲元UserのUID
 * @param {string} request.data.to - 移譲先UserのUID
 * @returns {Promise<{success: boolean, from: string, to: string}>}
 * @throws {HttpsError} 認証または管理者移譲に失敗した場合
 */
export const changeAdminUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const actorUid = request.auth.uid;
  const companyId = request.auth.token?.companyId;
  const fromUid = request.data?.from;
  const toUid = request.data?.to;

  if (
    typeof actorUid !== "string" ||
    !actorUid ||
    typeof companyId !== "string" ||
    !companyId
  ) {
    throw new HttpsError("permission-denied", "認証情報を確認できません。");
  }

  try {
    return await transferCompanyAdmin({
      auth: getAuth(),
      firestore: getFirestore(),
      companyId,
      actorUid,
      fromUid,
      toUid,
    });
  } catch (error) {
    const mappedError = mapCompanyAdminTransferError(error);

    logger.error("Company admin transfer failed", {
      errorName: error?.name,
      errorCode: error?.code,
    });

    throw new HttpsError(mappedError.code, mappedError.message);
  }
});
