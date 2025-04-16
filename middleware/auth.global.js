/**
 * グローバル認証ミドルウェア
 * Firebase Authentication の状態に応じてページ遷移を制御します。
 *
 * - Firebase の認証状態が確定するまで待機
 * - 認証が必要なページへ未認証でアクセス → `/sign-in` にリダイレクト
 * - 認証済みで `/sign-in` または `/sign-up` にアクセス → `/home` にリダイレクト
 *
 * Global authentication middleware.
 * This middleware handles route control based on Firebase Auth state.
 *
 * - Waits until Firebase auth state is ready
 * - Redirects unauthenticated users from protected pages to `/sign-in`
 * - Redirects authenticated users away from `/sign-in` or `/sign-up` to `/home`
 */

// List of routes that do not require authentication
const PUBLIC_ROUTES = ["/sign-in", "/sign-up", "/", "/test"];

// Checks whether the given path is a public route
function isPublicRoute(path) {
  return PUBLIC_ROUTES.includes(path);
}

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  await auth.waitUntilReady();

  const isAuthenticated = !!auth.uid;

  if (!isAuthenticated && !isPublicRoute(to.path)) {
    return navigateTo("/sign-in");
  }

  if (isAuthenticated && isPublicRoute(to.path)) {
    return navigateTo("/dashboard");
  }
});
