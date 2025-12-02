/**
 * グローバル認証ミドルウェア (Ver.5)
 * pageSettings の public プロパティと roles プロパティに基づいてアクセス制御を行う
 *
 * A. 未認証の場合:
 *    - public: true のページのみアクセス可能。
 *    - それ以外へのアクセスは /auth/sign-in へリダイレクト。
 * B. 認証済みの場合:
 *    - メール未認証の場合は /unconfirmedEmail へリダイレクト。
 *    - public: true のページへのアクセスは /dashboard にリダイレクト。
 *    - それ以外の場合は isPageAllowed で権限を確認し、権限がなければ /dashboard にリダイレクト。
 */

import { getPageConfig, isPageAllowed } from "~/utils/pageSettings";
import { useAuthStore } from "~/stores/useAuthStore";
import { useErrorsStore } from "~/stores/useErrorsStore";

export default defineNuxtRouteMiddleware(async (to, from) => {
  const auth = useAuthStore();
  const errors = useErrorsStore();

  // 画面遷移時にはエラーをクリア
  errors.clear();

  // メンテナンスモードの処理
  if (auth.isMaintenance) {
    // メンテナンス画面への遷移の場合は何もしない
    if (to.path === "/maintenance") return;

    // それ以外の場合はメンテナンス画面へリダイレクト
    console.log("[auth.global] Maintenance mode: redirecting to /maintenance");
    return navigateTo("/maintenance", { replace: true });
  } else {
    if (to.path === "/maintenance") {
      console.log(
        "[auth.global] Not in maintenance mode: redirecting from /maintenance"
      );
      return navigateTo("/", { replace: true });
    }
  }

  // auth状態の準備ができるまで待機
  await auth.waitUntilReady();

  const isAuthenticated = !!auth.uid;
  const userRoles = auth.roles ?? [];
  const targetPath = to.path;

  // ターゲットパスのページ設定を取得
  const pageConfig = getPageConfig(targetPath);

  // --- A. 未認証ユーザーの処理 ---
  if (!isAuthenticated) {
    // public: true のページ、または設定がないページへのアクセスは許可
    if (pageConfig?.public) return;

    // 非公開ページへのアクセスは /auth/sign-in へリダイレクト
    if (targetPath !== "/auth/sign-in") {
      return navigateTo("/auth/sign-in", { replace: true });
    }

    return;
  }

  // --- B. 認証済みユーザーの処理 ---

  // 1. メール未認証の場合
  if (!auth.isEmailVerified) {
    if (targetPath !== "/unconfirmedEmail") {
      return navigateTo("/unconfirmedEmail", { replace: true });
    }
    return;
  }

  // 2. メール認証済みだが /unconfirmedEmail にいる場合はリダイレクト
  if (targetPath === "/unconfirmedEmail") {
    return navigateTo("/dashboard", { replace: true });
  }

  // 3. 公開ページ（sign-in, sign-up等）へのアクセスは /dashboard へリダイレクト
  if (pageConfig?.public) {
    if (targetPath !== "/dashboard") {
      return navigateTo("/dashboard", { replace: true });
    }
    return;
  }

  // 4. 非公開ページの権限チェック
  // ページ設定が存在しない場合（404想定）はアクセスを許可
  if (!pageConfig) {
    return;
  }

  const allowed = isPageAllowed(targetPath, userRoles);

  // 権限がない場合は /dashboard へリダイレクト
  if (!allowed) {
    if (targetPath !== "/dashboard") {
      return navigateTo("/dashboard", { replace: true });
    }
    return;
  }

  // 5. すべてのチェックをパスした場合はアクセスを許可
  return;
});
