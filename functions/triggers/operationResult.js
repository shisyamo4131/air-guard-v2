import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { syncOperationResultToDailyAttendances } from "../modules/dailyAttendances/index.js";
import {
  removeOperationResultFromBilling,
  addOperationResultToBilling,
  syncOperationResultToBilling,
} from "../modules/billings/index.js";
import { rebuildHistories } from "../modules/siteEmployeeHistories/rebuildHistories.js";

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
      // OperationResult ドキュメントが削除された時の処理
      if (!after) {
        // 1. Billing ドキュメントへの反映
        await removeOperationResultFromBilling({
          companyId,
          operationResult: before,
        });
        // 2. Attendance ドキュメントへの反映
        await syncOperationResultToDailyAttendances({
          companyId,
          beforeData: before,
          afterData: null,
        });
        // 3. SiteEmployeeHistories ドキュメントの再構築
        await rebuildHistories(companyId, before.siteId, before.employeeIds);
      }
      // OperationResult ドキュメントが作成された時の処理
      else if (!before) {
        // 1. Billing ドキュメントへの反映
        await addOperationResultToBilling({ companyId, doc: after });
        // 2. Attendance ドキュメントへの反映
        await syncOperationResultToDailyAttendances({
          companyId,
          beforeData: null,
          afterData: after,
        });
        // 3. SiteEmployeeHistories ドキュメントの再構築
        await rebuildHistories(companyId, after.siteId, after.employeeIds);
      }
      // OperationResult ドキュメントが更新された時の処理
      else {
        // 1. Billing ドキュメントへの反映
        await syncOperationResultToBilling({ companyId, before, after });
        // 2. Attendance ドキュメントへの反映
        await syncOperationResultToDailyAttendances({
          companyId,
          beforeData: before,
          afterData: after,
        });
        // 3. SiteEmployeeHistories ドキュメントの再構築
        const employeeIds = [...before.employeeIds, ...after.employeeIds]; // before/after の和集合（重複は rebuildHistories() 内で除外）
        if (before.siteId !== after.siteId || before.date !== after.date) {
          await rebuildHistories(companyId, before.siteId, employeeIds);
        }
        await rebuildHistories(companyId, after.siteId, employeeIds);
      }
    } catch (error) {
      logger.error("Failed to process OperationResult change", {
        companyId,
        docId: after?.docId || before?.docId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
);
