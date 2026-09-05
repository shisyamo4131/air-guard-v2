import { canReadSite } from "./siteReadAuthorization.js";

function identityKey(context) {
  return typeof context?.uid === "string" && context.uid &&
    typeof context?.companyId === "string" && context.companyId
    ? `${context.companyId}/${context.uid}`
    : null;
}

function hasListenableIdentity(context) {
  return identityKey(context) !== null && context.isEmailVerified === true;
}

function hasCompleteLocalUser(context) {
  const { user } = context;
  return Boolean(
    user &&
      user.docId === context.uid &&
      user.companyId === context.companyId &&
      typeof user.isTemporary === "boolean" &&
      typeof user.disabled === "boolean",
  );
}

export function createSiteDetailAccessSession({ listenToUser, onAccessChanged }) {
  let generation = 0;
  let currentIdentity = null;
  let unsubscribe = null;
  let revoked = false;
  let allowed = false;

  function publish(nextAllowed) {
    if (allowed === nextAllowed) return;
    allowed = nextAllowed;
    onAccessChanged(nextAllowed);
  }

  function stopListener() {
    generation += 1;
    unsubscribe?.();
    unsubscribe = null;
  }

  function revoke() {
    revoked = true;
    stopListener();
    publish(false);
  }

  function start(context) {
    const nextIdentity = identityKey(context);
    if (!nextIdentity) {
      currentIdentity = null;
      revoked = false;
      stopListener();
      publish(false);
      return;
    }

    if (nextIdentity !== currentIdentity) {
      stopListener();
      currentIdentity = nextIdentity;
      revoked = false;
      publish(false);
    }
    if (revoked) return;
    if (!hasListenableIdentity(context)) {
      if (unsubscribe || allowed) revoke();
      else publish(false);
      return;
    }
    if (hasCompleteLocalUser(context) && !canReadSite(context)) {
      revoke();
      return;
    }
    if (unsubscribe) return;

    const listenerGeneration = ++generation;
    let stop;
    try {
      stop = listenToUser(context, {
        next(snapshotUser) {
          if (listenerGeneration !== generation || revoked) return;
          if (!canReadSite({ ...context, user: snapshotUser })) {
            revoke();
            return;
          }
          publish(true);
        },
        error() {
          if (listenerGeneration === generation) revoke();
        },
      });
    } catch {
      if (listenerGeneration === generation) revoke();
      return;
    }
    if (listenerGeneration === generation && !revoked) unsubscribe = stop;
    else stop?.();
  }

  function dispose() {
    currentIdentity = null;
    revoked = true;
    stopListener();
    publish(false);
  }

  return { dispose, start };
}

export function createSiteDetailReadSession({ clearProtectedReads }) {
  let generation = 0;
  let routeId = null;
  let allowed = false;
  let disposed = false;

  function invalidate() {
    generation += 1;
    clearProtectedReads();
  }

  function begin(nextRouteId) {
    invalidate();
    routeId = nextRouteId;
    allowed = true;
    const requestGeneration = generation;
    return {
      isCurrent: () =>
        !disposed && allowed && generation === requestGeneration && routeId === nextRouteId,
    };
  }

  function revoke() {
    allowed = false;
    routeId = null;
    invalidate();
  }

  function refreshDate(refresh) {
    if (!disposed && allowed && routeId) refresh(routeId);
  }

  function dispose() {
    disposed = true;
    revoke();
  }

  return { begin, dispose, refreshDate, revoke };
}

export function createSiteEmployeeCache({ cache, getScopeKey, loadEmployee }) {
  let generation = 0;
  const requests = new Map();

  function clear() {
    generation += 1;
    requests.clear();
    Object.keys(cache).forEach((key) => { delete cache[key]; });
  }

  async function fetchEmployee(source) {
    const employeeId = typeof source === "string"
      ? source
      : source?.employeeId || source?.docId || source?.workerId;
    const scopeKey = getScopeKey();
    if (!employeeId || !scopeKey) return null;
    if (cache[employeeId]) return cache[employeeId];

    const requestGeneration = generation;
    const requestKey = `${requestGeneration}:${employeeId}`;
    if (requests.has(requestKey)) return await requests.get(requestKey);
    const request = Promise.resolve().then(() => loadEmployee(employeeId));
    requests.set(requestKey, request);
    try {
      const employee = await request;
      if (
        generation === requestGeneration &&
        scopeKey === getScopeKey() &&
        employee?.docId === employeeId
      ) {
        cache[employeeId] = employee;
      }
      return cache[employeeId] ?? null;
    } catch {
      return null;
    } finally {
      if (requests.get(requestKey) === request) requests.delete(requestKey);
    }
  }

  return { clear, fetchEmployee };
}
