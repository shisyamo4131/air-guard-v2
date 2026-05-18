/**
 * @file utils/storage.js
 * @description Firebase Storage に関するユーティリティー関数を提供します。
 *
 * ## 設計方針
 * - Firestore ドキュメントへの URL 保存は行いません。ファイル取得は Storage の listAll() で行います。
 * - ファイル名は crypto.randomUUID() で生成した UUID を使用し、競合を回避します。
 * - customMetadata に uploadedBy（UID）を含めます。
 * - サムネイルは Cloud Functions が自動生成します（ファイル名: `${uuid}_thumb.jpg`）。
 */

import imageCompression from "browser-image-compression";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
  getMetadata,
} from "firebase/storage";

/** アップロード時の圧縮オプション */
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

/**
 * 警備日報の写真を Storage にアップロードします。
 *
 * @param {import('firebase/storage').FirebaseStorage} storage - Storage インスタンス
 * @param {string} companyId - テナントの会社 ID
 * @param {string} scheduleId - SiteOperationSchedule の docId
 * @param {File} file - アップロードするファイル
 * @param {string} userId - アップロードするユーザーの UID
 * @returns {Promise<import('firebase/storage').StorageReference>} アップロードされたファイルの StorageReference
 * @throws {Error} 圧縮またはアップロードに失敗した場合
 */
export async function uploadSecurityReport(
  storage,
  companyId,
  scheduleId,
  file,
  userId,
) {
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  const uuid = crypto.randomUUID();
  const fileRef = ref(
    storage,
    `Companies/${companyId}/SiteOperationSchedules/${scheduleId}/SecurityReports/${uuid}.jpg`,
  );
  await uploadBytes(fileRef, compressed, {
    customMetadata: { uploadedBy: userId },
  });
  return fileRef;
}

/**
 * 指定した現場稼働の警備日報ファイル一覧を取得します。
 * - サムネイル（`_thumb` を含むファイル）は除外します。
 * - 作成日時（timeCreated）の昇順で返します。
 *
 * @param {import('firebase/storage').FirebaseStorage} storage - Storage インスタンス
 * @param {string} companyId - テナントの会社 ID
 * @param {string} scheduleId - SiteOperationSchedule の docId
 * @returns {Promise<Array<{ref: import('firebase/storage').StorageReference, url: string, thumbUrl: string|null, timeCreated: string}>>}
 * @throws {Error} ファイル一覧の取得に失敗した場合
 */
export async function listSecurityReports(storage, companyId, scheduleId) {
  const folderRef = ref(
    storage,
    `Companies/${companyId}/SiteOperationSchedules/${scheduleId}/SecurityReports`,
  );
  const { items } = await listAll(folderRef);

  // サムネイルを除外して本体ファイルのみ抽出
  const reportRefs = items.filter((item) => !item.name.includes("_thumb"));

  // 各ファイルのメタデータ・URL・サムネイルURLを並行取得
  const reports = await Promise.all(
    reportRefs.map(async (fileRef) => {
      const [metadata, url] = await Promise.all([
        getMetadata(fileRef),
        getDownloadURL(fileRef),
      ]);

      // サムネイルのパスを uuid_thumb.jpg として計算
      const thumbName = fileRef.name.replace(/\.jpg$/, "_thumb.jpg");
      const thumbRef = ref(
        storage,
        `Companies/${companyId}/SiteOperationSchedules/${scheduleId}/SecurityReports/${thumbName}`,
      );
      let thumbUrl = null;
      try {
        thumbUrl = await getDownloadURL(thumbRef);
      } catch {
        // サムネイルがまだ生成されていない場合は null のまま
      }

      return {
        ref: fileRef,
        url,
        thumbUrl,
        timeCreated: metadata.timeCreated,
      };
    }),
  );

  // 作成日時の昇順でソート
  return reports.sort(
    (a, b) => new Date(a.timeCreated) - new Date(b.timeCreated),
  );
}

/**
 * 警備日報ファイルを削除します（本体 + サムネイルを同時に削除）。
 * - companyId は fileRef のパスから自動的に解決されるため、引数として不要です。
 *
 * @param {import('firebase/storage').StorageReference} fileRef - 削除対象の本体ファイルの StorageReference
 * @returns {Promise<void>}
 * @throws {Error} 削除に失敗した場合
 */
export async function deleteSecurityReport(fileRef) {
  const thumbName = fileRef.name.replace(/\.jpg$/, "_thumb.jpg");
  const thumbRef = ref(
    fileRef.storage,
    `${fileRef.parent.fullPath}/${thumbName}`,
  );

  // 本体とサムネイルを並行削除（サムネイルが存在しない場合はエラーを無視）
  await Promise.all([
    deleteObject(fileRef),
    deleteObject(thumbRef).catch(() => {}),
  ]);
}
