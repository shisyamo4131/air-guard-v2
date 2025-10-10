import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { ContextualError } from "./utils/ContextualError.js";
import { onDocumentCreated } from "firebase-functions/firestore";
import { logger } from "firebase-functions";

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
 * A function that triggers when a new document is created in the 'admin_users' collection.
 * It creates a new company and user in Firestore, sets custom claims for the user,
 * and then deletes the original document to signal completion.
 */
export const onAdminUserCreated = onDocumentCreated(
  `admin_users/{uid}`,
  async (event) => {
    const { uid } = event.params;
    const data = event.data.data();
    const companyData = {
      companyName: data.companyName,
      companyNameKana: data.companyNameKana,
    };
    const userData = {
      uid,
      email: data.email,
      displayName: data.displayName,
      roles: [USER_ROLES.ADMIN],
    };

    // Inform the start of the function execution.
    logger.info(`onAdminUserCreated function started for UID: ${uid}`);

    try {
      const companyId = await getFirestore().runTransaction(
        async (transaction) => {
          const companyRef = await createCompany(companyData, transaction);
          const companyId = companyRef.id;

          // Inform about the created company.
          logger.info(
            `Company created with ID: ${companyId} for admin user UID: ${uid}`
          );

          await createUser(userData, companyId, transaction);

          // Inform about the created user document.
          logger.info(
            `Admin user document created for UID: ${uid} under company ID: ${companyId}`
          );

          return companyId;
        }
      );

      // Set custom claims for the new user.
      const auth = getAuth();
      await auth.setCustomUserClaims(uid, {
        companyId,
        isSuperUser: false,
        roles: [USER_ROLES.ADMIN],
      });
    } catch (error) {
      logger.error("onAdminUserCreated でエラーが発生しました:", error);
    } finally {
      await event.data.ref.delete();
    }
  }
);

/**
 * ユーザー操作時の共通エラーハンドリングとロールバック処理
 * @param {Error} originalError - 発生した元のエラー
 * @param {string|undefined} uidIfCreated - 作成されたAuthユーザーのUID（存在する場合）
 * @param {import("firebase-admin/auth").Auth} authInstance - Firebase Authのインスタンス
 * @param {import("firebase-admin/firestore").DocumentReference|undefined} userRef - 作成されたFirestoreユーザードキュメントの参照（存在する場合）
 * @param {string} operationName - 操作名（ログ用）
 */
async function handleUserOperationError(
  originalError,
  uidIfCreated,
  authInstance,
  userRef,
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

  if (userRef) {
    try {
      await userRef.delete();
      console.log(
        `Firestoreユーザードキュメント ${userRef.path} のロールバック削除に成功しました。(処理: ${operationName})`
      );
    } catch (rollbackError) {
      console.error(
        `Firestoreユーザードキュメント ${userRef.path} のロールバック削除失敗 (処理: ${operationName}):`,
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
  let userRef = null;
  try {
    if (!(await isCompanyExists(companyId))) {
      throw new HttpsError(
        "not-found",
        "指定された会社情報が見つかりませんでした。companyId: " + companyId
      );
    }
    const userRecord = await auth.createUser({ email, password, displayName });
    uid = userRecord.uid;
    userRef = await createUser(
      { uid, email, displayName, roles: [] },
      companyId
    );
    await auth.setCustomUserClaims(uid, {
      companyId,
      isSuperUser: false,
      roles: [],
    });
    return { success: true, uid };
  } catch (error) {
    await handleUserOperationError(
      error,
      uid,
      auth,
      userRef,
      "createUserInCompany"
    );
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
 * @returns {Promise<import("firebase-admin/firestore").DocumentReference>} company document reference
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
    return docRef;
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
 * @returns {Promise<import("firebase-admin/firestore").DocumentReference>} user document reference
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
    return docRef;
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
