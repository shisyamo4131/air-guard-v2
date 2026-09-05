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
  SITE_ADDRESS_FIELDS,
  SITE_OPERATION,
  SiteOperationError,
  changedSiteFields,
  prepareSiteCreate,
} from "@/composables/domain/site/siteOperations";
import { createSiteWriter } from "@/utils/site/siteWriter";
import { useSiteFunctions } from "@/composables/site/useSiteFunctions";

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
  const { $auth, $firestore } = useNuxtApp();
  const writer = createSiteWriter({ firestore: $firestore });
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

  async function createSite(draft) {
    return await executeSiteWrite(SITE_WRITE_OPERATION.CREATE, async () => {
      const companyId = auth.companyId;
      const actorUid = auth.uid;
      const documentReference = writer.reserveDocument(companyId);
      const site = await prepareSiteCreate({
        draft,
        docId: documentReference.id,
        actorUid,
        now: new Date(),
      });
      assertIdentityUnchanged(companyId, actorUid);
      return await writer.create({
        documentReference,
        companyId,
        site,
        assertCanWrite: () => assertIdentityUnchanged(companyId, actorUid),
      });
    });
  }

  async function prepareLocation({ operation, latest, baseline, draft }) {
    if (operation !== SITE_OPERATION.UPDATE_BASIC) return undefined;
    const fields = changedSiteFields({ operation, baseline, draft });
    if (!fields.some((field) => SITE_ADDRESS_FIELDS.includes(field))) {
      return undefined;
    }
    const source = typeof latest === "function" ? latest() : latest;
    if (!(source instanceof Site) || !source.docId) {
      throw new SiteOperationError("not-found", "現場の最新情報を確認できません。");
    }
    const candidate = new Site(source.toObject());
    Object.assign(
      candidate,
      Object.fromEntries(fields.map((field) => [field, draft[field]])),
    );
    // The injected geocoder is an external side effect and must execute once,
    // outside the Firestore transaction callback that may be retried.
    await candidate.beforeUpdate();
    return {
      location: candidate.location,
      basis: Object.fromEntries(
        SITE_ADDRESS_FIELDS.map((field) => [field, candidate[field]]),
      ),
    };
  }

  async function updateSite({ operation, latest, baseline, draft }) {
    const writeOperation = operation === SITE_OPERATION.UPDATE_CUSTOMER
      ? SITE_WRITE_OPERATION.CUSTOMER
      : SITE_WRITE_OPERATION.UPDATE;
    return await executeSiteWrite(writeOperation, async () => {
      const companyId = auth.companyId;
      const actorUid = auth.uid;
      const source = typeof latest === "function" ? latest() : latest;
      if (!(source instanceof Site) || !source.docId) {
        throw new SiteOperationError("not-found", "現場の最新情報を確認できません。");
      }
      if (source.status !== "ACTIVE") {
        throw new SiteOperationError(
          "invalid-state",
          "終了済み現場の通常情報は変更できません。",
        );
      }
      const locationPreparation = await prepareLocation({
        operation,
        latest,
        baseline,
        draft,
      });
      assertIdentityUnchanged(companyId, actorUid);
      return await writer.update({
        companyId,
        operation,
        docId: source.docId,
        baseline,
        draft,
        actorUid,
        locationPreparation,
        assertCanWrite: () => assertIdentityUnchanged(companyId, actorUid),
      });
    });
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
      return await writer.updateAgreements({
        companyId,
        docId: source.docId,
        baseline,
        agreements,
        actorUid,
        assertCanWrite: () => assertIdentityUnchanged(companyId, actorUid),
      });
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
    createSite,
    isSaving,
    writeDecision,
    assertWritePermission,
    executeSiteWrite,
    rejectDirectDelete,
    reactivate,
    terminate,
    updateAgreements,
    updateBasic: (args) =>
      updateSite({ ...args, operation: SITE_OPERATION.UPDATE_BASIC }),
    updateCustomer: (args) =>
      updateSite({ ...args, operation: SITE_OPERATION.UPDATE_CUSTOMER }),
  };
}
