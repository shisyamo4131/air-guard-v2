/*****************************************************************************
 * @file ./modules/operationCleanup.js
 * @description 稼働ドキュメント削除時の連鎖クリーンアップトリガー
 *
 * ## 処理概要
 * SiteOperationSchedule および OperationResult ドキュメントが削除された際に、
 * 紐づく警備日報（Storage）および関連ドキュメントを連鎖削除する。
 *
 * ## 削除ロジック
 *
 * ### SiteOperationSchedule.onDelete
 * - operationResultId === null（実績未作成）の場合のみ、
 *   Operations/{docId}/SecurityReports/ 配下のファイルを全削除する。
 * - operationResultId !== null（実績作成済み）の場合は何もしない。
 *   日報は OperationResult のライフサイクルに委ねる。
 *
 * ### OperationResult.onDelete
 * - Operations/{docId}/SecurityReports/ 配下のファイルを全削除する。
 * - siteOperationScheduleId が存在する場合は、対応する SiteOperationSchedule を削除する。
 *   （存在しない場合は無視）
 *   この削除により SiteOperationSchedule.onDelete が発火するが、
 *   その時点で operationResultId !== null のため日報削除はスキップされる（冪等）。
 *****************************************************************************/
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

/**
 * Storage の指定パス配下にあるファイルをすべて削除する。
 * ファイルが存在しない場合はエラーにならずスキップする。
 *
 * @param {string} folderPath - 削除対象フォルダの Storage パス
 * @returns {Promise<number>} 削除したファイル数
 */
async function deleteStorageFolder(folderPath) {
  const storage = getStorage();
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({ prefix: folderPath });

  if (files.length === 0) {
    logger.info(`[operationCleanup] No files found at: ${folderPath}`);
    return 0;
  }

  await Promise.all(
    files.map((file) =>
      file.delete().catch((e) => {
        // 既に削除済みの場合は無視
        if (e.code === 404) return;
        throw e;
      }),
    ),
  );

  logger.info(
    `[operationCleanup] Deleted ${files.length} file(s) at: ${folderPath}`,
  );
  return files.length;
}

/**
 * SiteOperationSchedule ドキュメント削除トリガー
 *
 * - operationResultId === null の場合のみ警備日報を削除する。
 * - operationResultId !== null の場合は日報を保持する（OperationResult 側が管理）。
 */
export const onSiteOperationScheduleDeleted = onDocumentDeleted(
  {
    document: "Companies/{companyId}/SiteOperationSchedules/{docId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const { companyId, docId } = event.params;
    const data = event.data.data();

    logger.info(
      `[operationCleanup] SiteOperationSchedule deleted: ${docId} (company: ${companyId})`,
    );

    // 実績作成済みの場合は日報を削除しない
    if (data?.operationResultId) {
      logger.info(
        `[operationCleanup] operationResultId exists (${data.operationResultId}), skipping SecurityReports deletion.`,
      );
      return;
    }

    // 実績未作成の場合は日報を削除する
    const folderPath = `Companies/${companyId}/Operations/${docId}/SecurityReports/`;
    await deleteStorageFolder(folderPath);
  },
);

/**
 * OperationResult ドキュメント削除トリガー
 *
 * - Operations/{docId}/SecurityReports/ 配下の警備日報を全削除する。
 * - siteOperationScheduleId が存在する場合は対応する SiteOperationSchedule を削除する。
 */
export const onOperationResultDeleted = onDocumentDeleted(
  {
    document: "Companies/{companyId}/OperationResults/{docId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const { companyId, docId } = event.params;
    const data = event.data.data();

    logger.info(
      `[operationCleanup] OperationResult deleted: ${docId} (company: ${companyId})`,
    );

    // 警備日報を全削除
    const folderPath = `Companies/${companyId}/Operations/${docId}/SecurityReports/`;
    await deleteStorageFolder(folderPath);

    // ベースとなった SiteOperationSchedule を削除
    const scheduleId = data?.siteOperationScheduleId;
    if (!scheduleId) {
      logger.info(
        `[operationCleanup] No siteOperationScheduleId, skipping SiteOperationSchedule deletion.`,
      );
      return;
    }

    const db = getFirestore();
    const scheduleRef = db.doc(
      `Companies/${companyId}/SiteOperationSchedules/${scheduleId}`,
    );
    const scheduleSnap = await scheduleRef.get();

    if (!scheduleSnap.exists) {
      logger.info(
        `[operationCleanup] SiteOperationSchedule ${scheduleId} not found, skipping.`,
      );
      return;
    }

    await scheduleRef.delete();
    logger.info(
      `[operationCleanup] Deleted SiteOperationSchedule: ${scheduleId}`,
    );
  },
);
