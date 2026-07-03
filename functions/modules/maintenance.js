import dayjs from "dayjs";
// ↓↓↓↓ 2026-07-03 以降エラーがなければ削除してOK
// import utc from "dayjs/plugin/utc.js";
// import timezone from "dayjs/plugin/timezone.js";
import { onSchedule } from "firebase-functions/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { sitesAutoTermination } from "./sites/index.js";

// ↓↓↓↓ 2026-07-03 以降エラーがなければ削除してOK
// dayjs.extend(utc);
// dayjs.extend(timezone);

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
      .tz("Asia/Tokyo")
      .subtract(SITE_OPERATION_SCHEDULES_KEEP_DAYS, "day")
      .format("YYYY-MM-DD");

    logger.info(`Cleaning up schedules before: ${deadline}`);

    const db = getFirestore();
    const colRef = db.collectionGroup("SiteOperationSchedules");
    const snapshot = await colRef.where("date", "<", deadline).get();

    if (snapshot.empty) {
      logger.info("No site operation schedules to clean up.");
      return;
    }

    // ref.path: "Companies/{companyId}/SiteOperationSchedules/{docId}"
    // companyId ごとに docId をグループ化
    const companyScheduleMap = {};
    snapshot.docs.forEach((doc) => {
      const segments = doc.ref.path.split("/");
      // segments[0] = "Companies", segments[1] = companyId
      const companyId = segments[1];
      if (!companyScheduleMap[companyId]) {
        companyScheduleMap[companyId] = [];
      }
      companyScheduleMap[companyId].push(doc.id);
    });

    // 各会社ごとに ArrangementNotifications を削除
    let totalArrangementDeleted = 0;
    for (const [companyId, scheduleIds] of Object.entries(companyScheduleMap)) {
      // Firestore の in クエリは最大 30 件のため分割して処理
      const chunks = chunkArray(scheduleIds, 30);
      for (const chunk of chunks) {
        const anSnapshot = await db
          .collection(`Companies/${companyId}/ArrangementNotifications`)
          .where("siteOperationScheduleId", "in", chunk)
          .get();
        if (!anSnapshot.empty) {
          const batchArray = createDeleteBatches(anSnapshot, db);
          await Promise.all(batchArray.map((batch) => batch.commit()));
          totalArrangementDeleted += anSnapshot.size;
        }
      }
    }
    logger.info(
      `Deleted ${totalArrangementDeleted} arrangement notifications.`,
    );

    // SiteOperationSchedule ドキュメントを削除
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
      await sitesAutoTermination();
    } catch (error) {
      logger.error("[runDailyTask] Error executing scheduled function:", error);
    }
  },
);
