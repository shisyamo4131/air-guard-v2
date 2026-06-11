import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";

/*****************************************************************************
 * Firebase Authentication のユーザーを削除します。
 * - 指定された `uid` に対応するユーザーが存在しない場合はエラーを無視します。
 * - その他のエラーが発生した場合は再スローされます。
 * @param {string} uid - 削除するユーザーの UID
 * @returns {Promise<void>} ユーザーの削除が完了するまでの Promise
 * @throws {Error} uid が文字列でない場合
 *****************************************************************************/
export async function deleteUser(uid) {
  logger.info("'deleteUser' is called", {
    uid,
  });

  // uid が文字列でない場合はエラー
  if (typeof uid !== "string") throw new Error("uid must be a string");

  // Authentication インスタンスを取得
  const auth = getAuth();

  // 指定された uid に対応するユーザーを削除
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    // ユーザーが既に削除されている場合はエラーを無視
    if (error.code === "auth/user-not-found") {
      logger.info(`Authentication user ${uid} not found, skipping deletion.`);
      return;
    }
    // その他のエラーは再スロー
    throw error;
  }
}
