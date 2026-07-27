import { getStorage } from "firebase-admin/storage";
import { SecurityReportIndex } from "@shisyamo4131/air-guard-v2-schemas";
import { parseSecurityReportPath } from "./parseSecurityReportPath.js";
import { syncSecurityReportIndex } from "./syncSecurityReportIndex.js";

/** 同時に同期するoperationIdの最大数 */
const SYNC_BATCH_SIZE = 20;

/**
 * 指定された会社の警備日報インデックスをStorageの現在状態から再構築する。
 *
 * Storageに存在するoperationIdと既存インデックスのoperationIdを対象にすることで、
 * 新規作成・更新に加えて、Storageに本体画像が存在しないインデックスも削除する。
 *
 * @param {string} companyId - 会社ID
 * @returns {Promise<{
 *   processedCount: number,
 *   indexedCount: number
 * }>}
 */
export async function rebuildSecurityReportIndexes(companyId) {
  if (!companyId || typeof companyId !== "string") {
    throw new Error("companyId is required");
  }

  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({
    prefix: `Companies/${companyId}/Operations/`,
  });

  const operationIds = new Set();
  for (const file of files) {
    const parsed = parseSecurityReportPath(file.name);
    if (
      parsed &&
      parsed.companyId === companyId &&
      !parsed.isThumbnail
    ) {
      operationIds.add(parsed.operationId);
    }
  }

  const prefix = `Companies/${companyId}`;
  const index = new SecurityReportIndex();
  const existingIndexes = await index.fetchDocs({ prefix });
  for (const existingIndex of existingIndexes) {
    operationIds.add(existingIndex.docId);
  }

  const ids = [...operationIds];
  for (let offset = 0; offset < ids.length; offset += SYNC_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + SYNC_BATCH_SIZE);
    await Promise.all(
      batch.map((operationId) =>
        syncSecurityReportIndex({
          bucketName: bucket.name,
          companyId,
          operationId,
        }),
      ),
    );
  }

  const rebuiltIndexes = await index.fetchDocs({ prefix });
  return {
    processedCount: ids.length,
    indexedCount: rebuiltIndexes.length,
  };
}
