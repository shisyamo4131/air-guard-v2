import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { onSchedule } from "firebase-functions/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

dayjs.extend(utc);
dayjs.extend(timezone);

const BATCH_SIZE = 300;
const SITE_OPERATION_SCHEDULES_KEEP_DAYS = 60;

/**
 * Creates batches of delete operations for Firestore documents.
 * @param {*} snapshot - The Firestore query snapshot containing documents to delete.
 * @param {*} db - The Firestore database instance.
 * @returns {Array} - An array of Firestore write batches.
 */
const createDeleteBatches = (snapshot, db) => {
  const batchArray = [];
  const batchSize = BATCH_SIZE;
  snapshot.forEach((doc, index) => {
    if (index % batchSize === 0) batchArray.push(db.batch());
    const currentBatch = batchArray[batchArray.length - 1];
    currentBatch.delete(doc.ref);
  });
  return batchArray;
};

/**
 * Cleans up site operation schedules older than the defined retention period.
 * @returns {Promise<void>}
 * @throws Will throw an error if the cleanup process fails.
 */
const cleanUpSiteOperationSchedules = async () => {
  try {
    logger.info("Starting cleanup of site operation schedules...");
    // const deadline = dayjs()
    //   .subtract(SITE_OPERATION_SCHEDULES_KEEP_DAYS, "day")
    //   .utcOffset(JST_OFFSET)
    //   .format("YYYY-MM-DD");

    // JST で現在日時を取得し、60日前の日付を計算
    const deadline = dayjs()
      .tz("Asia/Tokyo")
      .subtract(SITE_OPERATION_SCHEDULES_KEEP_DAYS, "day")
      .format("YYYY-MM-DD");

    logger.info(`Cleaning up schedules before: ${deadline}`);

    const db = getFirestore();
    const colRef = db.collectionGroup("siteOperationSchedules");
    const snapshot = await colRef.where("date", "<", deadline).get();

    if (snapshot.empty) {
      logger.info("No site operation schedules to clean up.");
      return;
    }

    const batchArray = createDeleteBatches(snapshot, db);
    await Promise.all(batchArray.map((batch) => batch.commit()));
    logger.info(`Deleted ${snapshot.size} site operation schedules.`);
  } catch (e) {
    logger.error("Error during cleanup of site operation schedules:", e);
    throw e;
  }
};

/**
 * Scheduled function to run daily maintenance tasks.
 */
export const runDailyTask = onSchedule(
  {
    schedule: "every day 00:00",
    timeZone: "Asia/Tokyo", // JST タイムゾーンを指定
  },
  async (context) => {
    logger.log("[runDailyTask] Starting daily maintenance tasks...");
    try {
      await cleanUpSiteOperationSchedules();
    } catch (error) {
      logger.error("[runDailyTask] Error executing scheduled function:", error);
    }
  }
);
