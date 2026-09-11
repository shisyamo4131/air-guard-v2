import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCustomerFunctions } from "@/composables/customer/useCustomerFunctions";
import { useOperationState } from "@/composables/useOperationState";
import { getCustomerWriteDecision } from "@/composables/domain/customer/customerOperations";
import {
  CustomerArchiveUiError,
  createCustomerArchiveOperationId,
  createCustomerArchiveRequest,
  customerArchiveMalformedResponseError,
  isCustomerArchiveSuccess,
  normalizeCustomerArchiveCustomerId,
  normalizeCustomerArchiveReason,
  toCustomerArchiveUiError,
} from "@/composables/domain/customer/customerArchiveUiContract";

const ARCHIVE_OPERATION = "archive-customer";

function authInput(auth) {
  return {
    uid: auth.uid,
    companyId: auth.companyId,
    isSuperUser: auth.isSuperUser,
    isSuperUserClaimValid: auth.isSuperUserClaimValid,
    user: auth.user,
  };
}

function changedRequestError() {
  return new CustomerArchiveUiError({
    code: "functions/invalid-argument",
    message: "操作対象またはログイン状態が変更されました。内容を確認してください。",
    outcomeUncertain: false,
  });
}

function normalizeArchiveScope(scope) {
  if (
    !scope ||
    typeof scope !== "object" ||
    Array.isArray(scope) ||
    typeof scope.companyId !== "string" ||
    !scope.companyId ||
    typeof scope.uid !== "string" ||
    !scope.uid
  ) {
    throw changedRequestError();
  }
  return Object.freeze({ companyId: scope.companyId, uid: scope.uid });
}

function isArchiveScopeCurrent(scope, auth) {
  return scope.companyId === auth.companyId && scope.uid === auth.uid;
}

export function useCustomerArchiveAction(options = {}) {
  const auth = options.auth ?? useAuthStore();
  const transport = options.transport ?? useCustomerFunctions();
  const operationState = options.operationState ?? useOperationState();
  const createOperationId =
    options.createOperationId ?? createCustomerArchiveOperationId;
  const attempt = Vue.shallowRef(null);

  const writeDecision = Vue.computed(() =>
    getCustomerWriteDecision(authInput(auth)),
  );
  const canArchive = Vue.computed(() => writeDecision.value.allowed);

  function captureScope() {
    return Object.freeze({ companyId: auth.companyId, uid: auth.uid });
  }

  function resetAttempt() {
    attempt.value = null;
  }

  function resolveAttempt(customerId, reason) {
    if (
      attempt.value?.customerId === customerId &&
      attempt.value?.reason === reason
    ) {
      return attempt.value;
    }
    const next = Object.freeze({
      customerId,
      reason,
      operationId: createOperationId(),
    });
    attempt.value = next;
    return next;
  }

  function archive({
    customer,
    reason,
    scope,
    getCurrentCustomer = () => customer,
    getCurrentReason = () => reason,
  }) {
    let customerId;
    let normalizedReason;
    let archiveScope;
    try {
      customerId = normalizeCustomerArchiveCustomerId(customer?.docId);
      normalizedReason = normalizeCustomerArchiveReason(reason);
      archiveScope = normalizeArchiveScope(scope);
    } catch (error) {
      resetAttempt();
      throw toCustomerArchiveUiError(error);
    }
    return operationState.run(ARCHIVE_OPERATION, customerId, async () => {
      try {
        const currentAttempt = resolveAttempt(customerId, normalizedReason);
        const request = createCustomerArchiveRequest(currentAttempt);
        const currentCustomerId = normalizeCustomerArchiveCustomerId(
          getCurrentCustomer()?.docId,
        );
        const currentReason = normalizeCustomerArchiveReason(
          getCurrentReason(),
        );
        if (
          !isArchiveScopeCurrent(archiveScope, auth) ||
          currentCustomerId !== customerId ||
          currentReason !== normalizedReason
        ) {
          throw changedRequestError();
        }

        const result = await transport.archiveCustomer(request);
        if (!isCustomerArchiveSuccess(result)) {
          throw customerArchiveMalformedResponseError();
        }
        resetAttempt();
        return result;
      } catch (error) {
        const safeError = toCustomerArchiveUiError(error);
        if (!safeError.outcomeUncertain) resetAttempt();
        throw safeError;
      }
    });
  }

  function isPending(customerId) {
    if (typeof customerId !== "string" || !customerId) return false;
    return operationState.isPending(ARCHIVE_OPERATION, customerId);
  }

  return {
    archive,
    attemptId: Vue.computed(() => attempt.value?.operationId ?? null),
    canArchive,
    captureScope,
    isPending,
    resetAttempt,
    writeDecision,
  };
}
