import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import { SecurityReportIndex } from "@shisyamo4131/air-guard-v2-schemas";
import { fetchOperationDateAt } from "./fetchOperationDateAt.js";
import { parseSecurityReportPath } from "./parseSecurityReportPath.js";

/**
 * Storage の現在状態を基に、警備日報インデックスを同期する。
 * イベント回数の加減算は行わず、本体画像の絶対件数を保存する。
 *
 * @param {Object} options
 * @param {string} options.bucketName - Storage バケット名
 * @param {string} options.companyId - 会社ID
 * @param {string} options.operationId - 稼働ドキュメントID
 * @returns {Promise<number>} Storage に存在する警備日報本体の件数
 */
export async function syncSecurityReportIndex({
  bucketName,
  companyId,
  operationId,
}) {
  const bucket = getStorage().bucket(bucketName);
  const folderPath =
    `Companies/${companyId}/Operations/${operationId}/SecurityReports/`;
  const [files] = await bucket.getFiles({ prefix: folderPath });
  const reportCount = files.filter((file) => {
    const parsed = parseSecurityReportPath(file.name);
    return (
      parsed &&
      parsed.companyId === companyId &&
      parsed.operationId === operationId &&
      !parsed.isThumbnail
    );
  }).length;

  const prefix = `Companies/${companyId}`;
  const index = new SecurityReportIndex();
  const indexExists = await index.fetch({ docId: operationId, prefix });

  if (reportCount === 0) {
    if (indexExists) {
      await index.delete({ prefix });
    }
    logger.info("[securityReports] SecurityReportIndex synchronized.", {
      companyId,
      operationId,
      reportCount,
      action: indexExists ? "deleted" : "unchanged",
    });
    return reportCount;
  }

  const dateAt = await fetchOperationDateAt({ companyId, operationId });
  if (!dateAt) {
    if (indexExists) {
      await index.delete({ prefix });
    }
    logger.warn(
      "[securityReports] Related operation document was not found. " +
        "SecurityReportIndex was not saved.",
      { companyId, operationId, reportCount },
    );
    return reportCount;
  }

  index.dateAt = dateAt;
  index.reportCount = reportCount;
  if (indexExists) {
    await index.update({ prefix });
  } else {
    await index.create({ docId: operationId, prefix });
  }

  logger.info("[securityReports] SecurityReportIndex synchronized.", {
    companyId,
    operationId,
    reportCount,
    action: indexExists ? "updated" : "created",
  });
  return reportCount;
}
