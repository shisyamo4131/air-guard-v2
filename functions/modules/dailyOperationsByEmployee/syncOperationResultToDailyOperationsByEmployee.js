import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { OperationResult } from "@shisyamo4131/air-guard-v2-schemas";
import { fetchDailyOperationsByEmployeeRelatedOperationResult } from "./fetchDailyOperationsByEmployeeRelatedOperationResult.js";
import { fetchDailyOperationsByEmployeeTargets } from "./fetchDailyOperationsByEmployeeTargets.js";
import { removeOperationResultFromDailyOperationsByEmployee } from "./removeOperationResultFromDailyOperationsByEmployee.js";
import { addOperationResultToDailyOperationsByEmployee } from "./addOperationResultToDailyOperationsByEmployee.js";
import { saveDailyOperationsByEmployee } from "./saveDailyOperationsByEmployee.js";

/*****************************************************************************
 * OperationResultの作成・更新・削除をDailyOperationsByEmployeeへ反映します。
 *
 * 既存の配置先はoperationResultIdsのarray-containsで逆引きし、対象の
 * OperationResultをすべて取り除いてから、変更後の従業員・稼働日へ再配置します。
 *
 * @param {Object} options
 * @param {string} options.companyId
 * @param {Object|null} options.beforeData
 * @param {Object|null} options.afterData
 * @returns {Promise<void>}
 *****************************************************************************/
export async function syncOperationResultToDailyOperationsByEmployee({
  companyId,
  beforeData,
  afterData,
} = {}) {
  logger.info("'syncOperationResultToDailyOperationsByEmployee' is called", {
    companyId,
    operationResultId:
      afterData?.docId ?? beforeData?.docId ?? "not provided",
  });

  if (!companyId) throw new Error("companyId is required");
  if (!beforeData && !afterData) {
    throw new Error("Either beforeData or afterData must be provided");
  }

  const beforeInstance = beforeData ? new OperationResult(beforeData) : null;
  const afterInstance = afterData ? new OperationResult(afterData) : null;
  const lookupInstance = beforeInstance ?? afterInstance;

  await getFirestore().runTransaction(async (transaction) => {
    const relatedDailyOperations =
      await fetchDailyOperationsByEmployeeRelatedOperationResult({
        companyId,
        operationResult: lookupInstance,
        transaction,
      });
    const dailyOperationsMap = new Map(
      relatedDailyOperations.map((item) => [item.instance.docId, item]),
    );

    // Firestoreトランザクションでは、すべての読み取りを先に完了させます。
    if (afterInstance) {
      await fetchDailyOperationsByEmployeeTargets({
        companyId,
        operationResult: afterInstance,
        transaction,
        dailyOperationsMap,
      });
    }

    const dailyOperations = Array.from(dailyOperationsMap.values());
    removeOperationResultFromDailyOperationsByEmployee({
      dailyOperations,
      operationResult: lookupInstance,
    });

    if (afterInstance) {
      addOperationResultToDailyOperationsByEmployee({
        dailyOperations,
        operationResult: afterInstance,
      });
    }

    await saveDailyOperationsByEmployee({
      companyId,
      dailyOperations,
      transaction,
    });
  });
}
