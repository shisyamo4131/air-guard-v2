import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { OperationResult } from "@shisyamo4131/air-guard-v2-schemas";
import { fetchDailyAttendancesRelatedOperationResult } from "./fetchDailyAttendancesRelatedOperationResult.js";
import { addOperationResultToDailyAttendances } from "./addOperationResultToDailyAttendances.js";
import { removeOperationResultFromDailyAttendances } from "./removeOperationResultFromDailyAttendances.js";
import { saveDailyAttendances } from "./saveDailyAttendances.js";

/*****************************************************************************
 * OperationResult ドキュメントの変更内容をもとに、DailyAttendance ドキュメントを
 * 作成・更新・削除します。
 * DailyAttendance ドキュメントへの反映にはトランザクションが使用されます。
 * @param {Object} options
 * @param {string} options.companyId - 対象の会社ID
 * @param {Object} options.beforeData - 変更前の OperationResult ドキュメントデータ
 * @param {Object} options.afterData - 変更後の OperationResult ドキュメントデータ
 * @returns {Promise<void>}
 * @throws {Error} companyId が提供されていない場合、または beforeData と afterData の両方が null の場合にエラーをスローします。
 *****************************************************************************/
export async function syncOperationResultToDailyAttendances({
  companyId,
  beforeData,
  afterData,
} = {}) {
  logger.info("'syncOperationResultToDailyAttendances' is called", {
    companyId,
    beforeData,
    afterData,
  });

  // companyId がない場合はエラー
  if (!companyId) throw new Error("companyId is required");

  // beforeData と afterData の両方が null の場合はエラー
  if (!beforeData && !afterData) {
    throw new Error("Either beforeData or afterData must be provided");
  }

  const isCreate = !beforeData && afterData;
  const isUpdate = beforeData && afterData;
  const isDelete = beforeData && !afterData;

  await getFirestore().runTransaction(async (transaction) => {
    // OperationResult 作成時の処理
    if (isCreate) {
      const instance = new OperationResult(afterData);
      const attendances = await fetchDailyAttendancesRelatedOperationResult({
        companyId,
        operationResult: instance,
        transaction,
      });
      addOperationResultToDailyAttendances({
        attendances,
        operationResult: instance,
      });
      await saveDailyAttendances({ companyId, attendances, transaction });
      return;
    }

    // OperationResult 更新時の処理
    if (isUpdate) {
      // 変更前後の OperationResult に紐づく DailyAttendance を取得
      const beforeInstance = new OperationResult(beforeData);
      const afterInstance = new OperationResult(afterData);
      const beforeAttendances =
        await fetchDailyAttendancesRelatedOperationResult({
          companyId,
          operationResult: beforeInstance,
          transaction,
        });
      const afterAttendances =
        await fetchDailyAttendancesRelatedOperationResult({
          companyId,
          operationResult: afterInstance,
          transaction,
        });

      // 取得した DailyAttendance インスタンスについて重複を排除した Map を作成
      const attendancesMap = new Map();
      beforeAttendances.forEach(({ instance, exists }) => {
        attendancesMap.set(instance.docId, { instance, exists });
      });
      afterAttendances.forEach(({ instance, exists }) => {
        attendancesMap.set(instance.docId, { instance, exists });
      });

      const attendances = Array.from(attendancesMap.values());
      removeOperationResultFromDailyAttendances({
        attendances,
        operationResult: beforeInstance,
      });

      addOperationResultToDailyAttendances({
        attendances,
        operationResult: afterInstance,
      });

      await saveDailyAttendances({ companyId, attendances, transaction });
      return;
    }

    // OperationResult 削除時の処理
    if (isDelete) {
      const instance = new OperationResult(beforeData);
      const attendances = await fetchDailyAttendancesRelatedOperationResult({
        companyId,
        operationResult: instance,
        transaction,
      });
      removeOperationResultFromDailyAttendances({
        attendances,
        operationResult: instance,
      });
      await saveDailyAttendances({ companyId, attendances, transaction });
      return;
    }
  });
}
