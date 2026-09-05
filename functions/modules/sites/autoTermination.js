import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  autoTerminateSite,
  SiteLifecycleError,
  SITE_LIFECYCLE_ERROR_CODES,
} from "./lifecycle.js";

const PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

function candidateCutoffExclusive(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const todayAtJst = new Date(`${values.year}-${values.month}-${values.day}T00:00:00+09:00`);
  return Timestamp.fromDate(new Date(todayAtJst.getTime() - 89 * DAY_MS));
}

async function assertMaintenanceOff(firestore) {
  const snapshot = await firestore.doc("System/system").get();
  if (!snapshot.exists || snapshot.data().isMaintenance !== false) {
    throw new SiteLifecycleError(
      SITE_LIFECYCLE_ERROR_CODES.MAINTENANCE,
      "Maintenance state is unavailable or active",
    );
  }
}

/** ACTIVEかつ工期終了から90日経過したSiteをbounded cursorで処理します。 */
export async function sitesAutoTermination({
  firestore,
  now = new Date(),
  pageSize = PAGE_SIZE,
} = {}) {
  if (
    !firestore ||
    typeof firestore.collectionGroup !== "function" ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 200
  ) {
    throw new TypeError("[sitesAutoTermination] Dependencies are invalid");
  }
  await assertMaintenanceOff(firestore);
  let cursor = null;
  let processed = 0;
  let terminated = 0;
  do {
    await assertMaintenanceOff(firestore);
    let query = firestore
      .collectionGroup("Sites")
      .where("status", "==", "ACTIVE")
      .where("constructionPeriodEndAt", "<", candidateCutoffExclusive(now))
      .orderBy("constructionPeriodEndAt", "asc")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    for (const siteSnapshot of snapshot.docs) {
      try {
        if (await autoTerminateSite({
          firestore,
          siteReference: siteSnapshot.ref,
          now,
        })) {
          terminated += 1;
        }
        processed += 1;
      } catch (error) {
        if (typeof logger.error === "function") {
          logger.error("Site auto termination item failed", {
            sitePath: siteSnapshot.ref.path,
            processed,
            terminated,
            error,
          });
        }
        throw error;
      }
    }
    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < pageSize) break;
  } while (cursor);
  logger.info("Sites auto termination completed", { processed, terminated });
  return Object.freeze({ processed, terminated });
}
