import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  DailyOperationByEmployee,
  OperationResult,
} from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * OperationResult.docIdをoperationResultIdsに含む
 * DailyOperationByEmployeeドキュメントを取得します。
 *
 * @param {Object} options
 * @param {string} options.companyId
 * @param {OperationResult} options.operationResult
 * @param {Transaction} options.transaction
 * @returns {Promise<Array<{
 *   instance: DailyOperationByEmployee,
 *   exists: boolean,
 * }>>}
 *****************************************************************************/
export async function fetchDailyOperationsByEmployeeRelatedOperationResult({
  companyId,
  operationResult,
  transaction,
} = {}) {
  logger.info(
    "'fetchDailyOperationsByEmployeeRelatedOperationResult' is called",
    {
      companyId,
      operationResultId: operationResult?.docId ?? "not provided",
    },
  );

  if (!companyId) throw new Error("companyId is required");
  if (!operationResult || !(operationResult instanceof OperationResult)) {
    throw new Error("Invalid operationResult provided");
  }
  if (!transaction) throw new Error("transaction is required");

  const query = getFirestore()
    .collection(
      `Companies/${companyId}/${DailyOperationByEmployee.collectionPath}`,
    )
    .where("operationResultIds", "array-contains", operationResult.docId);
  const snapshot = await transaction.get(query);

  return snapshot.docs.map((doc) => ({
    instance: new DailyOperationByEmployee({
      ...doc.data(),
      docId: doc.id,
    }),
    exists: true,
  }));
}
