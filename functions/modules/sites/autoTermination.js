import { getFirestore, Timestamp } from "firebase-admin/firestore";
import dayjs from "dayjs";
import { Site } from "../../schemas/index.js";
import { logger } from "firebase-functions";

/*****************************************************************************
 * Site ドキュメントについて、`status` が `ACTIVE` であり、かつ `constructionPeriodEndAt` が3ヶ月以上前である場合に、
 * `status` を `TERMINATED` に更新します。
 *****************************************************************************/
export async function sitesAutoTermination() {
  /** start log */
  logger.info("Starting sites auto termination...");

  /** define constants */
  const today = dayjs().tz("Asia/Tokyo").startOf("day");
  const deadline = today.subtract(3, "month").toDate();
  const updatedAt = Timestamp.now();

  /** retrive site documents */
  const db = getFirestore();
  const colRef = db.collectionGroup("Sites");
  const snapshot = await colRef
    .where("status", "==", Site.STATUS_ACTIVE)
    .where("constructionPeriodEndAt", "<", Timestamp.fromDate(deadline))
    .get();

  /** return if no sites found */
  if (snapshot.empty) {
    logger.info("No sites found for auto termination.");
    return;
  }

  /** log found sites */
  logger.info(`Found ${snapshot.size} sites for auto termination.`);

  /** create batches */
  // ref.path: "Companies/{companyId}/Sites/{docId}"
  const batchArray = [];
  const BATCH_SIZE = 500; // Firestore のバッチ書き込みの上限
  for (let i = 0; i < snapshot.size; i++) {
    if (i % BATCH_SIZE === 0) {
      batchArray.push(db.batch());
    }
    batchArray[batchArray.length - 1].update(snapshot.docs[i].ref, {
      status: Site.STATUS_TERMINATED,
      updatedAt,
    });
  }

  /** commit all batches */
  await Promise.all(batchArray.map((batch) => batch.commit()));

  /** log completion */
  logger.info(
    `Sites auto termination completed. Updated ${snapshot.size} sites.`,
  );
}
