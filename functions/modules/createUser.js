import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Company, User } from "air-guard-v2-schemas";

const USER_ROLES = {
  ADMIN: "admin",
};

const AUTH_ERROR_CODE_MAP = {
  "auth/email-already-exists": {
    status: "already-exists",
    message: "このメールアドレスは既に使用されています。",
  },
  "auth/invalid-email": {
    status: "invalid-argument",
    message: "メールアドレスの形式が正しくありません。",
  },
  "auth/invalid-password": {
    status: "invalid-argument",
    message: "パスワードの形式が正しくありません。",
  },
  "auth/weak-password": {
    status: "invalid-argument",
    message: "パスワードが簡単すぎます（最低6文字以上にしてください）。",
  },
};

/**
 * ユーザー操作時の共通エラーハンドリングとロールバック処理
 * @param {Error} originalError - 発生した元のエラー
 * @param {string|undefined} uidIfCreated - 作成されたAuthユーザーのUID（存在する場合）
 * @param {import("firebase-admin/auth").Auth} authInstance - Firebase Authのインスタンス
 * @param {string} operationName - 操作名（ログ用）
 */
async function handleUserOperationError(
  originalError,
  uidIfCreated,
  authInstance,
  operationName
) {
  console.error(`${operationName} でエラーが発生しました:`, originalError);

  const mappedAuthError = AUTH_ERROR_CODE_MAP[originalError.code];
  if (mappedAuthError) {
    throw new HttpsError(mappedAuthError.status, mappedAuthError.message);
  }

  if (uidIfCreated) {
    try {
      await authInstance.deleteUser(uidIfCreated);
      console.log(
        `Authユーザー ${uidIfCreated} のロールバック削除に成功しました。(処理: ${operationName})`
      );
    } catch (rollbackError) {
      console.error(
        `Authユーザー ${uidIfCreated} のロールバック削除失敗 (処理: ${operationName}):`,
        rollbackError
      );
    }
  }

  if (originalError instanceof HttpsError) {
    throw originalError;
  }

  throw new HttpsError(
    "internal",
    `${operationName} 中に予期しないエラーが発生しました。`
  );
}

/**
 * 会社情報とともにユーザーアカウントを作成します。
 */
export const createUserWithCompany = onCall(async (request) => {
  const { email, password, companyName, companyNameKana, displayName } =
    request.data;

  if (!email || !password || !displayName || !companyName || !companyNameKana) {
    throw new HttpsError("invalid-argument", "必要な情報が不足しています");
  }

  const auth = getAuth();
  let uid;

  try {
    // 1. Firebase Authentication にユーザー作成
    const userRecord = await auth.createUser({ email, password, displayName });
    uid = userRecord.uid;

    // 2. Company を FireModel 経由で作成
    const company = new Company({
      name: companyName,
      nameKana: companyNameKana,
    });

    const companyRef = await company.create();
    const companyId = companyRef.id;

    // 3. User を FireModel 経由で作成（サブコレクション）
    const user = new User({
      uid,
      email,
      displayName,
      roles: [USER_ROLES.ADMIN],
    });

    await user.create({
      docId: uid,
      prefix: `Companies/${companyId}`,
    });

    // 4. カスタムクレーム設定
    await auth.setCustomUserClaims(uid, {
      companyId,
      isSuperUser: false,
      roles: [USER_ROLES.ADMIN],
    });

    return { success: true, uid, companyId };
  } catch (error) {
    await handleUserOperationError(error, uid, auth, "createUserWithCompany");
  }
});

/**
 * 指定された会社に所属するユーザーアカウントを作成します。
 */
export const createUserInCompany = onCall(async (request) => {
  const { email, password, displayName, companyId } = request.data;

  // check if required arguments is set.
  if (!email || !password || !displayName || !companyId) {
    throw new HttpsError("invalid-argument", "必要な情報が不足しています");
  }

  const company = new Company();
  try {
    await company.fetch({ docId: companyId });
    if (!company.docId) {
      throw new HttpsError(
        "not-found",
        "指定された会社情報が見つかりませんでした。"
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error(
      `Error fetching company ${companyId} in createUserInCompany:`,
      error
    );
    throw new HttpsError(
      "internal",
      "会社情報の検証中にエラーが発生しました。"
    );
  }

  const auth = getAuth();
  let uid; // uid は auth.createUser が成功した場合に設定される

  try {
    const userRecord = await auth.createUser({ email, password, displayName });
    uid = userRecord.uid;
    const user = new User({
      uid,
      email,
      displayName,
      roles: [],
    });

    await user.create({
      docId: uid,
      prefix: `Companies/${companyId}`,
    });

    await auth.setCustomUserClaims(uid, {
      companyId,
      isSuperUser: false,
      roles: [],
    });

    return { success: true, uid };
  } catch (error) {
    await handleUserOperationError(error, uid, auth, "createUserInCompany");
  }
});
