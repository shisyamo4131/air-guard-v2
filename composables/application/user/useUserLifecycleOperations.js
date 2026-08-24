/*****************************************************************************
 * @file ./composables/application/user/useUserLifecycleOperations.js
 * @description UWB-07 lifecycle Callableと対象単位pending状態を提供します。
 *****************************************************************************/
import { useAuthFunctions } from "../../auth/useAuthFunctions";
import { useOperationState } from "../../useOperationState";

function createOperationId() {
  const operationId = globalThis.crypto?.randomUUID?.();
  if (typeof operationId !== "string") {
    throw new Error("安全なoperation IDを生成できません。");
  }
  return operationId.toLowerCase();
}

export function useUserLifecycleOperations() {
  const {
    deleteStandaloneRegisteredUser,
    getEmployeeReinstatementContext,
    reinstateEmployee,
    terminateEmployee,
  } = useAuthFunctions();
  const { run, isPending, hasPending } = useOperationState();

  function retire({ employeeId, terminationDate, reasonOfTermination }) {
    return run("retire-employee", employeeId, () =>
      terminateEmployee({
        operationId: createOperationId(),
        employeeId,
        terminationDate,
        reasonOfTermination,
      }),
    );
  }

  function removeStandaloneRegisteredUser({ targetUserId, reason }) {
    return run("delete-registered-user", targetUserId, () =>
      deleteStandaloneRegisteredUser({
        operationId: createOperationId(),
        targetUserId,
        reason,
      }),
    );
  }

  function loadReinstatementContext(employeeId) {
    return run("load-reinstatement-context", employeeId, () =>
      getEmployeeReinstatementContext({ employeeId }),
    );
  }

  function reinstate({ employeeId, reversesOperationId }) {
    return run("reinstate-employee", employeeId, () =>
      reinstateEmployee({
        operationId: createOperationId(),
        employeeId,
        reversesOperationId,
        correctionReasonCode: "MISTAKEN_RETIREMENT",
      }),
    );
  }

  return {
    hasPending,
    isPending,
    loadReinstatementContext,
    reinstate,
    removeStandaloneRegisteredUser,
    retire,
  };
}
