import {
  OperationResult,
  SiteOperationSchedule,
} from "@shisyamo4131/air-guard-v2-schemas";

/**
 * 対応する稼働ドキュメントから稼働日を取得する。
 * OperationResult を優先し、存在しない場合は SiteOperationSchedule を参照する。
 *
 * @param {Object} options
 * @param {string} options.companyId - 会社ID
 * @param {string} options.operationId - 稼働ドキュメントID
 * @returns {Promise<Date|null>}
 */
export async function fetchOperationDateAt({ companyId, operationId }) {
  const prefix = `Companies/${companyId}`;

  const operationResult = new OperationResult();
  const operationResultExists = await operationResult.fetch({
    docId: operationId,
    prefix,
  });
  if (operationResultExists) return operationResult.dateAt;

  const schedule = new SiteOperationSchedule();
  const scheduleExists = await schedule.fetch({
    docId: operationId,
    prefix,
  });
  return scheduleExists ? schedule.dateAt : null;
}
