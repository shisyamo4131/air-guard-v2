/**
 * @file utils/storage.js
 * @description Firebase Storage に関するユーティリティー関数を提供します。
 *
 * ## 設計方針
 * - Firestore ドキュメントへの URL 保存は行いません。ファイル取得は Storage の listAll() で行います。
 * - ファイル名は crypto.randomUUID() で生成した UUID を使用し、競合を回避します。
 * - customMetadata に uploadedBy（UID）を含めます。
 * - サムネイルは Cloud Functions が自動生成します（ファイル名: `${uuid}_thumb.jpg`）。
 * - $storage・companyId・uid は内部で useNuxtApp() / useAuthStore() から取得します。
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
import { useAuthStore } from "@/stores/useAuthStore";

/** アップロード時の圧縮オプション */
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

const isDev = process.env.NODE_ENV === "development";
const log = (...args) => isDev && console.log("[storage.js]", ...args);

/**
 * 内部で $storage・companyId・uid を取得する。
 * いずれかが未初期化の場合は明示的なエラーを投げる。
 */
function getContext() {
  const { $storage } = useNuxtApp();
  if (!$storage)
    throw new Error(
      "[storage.js] $storage が初期化されていません。Firebase の初期化が完了しているか確認してください。",
    );

  const auth = useAuthStore();
  if (!auth.companyId)
    throw new Error(
      "[storage.js] companyId が取得できません。認証が完了しているか確認してください。",
    );
  if (!auth.uid)
    throw new Error(
      "[storage.js] uid が取得できません。認証が完了しているか確認してください。",
    );

  return { storage: $storage, companyId: auth.companyId, uid: auth.uid };
}

/**
 * 警備日報の写真を Storage にアップロードします。
 *
 * @param {string} operationId - SiteOperationSchedule または OperationResult の docId
 * @param {File} file - アップロードするファイル
 * @returns {Promise<import('firebase/storage').StorageReference>} アップロードされたファイルの StorageReference
 * @throws {Error} 圧縮またはアップロードに失敗した場合
 */
export async function uploadSecurityReport(operationId, file) {
  const { storage, companyId, uid } = getContext();
  log(`uploadSecurityReport: start`, {
    companyId,
    operationId,
    uid,
    fileName: file.name,
    fileSize: file.size,
  });
  let compressed;
  try {
    compressed = await imageCompression(file, COMPRESSION_OPTIONS);
    log(`uploadSecurityReport: compressed`, {
      originalSize: file.size,
      compressedSize: compressed.size,
    });
  } catch (e) {
    console.error(`[storage.js] uploadSecurityReport: 圧縮失敗`, e);
    throw new Error(`画像圧縮に失敗しました: ${e.message}`);
  }

  // crypto.randomUUID() はセキュアコンテキスト(HTTPS/localhost)必須のため、
  // HTTP接続（実機ローカル検証など）では crypto.getRandomValues() にフォールバックする
  const uuid =
    crypto.randomUUID?.() ??
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  const fileRef = ref(
    storage,
    `Companies/${companyId}/Operations/${operationId}/SecurityReports/${uuid}.jpg`,
  );
  log(`uploadSecurityReport: uploading to`, fileRef.fullPath);
  try {
    await uploadBytes(fileRef, compressed, {
      customMetadata: { uploadedBy: uid },
    });
  } catch (e) {
    console.error(`[storage.js] uploadSecurityReport: アップロード失敗`, e);
    throw new Error(`アップロードに失敗しました: ${e.message}`);
  }
  log(`uploadSecurityReport: done`, fileRef.fullPath);
  return fileRef;
}

/**
 * 指定した現場稼働の警備日報ファイル一覧を取得します。
 * - サムネイル（`_thumb` を含むファイル）は除外します。
 * - 作成日時（timeCreated）の昇順で返します。
 *
 * @param {string} operationId - SiteOperationSchedule または OperationResult の docId
 * @returns {Promise<Array<{ref: import('firebase/storage').StorageReference, url: string, thumbUrl: string|null, timeCreated: string}>>}
 * @throws {Error} ファイル一覧の取得に失敗した場合
 */
export async function listSecurityReports(operationId) {
  const { storage, companyId } = getContext();
  log(`listSecurityReports: start`, { companyId, operationId });
  const folderRef = ref(
    storage,
    `Companies/${companyId}/Operations/${operationId}/SecurityReports`,
  );
  const { items } = await listAll(folderRef);
  log(`listSecurityReports: total items in folder`, items.length);

  // サムネイルを除外して本体ファイルのみ抽出
  const reportRefs = items.filter((item) => !item.name.includes("_thumb"));
  log(`listSecurityReports: report files (excl. thumbs)`, reportRefs.length);

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
        `Companies/${companyId}/Operations/${operationId}/SecurityReports/${thumbName}`,
      );
      let thumbUrl = null;
      try {
        thumbUrl = await getDownloadURL(thumbRef);
        log(`listSecurityReports: thumb found for`, fileRef.name);
      } catch {
        // サムネイルがまだ生成されていない場合は null のまま
        log(`listSecurityReports: thumb not yet available for`, fileRef.name);
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
  const sorted = reports.sort(
    (a, b) => new Date(a.timeCreated) - new Date(b.timeCreated),
  );
  log(`listSecurityReports: done`, sorted.length, "files");
  return sorted;
}

/**
 * 警備日報ファイルを削除します（本体 + サムネイルを同時に削除）。
 *
 * @param {import('firebase/storage').StorageReference} fileRef - 削除対象の本体ファイルの StorageReference
 * @returns {Promise<void>}
 * @throws {Error} 削除に失敗した場合
 */
export async function deleteSecurityReport(fileRef) {
  if (!fileRef) throw new Error("[storage.js] fileRef が指定されていません。");
  log(`deleteSecurityReport: start`, fileRef.fullPath);
  const thumbName = fileRef.name.replace(/\.jpg$/, "_thumb.jpg");
  const thumbRef = ref(
    fileRef.storage,
    `${fileRef.parent.fullPath}/${thumbName}`,
  );

  // 本体とサムネイルを並行削除（サムネイルが存在しない場合はエラーを無視）
  await Promise.all([
    deleteObject(fileRef),
    deleteObject(thumbRef).catch((e) => {
      log(
        `deleteSecurityReport: thumb not found, skipped`,
        thumbRef.fullPath,
        e.code,
      );
    }),
  ]);
  log(`deleteSecurityReport: done`, fileRef.fullPath);
}
