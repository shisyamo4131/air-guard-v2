import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  SITE_WRITE_OPERATION,
  SiteAuthorizationError,
  assertSiteWriteAllowed,
  getSiteWriteDecision,
} from "@/composables/domain/site/siteAuthorization";
import { Site } from "@/schemas";
import {
  SiteOperationError,
} from "@/composables/domain/site/siteOperations";
import { useSiteFunctions } from "@/composables/site/useSiteFunctions";
import {
  createSiteAgreementUpdateRequest,
  isSiteAgreementUpdateResult,
} from "@/composables/domain/site/siteAgreementContract";

const sharedSiteWriteState = Vue.reactive({ isSaving: false });

export async function runWithSiteWriteMutex(action) {
  if (typeof action !== "function") {
    throw new SiteAuthorizationError(
      "invalid-operation",
      "現場の保存処理を確認してください。",
    );
  }
  if (sharedSiteWriteState.isSaving) {
    throw new SiteAuthorizationError(
      "operation-in-progress",
      "現場情報を保存中です。",
    );
  }

  sharedSiteWriteState.isSaving = true;
  try {
    return await action();
  } finally {
    sharedSiteWriteState.isSaving = false;
  }
}

export function useSiteActions() {
  const auth = useAuthStore();
  const { $auth } = useNuxtApp();
  const siteFunctions = useSiteFunctions();

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
    return await runWithSiteWriteMutex(async () => {
      // Permission was checked immediately before entering the shared write
      // boundary. Every persistence action must execute inside this callback.
      return await action();
    });
  }

  async function rejectDirectDelete() {
    throw new SiteAuthorizationError(
      "operation-not-available",
      "現場は直接削除できません。",
    );
  }

  function assertIdentityUnchanged(companyId, actorUid) {
    assertWritePermission();
    if (auth.companyId !== companyId || auth.uid !== actorUid) {
      throw new SiteOperationError(
        "permission-denied",
        "現場を変更する権限を確認できません。",
      );
    }
  }

  async function updateAgreements({ latest, baseline, agreements }) {
    return await executeSiteWrite(SITE_WRITE_OPERATION.AGREEMENT, async () => {
      const companyId = auth.companyId;
      const actorUid = auth.uid;
      const source = typeof latest === "function" ? latest() : latest;
      if (!(source instanceof Site) || !source.docId) {
        throw new SiteOperationError("not-found", "現場の最新情報を確認できません。");
      }
      if (source.status !== "ACTIVE") {
        throw new SiteOperationError(
          "invalid-state",
          "終了済み現場の取極めは変更できません。",
        );
      }
      assertIdentityUnchanged(companyId, actorUid);
      const request = createSiteAgreementUpdateRequest({
        siteId: source.docId,
        baselineAgreements: baseline?.agreementsV2,
        candidateAgreements: agreements,
      });
      let response;
      try {
        // Recheck immediately before the network send. The Callable performs
        // the authoritative actor, maintenance, status, and baseline checks.
        assertIdentityUnchanged(companyId, actorUid);
        response = await siteFunctions.updateSiteAgreements(request);
      } catch (error) {
        const code = typeof error?.code === "string"
          ? error.code.replace(/^functions\//u, "")
          : "";
        if (code === "aborted") {
          throw new SiteOperationError(
            "conflict",
            "取極めが別の画面で更新されました。入力内容を保持したまま最新値を確認してください。",
          );
        }
        if (code === "permission-denied") {
          throw new SiteOperationError("permission-denied", "取極めを変更する権限がありません。");
        }
        if (code === "failed-precondition") {
          throw new SiteOperationError("invalid-state", "現場の状態を確認してください。");
        }
        if (code === "invalid-argument") {
          throw new SiteOperationError("invalid-agreement", "取極めの入力内容を確認してください。");
        }
        throw error;
      }
      if (!isSiteAgreementUpdateResult(response)) {
        throw new SiteOperationError("invalid-response", "取極めの保存結果を確認できません。");
      }
      const candidate = new Site({
        ...source.toObject(),
        // Rebuild the same canonical Agreement model shape as the Callable.
        // The transport projection intentionally represents date as YYYY-MM-DD.
        agreementsV2: request.candidateAgreements.map((agreement) => ({
          ...agreement,
          dateAt: new Date(`${agreement.date}T00:00:00+09:00`),
        })),
      });
      return {
        candidate,
        fields: response.updated ? ["agreementsV2"] : [],
        updated: response.updated,
      };
    });
  }

  async function terminate({ siteId, reason }) {
    return await executeSiteWrite(SITE_WRITE_OPERATION.TERMINATE, async () => {
      assertWritePermission();
      return await siteFunctions.terminateSite({ siteId, reason });
    });
  }

  async function reactivate({
    siteId,
    reason,
    constructionPeriodStartDate,
    constructionPeriodEndDate,
  }) {
    return await executeSiteWrite(SITE_WRITE_OPERATION.TERMINATE, async () => {
      assertWritePermission();
      return await siteFunctions.reactivateSite({
        siteId,
        reason,
        constructionPeriodStartDate,
        constructionPeriodEndDate,
      });
    });
  }

  return {
    canWrite,
    isSaving,
    writeDecision,
    assertWritePermission,
    executeSiteWrite,
    rejectDirectDelete,
    reactivate,
    terminate,
    updateAgreements,
  };
}
