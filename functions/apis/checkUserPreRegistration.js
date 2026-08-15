/*****************************************************************************
 * @file ./functions/apis/checkUserPreRegistration.js
 * @description 一般Userの事前登録状態を確認するCallable APIです。
 * @method checkUserPreRegistration メールアドレスに一致する仮Userを確認します。
 *****************************************************************************/
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

/**
 * ユーザー事前登録確認
 * 利用者自身が本登録を行う際に、管理者による仮登録が完了しているかどうかを確認
 * 未認証状態での実行も想定されるため、request.auth のチェックは行わない。
 * @param {Object} request
 * @param {Object} request.data
 * @param {string} request.data.email - 確認するメールアドレス
 * @return {Object} 登録状況と仮登録情報
 * @return {boolean} return.isPreRegistered - 事前登録されているかどうか
 * @return {string} [return.companyId] - 事前登録されている場合の会社ID
 * @return {string} [return.displayName] - 事前登録されている場合の表示名
 * @return {Array} [return.roles] - 事前登録されている場合の役割リスト
 * @return {string} [return.tempUserId] - 事前登録されている場合の仮ユーザードキュメントID
 */
export const checkUserPreRegistration = onCall(async (request) => {
  const { email } = request.data;

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "メールアドレスが指定されていません。",
    );
  }

  try {
    const db = getFirestore();

    // コレクショングループクエリで仮Userドキュメントを検索
    const preRegSnapshot = await db
      .collectionGroup("Users")
      .where("email", "==", email)
      .where("isTemporary", "==", true)
      .get();

    if (preRegSnapshot.empty) {
      logger.info(`No pre-registration found for email: ${email}`);
      return { isPreRegistered: false };
    }

    const preRegDoc = preRegSnapshot.docs[0];
    const preRegData = preRegDoc.data();

    logger.info(
      `Pre-registration found for email: ${email}, CompanyId: ${preRegData.companyId}`,
    );

    return {
      isPreRegistered: true,
      companyId: preRegData.companyId,
      displayName: preRegData.displayName || "",
      roles: preRegData.roles || [],
      tempUserId: preRegDoc.id,
    };
  } catch (error) {
    logger.error("checkUserPreRegistration でエラーが発生しました:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "ユーザー事前登録確認中に予期しないエラーが発生しました。",
    );
  }
});
