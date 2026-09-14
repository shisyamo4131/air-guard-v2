import { OperationResult, OperationResultDetail } from "@/schemas";
import { rawForClass } from "@/composables/domain/shared/valueContract";
import { doc, runTransaction } from "firebase/firestore";

function requireResult(result) {
  if (!(result instanceof OperationResult) || !result.docId) {
    throw new Error("稼働実績を取得できません。");
  }
  if (result.isLocked) {
    throw new Error("編集ロック中の実績は編集できません。");
  }
}

function workerIdentity(item) {
  const before = item?._beforeData || item;
  return {
    isEmployee: before?.isEmployee === true,
    workerId: before?.workerId,
  };
}

export function useOperationResultWriter(result) {
  const { $firestore } = useNuxtApp();
  const auth = useAuthStore();

  function candidate() {
    requireResult(result.value);
    return new OperationResult(rawForClass(result.value));
  }

  async function updateOverview(draft) {
    requireResult(draft);
    return await draft.update();
  }

  async function persistWorkerCandidate(next) {
    const beforeEmployeeIds = new Set(result.value.employeeIds || []);
    const addedEmployeeIds = (next.employeeIds || []).filter(
      (id) => !beforeEmployeeIds.has(id),
    );

    if (addedEmployeeIds.length === 0) return await next.update();

    return await runTransaction($firestore, async (transaction) => {
      for (const employeeId of addedEmployeeIds) {
        const reference = doc(
          $firestore,
          `Companies/${auth.companyId}/Employees/${employeeId}`,
        );
        if (!(await transaction.get(reference)).exists()) {
          throw new Error("選択した従業員が存在しません。");
        }
      }
      return await next.update({ transaction });
    });
  }

  async function createWorker(item) {
    const next = candidate();
    next.addWorker(rawForClass(item), -1);
    return await persistWorkerCandidate(next);
  }

  async function updateWorker(item) {
    const next = candidate();
    const identity = workerIdentity(item);
    const collection = identity.isEmployee ? next.employees : next.outsourcers;
    const index = collection.findIndex(
      (worker) => worker.workerId === identity.workerId,
    );
    if (index < 0) throw new Error("編集対象の作業員が見つかりません。");
    collection[index] = new OperationResultDetail(rawForClass(item));
    return await persistWorkerCandidate(next);
  }

  async function deleteWorker(item) {
    const next = candidate();
    const identity = workerIdentity(item);
    next.removeWorker(identity);
    return await persistWorkerCandidate(next);
  }

  return { createWorker, deleteWorker, updateOverview, updateWorker };
}
