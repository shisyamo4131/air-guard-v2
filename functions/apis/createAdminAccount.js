/*****************************************************************************
 * @file ./functions/apis/createAdminAccount.js
 * @description 新しい会社と最初の会社管理者を作成するCallable APIです。
 * @method createAdminAccount 認証済みUserを新しい会社の管理者として登録します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Company, User } from "@shisyamo4131/air-guard-v2-schemas";

/**
 * 管理者アカウント作成
 * クライアント側でAuthentication作成後に呼び出される
 * 認証状態での実行を想定
 * @param {Object} request
 * @param {Object} request.auth - 認証情報
 * @param {Object} request.data
 * @param {string} request.data.companyName - 会社名
 * @param {string} request.data.companyNameKana - 会社名カナ
 * @param {string} request.data.displayName - 管理者表示名
 */
export const createAdminAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です。");
  }

  const { companyName, companyNameKana, displayName } = request.data;
  const uid = request.auth.uid;
  const email = request.auth.token.email;

  if (!companyName || !companyNameKana || !displayName) {
    throw new HttpsError(
      "invalid-argument",
      "会社情報（会社名、会社名カナ、管理者表示名）が不足しています。",
    );
  }

  logger.info(`createAdminAccount started for UID: ${uid}, Email: ${email}`);

  try {
    const db = getFirestore();
    const auth = getAuth();

    // トランザクションでCompanyとUser作成
    const result = await db.runTransaction(async (transaction) => {
      // Company作成
      const company = new Company({
        companyName: companyName,
        companyNameKana: companyNameKana,
      });

      const companyRef = await company.create({ transaction });

      logger.info(
        `Company created with ID: ${companyRef.id} for admin UID: ${uid}`,
      );

      // User作成（Companiesのサブコレクション、uidをdocIdとして使用）
      const user = new User({
        email,
        displayName: displayName || "",
        companyId: companyRef.id,
        isAdmin: true,
        isTemporary: false,
      });

      await user.create({
        docId: uid,
        transaction,
        prefix: `Companies/${companyRef.id}`,
      });

      logger.info(
        `User document created with ID: ${uid} for UID: ${uid} under company ID: ${companyRef.id}`,
      );

      return { companyId: companyRef.id, userId: uid };
    });

    // カスタムクレーム設定
    await auth.setCustomUserClaims(uid, {
      companyId: result.companyId,
      isSuperUser: false,
    });

    logger.info(
      `Custom claims set for UID: ${uid}, CompanyId: ${result.companyId}`,
    );

    return {
      success: true,
      companyId: result.companyId,
      userId: result.userId,
    };
  } catch (error) {
    logger.error("createAdminAccount でエラーが発生しました:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "管理者アカウント作成中に予期しないエラーが発生しました。",
    );
  }
});
