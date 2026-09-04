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

function authSnapshot(auth) {
  const user = auth.user;
  return Object.freeze({
    uid: auth.uid,
    companyId: auth.companyId,
    isSuperUser: auth.isSuperUser,
    isSuperUserClaimValid: auth.isSuperUserClaimValid,
    userDocId: user?.docId ?? null,
    userCompanyId: user?.companyId ?? null,
    userEmail: user?.email ?? null,
    isAdmin: user?.isAdmin ?? null,
    isTemporary: user?.isTemporary ?? null,
    disabled: user?.disabled ?? null,
    roles: Array.isArray(user?.roles) ? [...user.roles] : null,
  });
}

function authSnapshotsEqual(left, right) {
  if (!left || !right) return false;
  const scalarKeys = [
    "uid",
    "companyId",
    "isSuperUser",
    "isSuperUserClaimValid",
    "userDocId",
    "userCompanyId",
    "userEmail",
    "isAdmin",
    "isTemporary",
    "disabled",
  ];
  if (scalarKeys.some((key) => !Object.is(left[key], right[key]))) {
    return false;
  }
  if (!Array.isArray(left.roles) || !Array.isArray(right.roles)) {
    return left.roles === right.roles;
  }
  return (
    left.roles.length === right.roles.length &&
    left.roles.every((role, index) => role === right.roles[index])
  );
}

function permissionError() {
  return new CustomerArchiveUiError({
    code: "functions/permission-denied",
    message: "取引先をアーカイブする権限がありません。",
    outcomeUncertain: false,
  });
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
    getCurrentCustomer = () => customer,
    getCurrentReason = () => reason,
  }) {
    let customerId;
    let normalizedReason;
    try {
      customerId = normalizeCustomerArchiveCustomerId(customer?.docId);
      normalizedReason = normalizeCustomerArchiveReason(reason);
    } catch (error) {
      resetAttempt();
      throw toCustomerArchiveUiError(error);
    }
    const capturedAuth = authSnapshot(auth);

    return operationState.run(ARCHIVE_OPERATION, customerId, async () => {
      try {
        const currentAttempt = resolveAttempt(customerId, normalizedReason);
        const request = createCustomerArchiveRequest(currentAttempt);
        const currentDecision = getCustomerWriteDecision(authInput(auth));
        const currentCustomerId = normalizeCustomerArchiveCustomerId(
          getCurrentCustomer()?.docId,
        );
        const currentReason = normalizeCustomerArchiveReason(
          getCurrentReason(),
        );
        if (
          !currentDecision.allowed ||
          !authSnapshotsEqual(capturedAuth, authSnapshot(auth)) ||
          currentCustomerId !== customerId ||
          currentReason !== normalizedReason
        ) {
          throw permissionError();
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
    isPending,
    resetAttempt,
    writeDecision,
  };
}
