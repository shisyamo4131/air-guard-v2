import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  SITE_WRITE_OPERATION,
  SiteAuthorizationError,
  assertSiteWriteAllowed,
  getSiteWriteDecision,
} from "@/composables/domain/site/siteAuthorization";

const sharedSiteWriteState = Vue.reactive({ isSaving: false });

export function useSiteActions() {
  const auth = useAuthStore();
  const { $auth } = useNuxtApp();

  function authorizationContext() {
    return {
      authenticationUid: $auth?.currentUser?.uid,
      uid: auth.uid,
      companyId: auth.companyId,
      isEmailVerified: $auth?.currentUser?.emailVerified,
      isSuperUser: auth.isSuperUser,
      isSuperUserClaimValid: auth.isSuperUserClaimValid,
      user: auth.user,
    };
  }

  const writeDecision = Vue.computed(() =>
    getSiteWriteDecision(authorizationContext()),
  );
  const canWrite = Vue.computed(() => writeDecision.value.allowed);
  const isSaving = Vue.computed(() => sharedSiteWriteState.isSaving);

  function assertWritePermission() {
    // Always rebuild the context so a claim or User change that happened after
    // opening a dialog is observed immediately before the operation.
    assertSiteWriteAllowed(authorizationContext());
  }

  async function executeSiteWrite(operation, action) {
    if (!Object.values(SITE_WRITE_OPERATION).includes(operation)) {
      throw new SiteAuthorizationError(
        "invalid-operation",
        "現場の操作内容を確認してください。",
      );
    }
    if (typeof action !== "function") {
      throw new SiteAuthorizationError(
        "invalid-operation",
        "現場の保存処理を確認してください。",
      );
    }
    assertWritePermission();
    if (sharedSiteWriteState.isSaving) {
      throw new SiteAuthorizationError(
        "operation-in-progress",
        "現場情報を保存中です。",
      );
    }

    sharedSiteWriteState.isSaving = true;
    try {
      // Permission was checked immediately before entering the shared write
      // boundary. Every persistence action must execute inside this callback.
      return await action();
    } finally {
      sharedSiteWriteState.isSaving = false;
    }
  }

  async function rejectDirectDelete() {
    throw new SiteAuthorizationError(
      "operation-not-available",
      "現場は直接削除できません。",
    );
  }

  return {
    canWrite,
    isSaving,
    writeDecision,
    assertWritePermission,
    executeSiteWrite,
    rejectDirectDelete,
  };
}
