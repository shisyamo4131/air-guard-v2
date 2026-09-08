/*****************************************************************************
 * @file ./composables/application/auth/useAuthActions.js
 * @description 認証関連機能を提供する Application コンポーザブル
 *****************************************************************************/
import {
  signInWithEmailAndPassword,
  signOut as authSignOut,
} from "firebase/auth";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import FireModel from "@shisyamo4131/air-firebase-v2";
import { useNotification } from "@/composables/useNotification";

/**
 * @returns {{
 *   setUser: Function,
 *   signIn: Function,
 *   signOut: Function
 * }}
 */
export function useAuthActions() {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const auth = useAuthStore();
  const companyStore = useCompanyStore();
  const logger = useLogger("useAuthActions", useErrorsStore());
  const { registFCMToken } = useNotification();

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  function resetSessionModels() {
    auth.user.unsubscribe();
    auth.user.initialize();
    companyStore.company.unsubscribe();
    companyStore.company.initialize();
    FireModel.setConfig({ prefix: "Companies/unknown" });
  }

  function resetAccessClaims() {
    auth.isSuperUser = false;
    auth.isSuperUserClaimValid = false;
    auth.isDeveloper = false;
    auth.isDeveloperClaimValid = false;
    auth.companyId = null;
  }

  /**
   * Signs in a user with the given email and password.
   * @param {{email: string, password: string}} options
   * @throws {Error} If email or password is missing.
   * @throws {TypeError} If email or password is not a string.
   * @throws {FirebaseError} If the sign-in fails due to Firebase authentication errors.
   * @returns {Promise<void>}
   */
  async function signIn({ email, password } = {}) {
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }
    if (typeof email !== "string" || typeof password !== "string") {
      throw new TypeError("Email and password must be strings.");
    }
    const { $auth } = useNuxtApp();
    await signInWithEmailAndPassword($auth, email, password);
  }

  /**
   * Signs out the currently signed-in user.
   * @throws {FirebaseError} If the sign-out fails due to Firebase authentication errors.
   * @returns {Promise<void>}
   */
  async function signOut() {
    const { $auth } = useNuxtApp();
    await authSignOut($auth);
    await auth.waitUntilSessionCleared(); // セッションが完全にクリアされるまで待機
  }

  /**
   * Firebase Authentication のユーザーから認証セッションを初期化します。
   * カスタムクレームをStoreへ反映し、User・Companyの取得と購読を開始します。
   *
   * @param {import("firebase/auth").User} user
   * @returns {Promise<void>}
   */
  async function initializeSession(user) {
    resetSessionModels();
    resetAccessClaims();
    auth.uid = user.uid;
    auth.isEmailVerified = user.emailVerified === true;
    auth.sessionInitializationFailed = false;

    const idTokenResult = await user.getIdTokenResult();
    const rawIsSuperUserClaim = idTokenResult.claims?.isSuperUser;
    const rawIsDeveloperClaim = idTokenResult.claims?.isDeveloper;

    auth.isSuperUserClaimValid =
      typeof rawIsSuperUserClaim === "boolean";
    auth.isSuperUser = rawIsSuperUserClaim === true;
    auth.isDeveloperClaimValid =
      rawIsDeveloperClaim === undefined ||
      typeof rawIsDeveloperClaim === "boolean";
    auth.isDeveloper = rawIsDeveloperClaim === true;
    auth.companyId = idTokenResult.claims?.companyId || null;

    // companyIdがまだカスタムクレームに設定されていないユーザーについては、
    // 認証情報を維持したままUser・Companyの状態だけを初期化する。
    if (!auth.uid || !auth.companyId) {
      return;
    }

    // subscribeだけでは初回取得の完了を待てないため、先にfetchを実行する。
    FireModel.setConfig({ prefix: `Companies/${auth.companyId}` });
    await auth.user.fetch({ docId: auth.uid });
    await companyStore.company.fetch({ docId: auth.companyId });
    auth.user.subscribe({ docId: auth.uid });
    companyStore.company.subscribe({ docId: auth.companyId });

    await registFCMToken(auth.user);
  }

  /**
   * 現在の認証セッションを解除し、Storeとモデルの状態を初期化します。
   *
   * @returns {Promise<void>}
   */
  async function clearSession() {
    auth.uid = null;
    auth.isEmailVerified = false;
    auth.sessionInitializationFailed = false;
    resetAccessClaims();
    resetSessionModels();
  }

  /**
   * Firebase Authentication の状態に合わせて認証セッションを更新します。
   *
   * @param {import("firebase/auth").User | null | undefined} user
   * @returns {Promise<void>}
   */
  async function setUser(user) {
    logger.clearError();
    auth.isReady = false;
    auth.sessionInitializationFailed = false;
    try {
      if (user) {
        await initializeSession(user);
      } else {
        await clearSession();
      }
    } catch (error) {
      resetSessionModels();
      resetAccessClaims();
      auth.sessionInitializationFailed = true;
      logger.error({
        message: `Failed to set user: ${error.message}`,
        error,
      });
    } finally {
      auth.isReady = true;
    }
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    setUser,
    signIn,
    signOut,
  };
}
