import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";

/** サムネイルのサイズ上限（px） */
const THUMB_MAX_PX = 400;

/**
 * 警備日報本体のサムネイルを生成する。
 *
 * @param {Object} options
 * @param {string} options.bucketName - Storage バケット名
 * @param {string} options.filePath - 警備日報本体のStorageパス
 * @param {string} options.fileName - 警備日報本体のファイル名
 * @returns {Promise<string>} 生成されたサムネイルのStorageパス
 */
export async function createSecurityReportThumbnail({
  bucketName,
  filePath,
  fileName,
}) {
  const bucket = getStorage().bucket(bucketName);
  const fileRef = bucket.file(filePath);
  const [fileBuffer] = await fileRef.download();

  const thumbBuffer = await sharp(fileBuffer)
    .resize(THUMB_MAX_PX, THUMB_MAX_PX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  const thumbFileName = fileName.replace(/\.jpg$/, "_thumb.jpg");
  const thumbFilePath = filePath.replace(fileName, thumbFileName);
  const thumbRef = bucket.file(thumbFilePath);

  await thumbRef.save(thumbBuffer, {
    metadata: { contentType: "image/jpeg" },
  });

  console.log(
    `[securityReports] Thumbnail generated: ${thumbFilePath} (${thumbBuffer.byteLength} bytes)`,
  );
  return thumbFilePath;
}
