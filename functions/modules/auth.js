import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { ContextualError } from "./utils/ContextualError.js";

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
 * Create a new administrator account with a new company and user.
 * @returns {Promise<{success: boolean, uid: string, companyId: string}>} Result object containing success status, user ID, and company ID
 * @throws {HttpsError} if required arguments are missing or if any operation fails
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
    // 1. Create a new Auth user account as the administrator of the new company.
    const userRecord = await auth.createUser({ email, password, displayName });
    uid = userRecord.uid;

    // 2. Create a new company and the corresponding user document within a Firestore transaction.
    const db = getFirestore();
    const companyId = await db.runTransaction(async (transaction) => {
      const companyId = await createCompany(
        { companyName, companyNameKana },
        transaction
      );
      await createUser(
        { uid, email, displayName, roles: [USER_ROLES.ADMIN] },
        companyId,
        transaction
      );
      return companyId;
    });

    // 3. Set custom claims for the new user.
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

  const isCompanyExists = async (companyId) => {
    const db = getFirestore();
    const docRef = db.collection("Companies").doc(companyId);
    const docSnap = await docRef.get();
    console.log(docSnap.exists);
    return docSnap.exists;
  };

  const auth = getAuth();
  let uid; // uid は auth.createUser が成功した場合に設定される

  try {
    if (!(await isCompanyExists(companyId))) {
      throw new HttpsError(
        "not-found",
        "指定された会社情報が見つかりませんでした。companyId: " + companyId
      );
    }
    const userRecord = await auth.createUser({ email, password, displayName });
    uid = userRecord.uid;
    await createUser({ uid, email, displayName, roles: [] }, companyId);
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

/**
 * ユーザーアカウントを無効化します。
 */
export const disableUser = onCall(async (request) => {
  const { uid } = request.data;
  try {
    return await switchUserEnabled(uid, false);
  } catch (error) {
    const mappedAuthError = AUTH_ERROR_CODE_MAP[error.code];
    if (mappedAuthError) {
      throw new HttpsError(mappedAuthError.status, mappedAuthError.message);
    }
    throw new HttpsError(
      "internal",
      `ユーザー ${uid} の無効化中に予期しないエラーが発生しました。`
    );
  }
});

/**
 * ユーザーアカウントを有効化します。
 */
export const enableUser = onCall(async (request) => {
  const { uid } = request.data;
  try {
    return await switchUserEnabled(uid);
  } catch (error) {
    const mappedAuthError = AUTH_ERROR_CODE_MAP[error.code];
    if (mappedAuthError) {
      throw new HttpsError(mappedAuthError.status, mappedAuthError.message);
    }
    throw new HttpsError(
      "internal",
      `ユーザー ${uid} の有効化中に予期しないエラーが発生しました。`
    );
  }
});

/**
 * Create a new company and return the company ID.
 * @param {object} args - company creation arguments
 * @param {string} args.companyName
 * @param {string} args.companyNameKana
 * @param {import("firebase-admin/firestore").Transaction} [transaction] - Firestore transaction
 * @returns {Promise<string>} companyId
 * @throws {ContextualError} if required arguments are missing
 * @throws {ContextualError} if transaction is missing
 * @throws {ContextualError} if Firestore operation fails
 */
async function createCompany(args = {}, transaction) {
  const { companyName, companyNameKana } = args;
  try {
    if (!companyName || !companyNameKana) {
      throw new Error(
        "companyName and companyNameKana are required to create a company."
      );
    }
    const db = getFirestore();
    const docRef = db.collection("Companies").doc();
    const fields = { docId: docRef.id, companyName, companyNameKana };
    if (transaction) {
      transaction.set(docRef, fields);
    } else {
      await docRef.set(fields);
    }
    return docRef.id;
  } catch (error) {
    throw new ContextualError(error.message, {
      method: "createCompany",
      arguments: { companyName, companyNameKana, transaction },
    });
  }
}

/**
 * Create a new user and return the user ID.
 * @param {object} args - user creation arguments
 * @param {string} args.uid - user ID
 * @param {string} args.email - user email
 * @param {string} args.displayName - user display name
 * @param {string[]} args.roles - user roles
 * @param {string} companyId - company ID
 * @param {import("firebase-admin/firestore").Transaction} [transaction] - Firestore transaction
 * @returns {Promise<string>} userId
 * @throws {ContextualError} if required arguments are missing
 * @throws {ContextualError} if companyId or transaction is missing
 * @throws {ContextualError} if Firestore operation fails
 */
async function createUser(args = {}, companyId, transaction) {
  const { uid, email, displayName, roles = [] } = args;
  try {
    if (!uid || !email || !displayName) {
      throw new Error("uid, email, displayName are required to create a user.");
    }
    if (
      !Array.isArray(roles) ||
      (roles.length > 0 &&
        !roles.every((role) => Object.values(USER_ROLES).includes(role)))
    ) {
      throw new Error("roles must be an array of valid roles.");
    }
    if (!companyId) {
      throw new Error("companyId is required to create a user.");
    }
    const db = getFirestore();
    const docRef = db.collection(`Companies/${companyId}/Users`).doc(uid);
    const fields = { docId: uid, email, displayName, roles, uid };
    if (transaction) {
      transaction.set(docRef, fields);
    } else {
      await docRef.set(fields);
    }
    return docRef.id;
  } catch (error) {
    throw new ContextualError(error.message, {
      method: "createUser",
      arguments: { ...args, companyId, transaction },
    });
  }
}

/**
 * Switch user enabled/disabled state
 * @param {string} uid - user ID
 * @param {boolean} [enabled] - enabled state (default: true)
 * @returns {Promise<{ success: boolean, uid: string }>} - result
 * @throws {HttpsError} if uid is not provided or if any operation fails
 * @throws {ContextualError} if any operation fails
 */
async function switchUserEnabled(uid, enabled = true) {
  try {
    if (!uid) {
      throw new HttpsError("invalid-argument", "UIDが指定されていません。");
    }
    const auth = getAuth();
    const companyId = (await auth.getUser(uid)).customClaims?.companyId;
    const userDocRef = getFirestore().doc(
      `Companies/${companyId}/Users/${uid}`
    );
    await userDocRef.update({ disabled: !enabled });
    await auth.updateUser(uid, { disabled: !enabled });
    return { success: true, uid };
  } catch (error) {
    throw new ContextualError(error.message, {
      method: "switchUserEnabled",
      arguments: { uid, enabled },
    });
  }
}
