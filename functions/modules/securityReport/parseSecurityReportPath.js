/** セキュリティレポートのパスパターン */
const SECURITY_REPORT_PATH_RE =
  /^Companies\/([^/]+)\/Operations\/([^/]+)\/SecurityReports\/([^/]+\.jpg)$/;

/**
 * Storage パスを警備日報のパス情報へ変換する。
 *
 * @param {string} filePath - Storage のファイルパス
 * @returns {{
 *   companyId: string,
 *   operationId: string,
 *   fileName: string,
 *   isThumbnail: boolean
 * }|null}
 */
export function parseSecurityReportPath(filePath) {
  const match = filePath?.match(SECURITY_REPORT_PATH_RE);
  if (!match) return null;

  const [, companyId, operationId, fileName] = match;
  return {
    companyId,
    operationId,
    fileName,
    isThumbnail: fileName.endsWith("_thumb.jpg"),
  };
}
