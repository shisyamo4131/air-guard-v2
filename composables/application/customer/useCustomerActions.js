import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import {
  CUSTOMER_OPERATION,
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

  function assertWriteAllowed() {
    const decision = writeDecision.value;
    if (!decision.allowed) {
      throw new CustomerOperationError("permission-denied", decision.reason);
    }
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

  async function updateCustomer({ operation, latest, baseline, draft }) {
    assertWriteAllowed();
    isSaving.value = true;
    try {
      const prepared = await prepareCustomerUpdate({
        operation,
        latest,
        baseline,
        draft,
        actorUid: auth.uid,
        now: new Date(),
      });
      return await writer.update({
        companyId: auth.companyId,
        operation,
        customer: prepared.candidate,
        fields: prepared.fields,
      });
    } catch (error) {
      if (!(error instanceof CustomerOperationError)) {
        logger.error({ message: "Customer update failed" });
      }
      throw error;
    } finally {
      isSaving.value = false;
    }
  }

  return {
    canWrite,
    createCustomer,
    isSaving: Vue.readonly(isSaving),
    updateBasic: (args) =>
      updateCustomer({ ...args, operation: CUSTOMER_OPERATION.UPDATE_BASIC }),
    updatePayment: (args) =>
      updateCustomer({ ...args, operation: CUSTOMER_OPERATION.UPDATE_PAYMENT }),
    writeDecision,
  };
}
