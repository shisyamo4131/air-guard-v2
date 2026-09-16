import { FieldValue } from "firebase-admin/firestore";

export const SITE_STATUS = Object.freeze({ ACTIVE: "ACTIVE", TERMINATED: "TERMINATED" });
export const SITE_STATUS_SOURCE = Object.freeze({ MANUAL: "MANUAL", AUTO: "AUTO", REACTIVATION: "REACTIVATION" });
export const SITE_LIFECYCLE_ERROR_CODES = Object.freeze({
  INVALID_DEPENDENCY: "invalid-dependency",
  MAINTENANCE: "maintenance",
  INVALID_STATE: "invalid-state",
});

export class SiteLifecycleError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "SiteLifecycleError";
    this.code = code;
  }
}

function refs(firestore, companyId, siteId) {
  const prefix = `Companies/${companyId}`;
  return {
    site: firestore.doc(`${prefix}/Sites/${siteId}`),
    schedules: firestore.collection(`${prefix}/SiteOperationSchedules`),
  };
}

function jstToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function scheduleQueries(collection, siteId, today) {
  return [
    collection.where("siteId", "==", siteId).where("date", ">=", today).limit(1),
    collection.where("siteId", "==", siteId).where("operationResultId", "==", null).limit(1),
  ];
}

function lifecyclePatch({ status, actorUid, source, reason }) {
  return {
    status,
    statusChangedAt: FieldValue.serverTimestamp(),
    statusChangedBy: actorUid,
    statusChangeSource: source,
    statusChangeReason: reason,
    uid: actorUid,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function assertMaintenanceOff(snapshot) {
  if (!snapshot?.exists || snapshot.data().isMaintenance !== false) {
    throw new SiteLifecycleError(SITE_LIFECYCLE_ERROR_CODES.MAINTENANCE, "Maintenance state is unavailable or active");
  }
}

function assertScheduleRevision(site) {
  if (Object.hasOwn(site, "scheduleRevision") &&
      (!Number.isSafeInteger(site.scheduleRevision) || site.scheduleRevision < 0)) {
    throw new SiteLifecycleError(SITE_LIFECYCLE_ERROR_CODES.INVALID_STATE, "Site schedule revision is invalid");
  }
}

export function isAutoTerminationDue(site, now = new Date()) {
  const endDate = site?.constructionPeriodEndAt?.toDate?.();
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return false;
  const endDay = jstToday(endDate);
  const due = new Date(new Date(`${endDay}T00:00:00+09:00`).getTime() + 90 * 24 * 60 * 60 * 1000);
  return now.getTime() >= due.getTime();
}

export async function autoTerminateSite({ firestore, siteReference, now = new Date() } = {}) {
  const segments = siteReference?.path?.split("/") ?? [];
  if (segments.length !== 4 || segments[0] !== "Companies" || segments[2] !== "Sites") {
    throw new SiteLifecycleError(SITE_LIFECYCLE_ERROR_CODES.INVALID_DEPENDENCY, "Site reference is invalid");
  }
  const companyId = segments[1];
  const siteId = segments[3];
  const target = refs(firestore, companyId, siteId);
  return await firestore.runTransaction(async (transaction) => {
    const [systemSnapshot, siteSnapshot, future, unprocessed] = await Promise.all([
      transaction.get(firestore.doc("System/system")),
      transaction.get(target.site),
      ...scheduleQueries(target.schedules, siteId, jstToday(now)).map((query) => transaction.get(query)),
    ]);
    assertMaintenanceOff(systemSnapshot);
    if (!siteSnapshot.exists) return false;
    const site = siteSnapshot.data();
    if (site.status !== SITE_STATUS.ACTIVE || !isAutoTerminationDue(site, now) || !future.empty || !unprocessed.empty) return false;
    assertScheduleRevision(site);
    transaction.update(target.site, lifecyclePatch({
      status: SITE_STATUS.TERMINATED,
      actorUid: "system",
      source: SITE_STATUS_SOURCE.AUTO,
      reason: "工期終了後90日経過",
    }));
    return true;
  });
}
