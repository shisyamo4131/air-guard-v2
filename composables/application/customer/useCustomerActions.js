import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import {
  CustomerOperationError,
  getCustomerWriteDecision,
  prepareCustomerCreate,
  prepareCustomerUpdate,
} from "@/composables/domain/customer/customerOperations";
import { createCustomerWriter } from "@/utils/customer/customerWriter";

export function useCustomerActions() {
  const auth = useAuthStore();
  const logger = useLogger("useCustomerActions", useErrorsStore());
  const { $firestore } = useNuxtApp();
  const writer = createCustomerWriter({ firestore: $firestore });
  const isSaving = Vue.ref(false);

  const writeDecision = Vue.computed(() =>
    getCustomerWriteDecision({
      uid: auth.uid,
      companyId: auth.companyId,
      isSuperUser: auth.isSuperUser,
      isSuperUserClaimValid: auth.isSuperUserClaimValid,
      user: auth.user,
    }),
  );
  const canWrite = Vue.computed(() => writeDecision.value.allowed);

  function assertWritePermission() {
    const decision = writeDecision.value;
    if (!decision.allowed) {
      throw new CustomerOperationError("permission-denied", decision.reason);
    }
  }

  function assertWriteAllowed() {
    assertWritePermission();
    if (isSaving.value) {
      throw new CustomerOperationError(
        "operation-in-progress",
        "取引先情報を保存中です。",
      );
    }
  }

  async function createCustomer(draft) {
    assertWriteAllowed();
    isSaving.value = true;
    try {
      const documentReference = writer.reserveDocument(auth.companyId);
      const customer = await prepareCustomerCreate({
        draft,
        docId: documentReference.id,
        actorUid: auth.uid,
        now: new Date(),
      });
      await writer.create({ documentReference, customer });
      return customer;
    } catch (error) {
      if (!(error instanceof CustomerOperationError)) {
        logger.error({ message: "Customer create failed" });
      }
      throw error;
    } finally {
      isSaving.value = false;
    }
  }

  async function updateCustomer({ latest, draft }) {
    assertWriteAllowed();
    isSaving.value = true;
    try {
      const companyId = auth.companyId;
      const actorUid = auth.uid;
      const getLatest = () => typeof latest === "function" ? latest() : latest;
      const source = getLatest();
      const prepared = await prepareCustomerUpdate({
        latest: source,
        draft,
        actorUid,
        now: new Date(),
      });
      assertWritePermission();
      if (auth.uid !== actorUid || auth.companyId !== companyId) {
        throw new CustomerOperationError(
          "permission-denied",
          "取引先を変更する権限を確認できません。",
        );
      }
      const current = getLatest();
      if (!current?.docId || current.docId !== prepared.candidate.docId) {
        throw new CustomerOperationError(
          "invalid-customer",
          "取引先の最新情報を確認できません。",
        );
      }
      return await writer.update({
        companyId,
        customer: prepared.candidate,
      });
    } catch (error) {
      if (error instanceof CustomerOperationError) throw error;
      console.error("[useCustomerActions] CUSTOMER_UPDATE_FAILED");
      throw new CustomerOperationError(
        "update-failed",
        "取引先情報を更新できませんでした。",
      );
    } finally {
      isSaving.value = false;
    }
  }

  return {
    canWrite,
    createCustomer,
    isSaving: Vue.readonly(isSaving),
    updateCustomer,
    writeDecision,
  };
}
