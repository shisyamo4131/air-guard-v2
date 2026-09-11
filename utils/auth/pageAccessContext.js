function isSafeIdentifier(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

const SAFE_REDIRECT_PATH = "/dashboard";

export function createCurrentPageAccessGuardRunner({
  isAllowed,
  replace,
  reportError = () => {},
}) {
  let pendingRequest = null;
  let processing = false;

  async function processPendingRequests() {
    let failedRedirects = 0;
    try {
      await Promise.resolve();
      while (pendingRequest && failedRedirects < 2) {
        const request = pendingRequest;
        pendingRequest = null;
        const {
          isReady,
          path,
          accessContext,
          isCurrent,
          getIsReady = () => isReady,
          getAccessContext = () => accessContext,
        } = request.input;
        const currentAccessContext = getAccessContext();
        if (
          path === SAFE_REDIRECT_PATH ||
          getIsReady() !== true ||
          !isCurrent(path) ||
          isAllowed(path, currentAccessContext)
        ) {
          request.resolve(false);
          continue;
        }

        try {
          await replace(SAFE_REDIRECT_PATH);
          request.resolve(true);
          pendingRequest?.resolve(true);
          pendingRequest = null;
          return;
        } catch (error) {
          reportError(error);
          failedRedirects += 1;
          if (pendingRequest) {
            request.resolve(false);
          } else if (failedRedirects < 2) {
            pendingRequest = request;
          } else {
            request.resolve(false);
          }
        }
      }
    } finally {
      pendingRequest?.resolve(false);
      pendingRequest = null;
      processing = false;
    }
  }

  function evaluate(input) {
    return new Promise((resolve) => {
      pendingRequest?.resolve(false);
      pendingRequest = { input, resolve };
      if (!processing) {
        processing = true;
        void processPendingRequests();
      }
    });
  }

  return { evaluate };
}

/**
 * Auth Storeの現在値をpage access判定用の一つのcontextへ正規化します。
 * このclient contextは表示と遷移のUX gateであり、server認可を代替しません。
 */
export function buildPageAccessContext(auth) {
  const actorUid = isSafeIdentifier(auth?.uid) ? auth.uid : null;
  const companyId = isSafeIdentifier(auth?.companyId)
    ? auth.companyId
    : null;
  const actorUser = auth?.user ?? null;
  const presetRoles = Array.isArray(actorUser?.roles)
    ? actorUser.roles
    : null;
  const hasValidActorRoles = Boolean(
    Array.isArray(presetRoles) &&
      presetRoles.every(
        (role) =>
          typeof role === "string" &&
          role.length > 0 &&
          role.trim() === role &&
          !["admin", "super-user", "developer", "*"].includes(role),
      ),
  );
  const isSuperUserClaimValid =
    auth?.isSuperUserClaimValid === true &&
    typeof auth?.isSuperUser === "boolean";
  const isDeveloperClaimValid =
    auth?.isDeveloperClaimValid === true &&
    typeof auth?.isDeveloper === "boolean";

  const isRegisteredTenantActor = Boolean(
    auth?.isReady === true &&
      auth?.sessionInitializationFailed !== true &&
      actorUid &&
      companyId &&
      auth?.isEmailVerified === true &&
      isSuperUserClaimValid &&
      actorUser?.docId === actorUid &&
      actorUser?.companyId === companyId &&
      actorUser?.disabled === false &&
      actorUser?.isTemporary === false &&
      typeof actorUser?.isAdmin === "boolean" &&
      Array.isArray(presetRoles),
  );
  const isActiveRegisteredActor = Boolean(
    isRegisteredTenantActor && hasValidActorRoles,
  );

  return {
    isReady: auth?.isReady === true,
    sessionInitializationFailed:
      auth?.sessionInitializationFailed === true,
    isAuthenticated: actorUid !== null,
    isRegisteredTenantActor,
    isActiveRegisteredActor,
    actorUid,
    companyId,
    actorUser,
    presetRoles,
    isAdmin:
      typeof actorUser?.isAdmin === "boolean" ? actorUser.isAdmin : null,
    isSuperUser: auth?.isSuperUser === true,
    isSuperUserClaimValid,
    isDeveloper: auth?.isDeveloper === true,
    isDeveloperClaimValid,
    userRoles: Array.isArray(auth?.roles) ? auth.roles : [],
  };
}

/**
 * reactive再判定で利用するfieldだけを安定した値へ変換します。
 */
export function getPageAccessContextKey(auth) {
  return JSON.stringify([
    auth?.isReady === true,
    auth?.uid,
    auth?.companyId,
    auth?.isEmailVerified,
    auth?.isSuperUser,
    auth?.isSuperUserClaimValid,
    auth?.isDeveloper,
    auth?.isDeveloperClaimValid,
    auth?.sessionInitializationFailed,
    auth?.user?.docId,
    auth?.user?.companyId,
    auth?.user?.disabled,
    auth?.user?.isTemporary,
    auth?.user?.isAdmin,
    auth?.user?.roles,
  ]);
}
