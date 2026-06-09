import { OperationResult } from "@shisyamo4131/air-guard-v2-schemas";
import { fetchDailyAttendances } from "./fetchDailyAttendances.js";
import { addOperationResultToDailyAttendances } from "./addOperationResultToDailyAttendances.js";
import { removeOperationResultFromDailyAttendances } from "./removeOperationResultFromDailyAttendances.js";
import { saveDailyAttendances } from "./saveDailyAttendances.js";

/*****************************************************************************
 * OperationResult ドキュメントの変更内容をもとに、DailyAttendance ドキュメントを
 * 作成・更新・削除します。
 * @param {Object} options
 * @param {string} options.companyId
 * @param {Object} options.beforeData
 * @param {Object} options.afterData
 * @param {Object} options.transaction
 * @returns {Promise<void>}
 *****************************************************************************/
export async function syncOperationResultToDailyAttendances({
  companyId,
  beforeData,
  afterData,
  transaction = null,
} = {}) {
  const isCreate = !beforeData && afterData;
  const isUpdate = beforeData && afterData;
  const isDelete = beforeData && !afterData;

  // OperationResult 作成時の処理
  if (isCreate) {
    const instance = new OperationResult(afterData);
    const attendances = await fetchDailyAttendances({
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
    const beforeAttendances = await fetchDailyAttendances({
      companyId,
      operationResult: beforeInstance,
      transaction,
    });
    const afterAttendances = await fetchDailyAttendances({
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
    const attendances = await fetchDailyAttendances({
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
}
