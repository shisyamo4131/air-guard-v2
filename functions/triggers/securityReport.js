/*****************************************************************************
 * @file ./triggers/securityReport.js
 * @description 警備日報写真のサムネイル・検索用インデックス管理トリガー
 *
 * ## トリガー条件
 * - Storage パス: Companies/{companyId}/Operations/{operationId}/SecurityReports/{uuid}.jpg
 * - サムネイル自体（{uuid}_thumb.jpg）は処理しない。
 *****************************************************************************/
import {
  onObjectDeleted,
  onObjectFinalized,
} from "firebase-functions/v2/storage";
import {
  createSecurityReportThumbnail,
  parseSecurityReportPath,
  syncSecurityReportIndex,
} from "../modules/securityReport/index.js";

/**
 * Storage に警備日報本体がアップロードされた際に、
 * 検索用インデックスを同期してサムネイルを生成する。
 */
export const onSecurityReportUploaded = onObjectFinalized(
  { region: "asia-northeast1" },
  async (event) => {
    const parsed = parseSecurityReportPath(event.data.name);
    if (!parsed || parsed.isThumbnail) return;

    await syncSecurityReportIndex({
      bucketName: event.data.bucket,
      companyId: parsed.companyId,
      operationId: parsed.operationId,
    });

    await createSecurityReportThumbnail({
      bucketName: event.data.bucket,
      filePath: event.data.name,
      fileName: parsed.fileName,
    });
  },
);

/**
 * Storage から警備日報本体が削除された際に検索用インデックスを同期する。
 */
export const onSecurityReportDeleted = onObjectDeleted(
  { region: "asia-northeast1" },
  async (event) => {
    const parsed = parseSecurityReportPath(event.data.name);
    if (!parsed || parsed.isThumbnail) return;

    await syncSecurityReportIndex({
      bucketName: event.data.bucket,
      companyId: parsed.companyId,
      operationId: parsed.operationId,
    });
  },
);
