import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSiteFunctions } from "@/composables/site/useSiteFunctions";
import { useOperationState } from "@/composables/useOperationState";
import { getSiteArchiveDecision } from "@/composables/domain/site/siteAuthorization";
import { runWithSiteWriteMutex } from "@/composables/application/site/useSiteActions";
import {
  SiteArchiveUiError,
  createSiteArchiveOperationId,
  createSiteArchiveRequest,
  isSiteArchiveSuccess,
  normalizeSiteArchiveReason,
  normalizeSiteArchiveSiteId,
  siteArchiveMalformedResponseError,
  toSiteArchiveUiError,
} from "@/composables/domain/site/siteArchiveUiContract";

const OPERATION = "archive-site";

function authInput(auth, firebaseAuth) {
  return {
    authenticationUid: auth.authenticationUid ?? firebaseAuth?.currentUser?.uid,
    uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser,
    isEmailVerified: auth.isEmailVerified ?? firebaseAuth?.currentUser?.emailVerified,
    isSuperUserClaimValid: auth.isSuperUserClaimValid, user: auth.user,
  };
}

function authSnapshot(auth, firebaseAuth) {
  const user = auth.user;
  return Object.freeze({
    authenticationUid: auth.authenticationUid ?? firebaseAuth?.currentUser?.uid,
    uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser,
    isEmailVerified: auth.isEmailVerified ?? firebaseAuth?.currentUser?.emailVerified,
    isSuperUserClaimValid: auth.isSuperUserClaimValid, userDocId: user?.docId ?? null,
    userCompanyId: user?.companyId ?? null, userEmail: user?.email ?? null,
    isAdmin: user?.isAdmin ?? null, isTemporary: user?.isTemporary ?? null,
    disabled: user?.disabled ?? null, roles: Array.isArray(user?.roles) ? [...user.roles] : null,
  });
}

function sameAuth(left, right) {
  if (!left || !right) return false;
  const scalar = ["authenticationUid", "uid", "companyId", "isEmailVerified",
    "isSuperUser", "isSuperUserClaimValid", "userDocId",
    "userCompanyId", "userEmail", "isAdmin", "isTemporary", "disabled"];
  if (scalar.some((key) => !Object.is(left[key], right[key]))) return false;
  if (!Array.isArray(left.roles) || !Array.isArray(right.roles)) return left.roles === right.roles;
  return left.roles.length === right.roles.length &&
    left.roles.every((role, index) => role === right.roles[index]);
}

function permissionError() {
  return new SiteArchiveUiError({
    code: "functions/permission-denied",
    message: "現場をアーカイブする権限がありません。",
    outcomeUncertain: false,
  });
}

export function useSiteArchiveAction(options = {}) {
  const auth = options.auth ?? useAuthStore();
  const firebaseAuth =
    options.firebaseAuth ??
    (typeof useNuxtApp === "function" ? useNuxtApp().$auth : null);
  const transport = options.transport ?? useSiteFunctions();
  const operationState = options.operationState ?? useOperationState();
  const createOperationId = options.createOperationId ?? createSiteArchiveOperationId;
  const attempt = Vue.shallowRef(null);
  const writeDecision = Vue.computed(() => getSiteArchiveDecision(authInput(auth, firebaseAuth)));
  const canArchive = Vue.computed(() => writeDecision.value.allowed);

  function resetAttempt() { attempt.value = null; }

  function resolveAttempt(siteId, reason) {
    if (attempt.value?.siteId === siteId && attempt.value?.reason === reason) return attempt.value;
    attempt.value = Object.freeze({ siteId, reason, operationId: createOperationId() });
    return attempt.value;
  }

  function archive({ site, reason, getCurrentSite = () => site, getCurrentReason = () => reason }) {
    let siteId;
    let normalizedReason;
    try {
      siteId = normalizeSiteArchiveSiteId(site?.docId);
      normalizedReason = normalizeSiteArchiveReason(reason);
    } catch (error) {
      resetAttempt();
      throw toSiteArchiveUiError(error);
    }
    const capturedAuth = authSnapshot(auth, firebaseAuth);
    return operationState.run(OPERATION, siteId, async () => {
      try {
        return await runWithSiteWriteMutex(async () => {
          const request = createSiteArchiveRequest(resolveAttempt(siteId, normalizedReason));
          const currentDecision = getSiteArchiveDecision(authInput(auth, firebaseAuth));
          const currentSite = getCurrentSite();
          if (!currentDecision.allowed || !sameAuth(capturedAuth, authSnapshot(auth, firebaseAuth)) ||
              (currentSite != null &&
                normalizeSiteArchiveSiteId(currentSite.docId) !== siteId) ||
              normalizeSiteArchiveReason(getCurrentReason()) !== normalizedReason) {
            throw permissionError();
          }
          const result = await transport.archiveSite(request);
          if (!isSiteArchiveSuccess(result)) throw siteArchiveMalformedResponseError();
          resetAttempt();
          return result;
        });
      } catch (error) {
        const safe = toSiteArchiveUiError(error);
        if (!safe.outcomeUncertain) resetAttempt();
        throw safe;
      }
    });
  }

  return {
    archive,
    attemptId: Vue.computed(() => attempt.value?.operationId ?? null),
    canArchive,
    isPending: (siteId) => typeof siteId === "string" && siteId.length > 0 &&
      operationState.isPending(OPERATION, siteId),
    resetAttempt,
    writeDecision,
  };
}
