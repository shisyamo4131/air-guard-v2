import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { syncOperationResultProjections } from "../modules/operations/syncOperationResultProjections.js";

const LOGGABLE_ERROR_CODES = new Set([
  "cancelled", "unknown", "invalid-argument", "deadline-exceeded", "not-found",
  "already-exists", "permission-denied", "resource-exhausted", "failed-precondition",
  "aborted", "out-of-range", "unimplemented", "internal", "unavailable", "data-loss",
  "unauthenticated",
]);

function loggableErrorCode(error) {
  return LOGGABLE_ERROR_CODES.has(error?.code) ? error.code : "unknown";
}

/*****************************************************************************
 * OperationResult ドキュメントの作成・更新・削除トリガー
 *****************************************************************************/
export const onOperationResultChange = onDocumentWritten(
  "Companies/{companyId}/OperationResults/{docId}",
  async (event) => {
    const { companyId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    logger.info("OperationResult changed", {
      companyId,
      docId: after?.docId || before?.docId,
      operation: !before ? "created" : !after ? "deleted" : "updated",
      beforeBillingDate: before?.billingDate,
      afterBillingDate: after?.billingDate,
    });

    try {
      await syncOperationResultProjections({
        companyId,
        before,
        after,
        onProjectionFailure: ({ projection, error }) => logger.error(
          "OperationResult projection failed",
          {
            companyId,
            docId: after?.docId || before?.docId,
            projection,
            errorCode: loggableErrorCode(error),
          },
        ),
      });
    } catch (error) {
      logger.error("Failed to process OperationResult change", {
        companyId,
        docId: after?.docId || before?.docId,
        projections: Array.isArray(error?.projections) ? error.projections : [],
      });
      throw error;
    }
  },
);
