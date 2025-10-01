/**
 * グローバル認証ミドルウェア (Ver.3)
 * pageSettings の public プロパティと roles プロパティに基づいてアクセス制御を行う
 *
 * A. 未認証の場合:
 *    - public: true のページのみアクセス可能。
 *    - それ以外へのアクセスはルート('/')にリダイレクト。(ルートが非公開なら /sign-in へ)
 * B. 認証済みの場合:
 *    - public: true のページへのアクセスはダッシュボード('/dashboard')にリダイレクト。
 *    - それ以外の場合は isPageAllowed で権限を確認し、権限がなければダッシュボード('/dashboard')にリダイレクト。
 */

// getPageConfig と isPageAllowed をインポート
import { getPageConfig, isPageAllowed } from "~/utils/pageSettings";
import { useAuthStore } from "~/stores/useAuthStore";
import { useErrorsStore } from "~/stores/useErrorsStore";

// グローバル認証ミドルウェア
export default defineNuxtRouteMiddleware(async (to) => {
  // 画面遷移時にはエラーをクリア
  const errors = useErrorsStore();
  errors.clear();

  const auth = useAuthStore();
  await auth.waitUntilReady();

  const isAuthenticated = !!auth.uid;
  const userRoles = auth.roles ?? [];
  const targetPath = to.path;

  // ターゲットパスのページ設定を取得
  const pageConfig = getPageConfig(targetPath);

  // --- ルーティングロジック ---

  // A. 未認証ユーザーの処理
  if (!isAuthenticated) {
    // ページ設定が存在し、かつ public: true でない場合
    if (!pageConfig?.public) {
      const redirectTo = getPageConfig("/")?.public ? "/" : "/sign-in"; // ルートが公開かチェック
      console.log(
        `[Auth Middleware] Unauthenticated access to protected route ${targetPath}. Redirecting to ${redirectTo}.`
      );
      // 無限ループ防止 (リダイレクト先が現在のパスと同じ場合は何もしない)
      if (targetPath !== redirectTo) {
        return navigateTo(redirectTo);
      }
      console.warn(
        `[Auth Middleware] Avoided redirect loop for unauthenticated user at ${targetPath}.`
      );
      return; // or handle appropriately, e.g., show 404 if pageConfig is undefined
    }
    // public: true のページ、または設定がないページ(404想定)へのアクセスは許可
    return;
  }

  // B. 認証済みユーザーの処理
  if (isAuthenticated) {
    // メール未認証ユーザーの処理
    if (auth.isEmailVerified === false) {
      if (targetPath === "/unconfirmedEmail") {
        return; // 既に unconfirmedEmail ページにいる場合は何もしない
      }
      console.log(
        `[Auth Middleware] Authenticated but unverified user accessing public route ${targetPath}. Redirecting to /unconfirmedEmail.`
      );
      return navigateTo("/unconfirmedEmail");
    }

    // ページ設定が存在し、かつ public: true の場合、ダッシュボードへ
    if (pageConfig?.public) {
      console.log(
        `[Auth Middleware] Authenticated user accessing public route ${targetPath}. Redirecting to /dashboard.`
      );
      // 無限ループ防止 (既に /dashboard にいる場合はリダイレクトしない)
      if (targetPath !== "/dashboard") {
        return navigateTo("/dashboard");
      }
      return;
    }

    // 非公開ページへのアクセスの場合、権限を確認 (isPageAllowed を使用)
    if (!isPageAllowed(targetPath, userRoles)) {
      // 権限がない場合、ダッシュボードへリダイレクト
      console.warn(
        `[Auth Middleware] User (Roles: ${userRoles.join(
          ", "
        )}) denied access to ${targetPath}. Redirecting to /dashboard.`
      );
      // 無限ループ防止
      if (targetPath !== "/dashboard") {
        return navigateTo("/dashboard");
      }
      return;
    }

    // 権限がある場合はアクセスを許可
    return;
  }
});
