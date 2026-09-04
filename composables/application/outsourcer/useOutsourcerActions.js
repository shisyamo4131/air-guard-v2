import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import {
  OUTSOURCER_MUTATIONS,
  evaluateOutsourcerMutation,
} from "@/utils/auth/policies/outsourcerMutationPolicy";
import {
  OutsourcerOperationError,
  hasOutsourcerOperationConflict,
  prepareOutsourcerCreate,
} from "@/composables/domain/outsourcer/outsourcerOperations";
import { createOutsourcerWriter } from "@/utils/outsourcer/outsourcerWriter";

export function useOutsourcerActions() {
  const auth = useAuthStore();
  const logger = useLogger("useOutsourcerActions", useErrorsStore());
  const { $firestore } = useNuxtApp();
  const writer = createOutsourcerWriter({ firestore: $firestore });
  const isSaving = Vue.ref(false);

  function mutationDecision(operation) {
    return evaluateOutsourcerMutation({
      operation,
      uid: auth.uid,
      companyId: auth.companyId,
      isSuperUser: auth.isSuperUser,
      isSuperUserClaimValid: auth.isSuperUserClaimValid,
      actorUser: auth.user,
    });
  }

  const canWrite = Vue.computed(
    () => mutationDecision(OUTSOURCER_MUTATIONS.UPDATE).allowed,
  );

  function assertWritePermission(operation) {
    const decision = mutationDecision(operation);
    if (!decision.allowed) {
      throw new OutsourcerOperationError("permission-denied", decision.message);
    }
  }

  function assertWriteAllowed(operation) {
    assertWritePermission(operation);
    if (isSaving.value) {
      throw new OutsourcerOperationError(
        "operation-in-progress",
        "外注先情報を保存中です。",
      );
    }
  }

  async function createOutsourcer(draft) {
    const operation = OUTSOURCER_MUTATIONS.CREATE;
    assertWriteAllowed(operation);
    isSaving.value = true;
    try {
      const companyId = auth.companyId;
      const actorUid = auth.uid;
      const documentReference = writer.reserveDocument(companyId);
      const outsourcer = await prepareOutsourcerCreate({
        draft,
        docId: documentReference.id,
        actorUid,
        now: new Date(),
      });
      assertWritePermission(operation);
      if (auth.uid !== actorUid || auth.companyId !== companyId) {
        throw new OutsourcerOperationError(
          "permission-denied",
          "外注先を変更する権限を確認できません。",
        );
      }
      await writer.create({ documentReference, outsourcer });
      return outsourcer;
    } catch (error) {
      if (!(error instanceof OutsourcerOperationError)) {
        logger.error({ message: "Outsourcer create failed" });
      }
      throw error;
    } finally {
      isSaving.value = false;
    }
  }

  async function updateOutsourcer({ latest, baseline, draft }) {
    const operation = OUTSOURCER_MUTATIONS.UPDATE;
    assertWriteAllowed(operation);
    isSaving.value = true;
    try {
      const companyId = auth.companyId;
      const actorUid = auth.uid;
      const current = typeof latest === "function" ? latest() : latest;
      if (!current?.docId || hasOutsourcerOperationConflict({ baseline, latest: current, draft })) {
        throw new OutsourcerOperationError(
          "conflict",
          "別の画面で同じ外注先情報が更新されました。最新情報を読み直してください。",
        );
      }
      assertWritePermission(operation);
      if (auth.uid !== actorUid || auth.companyId !== companyId) {
        throw new OutsourcerOperationError(
          "permission-denied",
          "外注先を変更する権限を確認できません。",
        );
      }
      return await writer.update({
        companyId,
        docId: current.docId,
        baseline,
        draft,
        actorUid,
        assertCanWrite: () => {
          assertWritePermission(operation);
          if (auth.uid !== actorUid || auth.companyId !== companyId) {
            throw new OutsourcerOperationError(
              "permission-denied",
              "外注先を変更する権限を確認できません。",
            );
          }
        },
      });
    } catch (error) {
      if (!(error instanceof OutsourcerOperationError)) {
        logger.error({ message: "Outsourcer update failed" });
      }
      throw error;
    } finally {
      isSaving.value = false;
    }
  }

  return {
    canWrite,
    createOutsourcer,
    isSaving: Vue.readonly(isSaving),
    updateOutsourcer,
  };
}
