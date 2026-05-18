/*****************************************************************************
 * @file ./modules/securityReports.js
 * @description 警備日報写真のサムネイル自動生成トリガー
 *
 * ## 処理概要
 * Storage に警備日報写真がアップロードされた際に、サムネイル画像を自動生成する。
 *
 * ## トリガー条件
 * - Storage パス: Companies/{companyId}/SiteOperationSchedules/{scheduleId}/SecurityReports/{uuid}.jpg
 * - サムネイル自体（{uuid}_thumb.jpg）は処理しない（無限ループ防止）
 *
 * ## 生成されるサムネイル
 * - パス: 元ファイルと同じフォルダ内の {uuid}_thumb.jpg
 * - 最大サイズ: 400 x 400 px（アスペクト比維持・拡大なし）
 * - フォーマット: JPEG / quality 80
 *****************************************************************************/
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";

/** セキュリティレポートのパスパターン */
const SECURITY_REPORT_PATH_RE =
  /^Companies\/[^/]+\/SiteOperationSchedules\/[^/]+\/SecurityReports\/([^/]+\.jpg)$/;

/** サムネイルのサイズ上限（px） */
const THUMB_MAX_PX = 400;

/**
 * Storage に警備日報写真がアップロードされた際にサムネイルを生成する。
 */
export const onSecurityReportUploaded = onObjectFinalized(
  { region: "asia-northeast1" },
  async (event) => {
    const filePath = event.data.name;

    // パスがセキュリティレポートに一致するか確認
    const match = filePath.match(SECURITY_REPORT_PATH_RE);
    if (!match) return;

    const fileName = match[1];

    // サムネイル自体は処理しない（無限ループ防止）
    if (fileName.includes("_thumb")) return;

    const storage = getStorage();
    const bucket = storage.bucket(event.data.bucket);

    // 本体をダウンロード
    const fileRef = bucket.file(filePath);
    const [fileBuffer] = await fileRef.download();

    // sharp でリサイズ
    const thumbBuffer = await sharp(fileBuffer)
      .resize(THUMB_MAX_PX, THUMB_MAX_PX, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // サムネイルのパスを計算して保存
    const thumbFileName = fileName.replace(/\.jpg$/, "_thumb.jpg");
    const thumbFilePath = filePath.replace(fileName, thumbFileName);
    const thumbRef = bucket.file(thumbFilePath);

    await thumbRef.save(thumbBuffer, {
      metadata: { contentType: "image/jpeg" },
    });

    console.log(
      `[securityReports] Thumbnail generated: ${thumbFilePath} (${thumbBuffer.byteLength} bytes)`,
    );
  },
);
