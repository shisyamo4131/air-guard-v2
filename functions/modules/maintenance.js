import dayjs from "dayjs";
// ↓↓↓↓ 2026-07-03 以降エラーがなければ削除してOK
// import utc from "dayjs/plugin/utc.js";
// import timezone from "dayjs/plugin/timezone.js";
import { onSchedule } from "firebase-functions/scheduler";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { sitesAutoTermination } from "./sites/index.js";

// ↓↓↓↓ 2026-07-03 以降エラーがなければ削除してOK
// dayjs.extend(utc);
// dayjs.extend(timezone);

const BATCH_SIZE = 300;
const SITE_OPERATION_SCHEDULES_KEEP_DAYS = 60;

async function assertMaintenanceOff(db) {
  const snapshot = await db.doc("System/system").get();
  if (!snapshot.exists || snapshot.data()?.isMaintenance !== false) {
    throw new Error("Site operation schedule cleanup is disabled during maintenance.");
  }
}

/**
 * Creates batches of delete operations for Firestore documents.
 * @param {*} snapshot - The Firestore query snapshot containing documents to delete.
 * @param {*} db - The Firestore database instance.
 * @returns {Array} - An array of Firestore write batches.
 */
const createDeleteBatches = (snapshot, db) => {
  const batchArray = [];
  const batchSize = BATCH_SIZE;
  snapshot.docs.forEach((doc, index) => {
    if (index % batchSize === 0) batchArray.push(db.batch());
    const currentBatch = batchArray[batchArray.length - 1];
    currentBatch.delete(doc.ref);
  });
  return batchArray;
};

/**
 * Splits an array into chunks of the specified size.
 * @param {Array} array - The array to split.
 * @param {number} size - The chunk size.
 * @returns {Array[]} - An array of chunks.
 */
const chunkArray = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

/**
 * Cleans up site operation schedules older than the defined retention period.
 * Also deletes associated ArrangementNotification documents.
 * - SiteOperationSchedule ドキュメントを collectionGroup で取得し、
 *   ref.path から companyId を抽出して会社ごとにグループ化。
 * - 各会社ごとに ArrangementNotifications を siteOperationScheduleId の in クエリで取得し削除。
 * - その後、SiteOperationSchedule ドキュメントを削除。
 *
 * [SiteOperationSchedule ドキュメントの削除トリガーを利用しない理由]
 * - Cloud Functions の遅延実行が UI 上の不都合を引き起こす可能性があるため。
 *
 * [SiteOperationSchedule クラスの delete メソッドを利用しない理由]
 * - メソッド内部で使用している `fetchDocsBySiteOperationScheduleId` メソッドがクライアント側でしか
 *   使用できない制約があるため。
 * @returns {Promise<void>}
 * @throws Will throw an error if the cleanup process fails.
 */
const cleanUpSiteOperationSchedules = async () => {
  try {
    logger.info("Starting cleanup of site operation schedules...");

    // JST で現在日時を取得し、60日前の日付を計算
    const deadline = dayjs()
      .tz()
      .subtract(SITE_OPERATION_SCHEDULES_KEEP_DAYS, "day")
      .format("YYYY-MM-DD");

    logger.info(`Cleaning up schedules before: ${deadline}`);

    const db = getFirestore();
    await assertMaintenanceOff(db);
    const colRef = db.collectionGroup("SiteOperationSchedules");
    let cursor = null;
    let totalArrangementDeleted = 0;
    let totalSchedulesDeleted = 0;
    do {
      await assertMaintenanceOff(db);
      let query = colRef
        .where("date", "<", deadline)
        .orderBy("date", "asc")
        .orderBy(FieldPath.documentId(), "asc")
        .limit(BATCH_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      cursor = snapshot.docs[snapshot.docs.length - 1];

      // ref.path: "Companies/{companyId}/SiteOperationSchedules/{docId}"
      const companyScheduleMap = {};
      const deletableDocs = snapshot.docs.filter((scheduleDoc) => {
        const operationResultId = scheduleDoc.data()?.operationResultId;
        return typeof operationResultId === "string" && operationResultId.length > 0;
      });
      for (const scheduleDoc of deletableDocs) {
        const companyId = scheduleDoc.ref.path.split("/")[1];
        if (!companyScheduleMap[companyId]) companyScheduleMap[companyId] = [];
        companyScheduleMap[companyId].push(scheduleDoc.id);
      }

      for (const [companyId, scheduleIds] of Object.entries(companyScheduleMap)) {
        for (const chunk of chunkArray(scheduleIds, 30)) {
          const anSnapshot = await db
            .collection(`Companies/${companyId}/ArrangementNotifications`)
            .where("siteOperationScheduleId", "in", chunk)
            .get();
          for (const batch of createDeleteBatches(anSnapshot, db)) {
            await batch.commit();
          }
          totalArrangementDeleted += anSnapshot.size;
        }
      }

      for (const batch of createDeleteBatches({ docs: deletableDocs }, db)) {
        await batch.commit();
      }
      totalSchedulesDeleted += deletableDocs.length;
      if (snapshot.size < BATCH_SIZE) break;
    } while (cursor);

    logger.info("Site operation schedule cleanup completed", {
      totalArrangementDeleted,
      totalSchedulesDeleted,
    });
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
      throw error;
    }
  },
);

/** cleanupとは独立した失敗境界でSite自動終了を実行します。 */
export const runDailySiteTermination = onSchedule(
  { schedule: "every day 00:00", timeZone: "Asia/Tokyo" },
  async () => {
    try {
      await sitesAutoTermination({ firestore: getFirestore() });
    } catch (error) {
      logger.error(
        "[runDailySiteTermination] Site auto termination failed",
        error,
      );
      throw error;
    }
  },
);
