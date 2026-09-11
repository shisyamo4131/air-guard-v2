import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const SITE_STATUS = Object.freeze({ ACTIVE: "ACTIVE", TERMINATED: "TERMINATED" });
export const SITE_STATUS_SOURCE = Object.freeze({
  MANUAL: "MANUAL",
  AUTO: "AUTO",
  REACTIVATION: "REACTIVATION",
});
export const SITE_LIFECYCLE_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "invalid-input",
  INVALID_DEPENDENCY: "invalid-dependency",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  SITE_NOT_FOUND: "site-not-found",
  INVALID_STATE: "invalid-state",
  SCHEDULES_EXIST: "schedules-exist",
  MAINTENANCE: "maintenance",
});

export class SiteLifecycleError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "SiteLifecycleError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new SiteLifecycleError(code, message, options);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactInput(input, fields) {
  if (!isPlainObject(input)) fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT, "Input must be an object");
  const keys = Reflect.ownKeys(input).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(input, key),
  );
  if (keys.length !== fields.length || keys.some((key) =>
    typeof key !== "string" || !fields.includes(key) || !Object.hasOwn(input, key),
  )) {
    fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT, "Input fields are invalid");
  }
}

function normalizeString(value, field, maxLength) {
  if (typeof value !== "string") fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT, `${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT, `${field} is invalid`);
  }
  return normalized;
}

function normalizeSiteId(value) {
  const siteId = normalizeString(value, "siteId", 128);
  if (siteId.includes("/")) fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT, "siteId is not path-safe");
  return siteId;
}

function parseDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT, `${field} must be YYYY-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT, `${field} is not a calendar date`);
  }
  return value;
}

export function parseTerminateSiteInput(input) {
  assertExactInput(input, ["siteId", "reason"]);
  return Object.freeze({
    siteId: normalizeSiteId(input.siteId),
    reason: normalizeString(input.reason, "reason", 200),
  });
}

export function parseReactivateSiteInput(input) {
  assertExactInput(input, [
    "siteId", "reason", "constructionPeriodStartDate", "constructionPeriodEndDate",
  ]);
  const start = parseDate(input.constructionPeriodStartDate, "constructionPeriodStartDate");
  const end = parseDate(input.constructionPeriodEndDate, "constructionPeriodEndDate");
  if (start > end) fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT, "construction period is invalid");
  return Object.freeze({
    siteId: normalizeSiteId(input.siteId),
    reason: normalizeString(input.reason, "reason", 200),
    constructionPeriodStartDate: start,
    constructionPeriodEndDate: end,
  });
}

function assertIdentity(identity) {
  if (!isPlainObject(identity) || typeof identity.uid !== "string" || !identity.uid ||
      typeof identity.companyId !== "string" || !identity.companyId ||
      typeof identity.isSuperUser !== "boolean") {
    fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_DEPENDENCY, "Identity is invalid");
  }
}

function assertActor(identity, user) {
  if (!isPlainObject(user) || user.docId !== identity.uid || user.companyId !== identity.companyId ||
      user.isTemporary !== false || user.disabled !== false || typeof user.isAdmin !== "boolean") {
    fail(SITE_LIFECYCLE_ERROR_CODES.ACTOR_NOT_ALLOWED, "Actor is not active");
  }
}

function refs(firestore, companyId, siteId) {
  const prefix = `Companies/${companyId}`;
  return {
    site: firestore.doc(`${prefix}/Sites/${siteId}`),
    schedules: firestore.collection(`${prefix}/SiteOperationSchedules`),
  };
}

function actorRef(firestore, identity) {
  return firestore.doc(`Companies/${identity.companyId}/Users/${identity.uid}`);
}

function jstToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function jstDateTimestamp(value) {
  return Timestamp.fromDate(new Date(`${value}T00:00:00+09:00`));
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
    fail(
      SITE_LIFECYCLE_ERROR_CODES.MAINTENANCE,
      "Maintenance state is unavailable or active",
    );
  }
}

function assertScheduleRevision(site) {
  if (Object.hasOwn(site, "scheduleRevision") &&
      (!Number.isSafeInteger(site.scheduleRevision) || site.scheduleRevision < 0)) {
    fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_STATE, "Site schedule revision is invalid");
  }
}

export async function terminateSite({ firestore, identity, input, now = new Date() } = {}) {
  assertIdentity(identity);
  const parsed = parseTerminateSiteInput(input);
  const target = refs(firestore, identity.companyId, parsed.siteId);
  const userRef = actorRef(firestore, identity);
  await firestore.runTransaction(async (transaction) => {
    const [systemSnapshot, userSnapshot, siteSnapshot, future, unprocessed] = await Promise.all([
      transaction.get(firestore.doc("System/system")),
      transaction.get(userRef),
      transaction.get(target.site),
      ...scheduleQueries(target.schedules, parsed.siteId, jstToday(now)).map((query) => transaction.get(query)),
    ]);
    assertMaintenanceOff(systemSnapshot);
    assertActor(identity, userSnapshot.exists ? userSnapshot.data() : null);
    if (!siteSnapshot.exists) fail(SITE_LIFECYCLE_ERROR_CODES.SITE_NOT_FOUND, "Site not found");
    const site = siteSnapshot.data();
    if (site.status !== SITE_STATUS.ACTIVE) fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_STATE, "Site is not ACTIVE");
    assertScheduleRevision(site);
    if (!future.empty || !unprocessed.empty) fail(SITE_LIFECYCLE_ERROR_CODES.SCHEDULES_EXIST, "Schedules prevent termination");
    transaction.update(target.site, lifecyclePatch({
      status: SITE_STATUS.TERMINATED,
      actorUid: identity.uid,
      source: SITE_STATUS_SOURCE.MANUAL,
      reason: parsed.reason,
    }));
  });
  return Object.freeze({ success: true, siteId: parsed.siteId, status: SITE_STATUS.TERMINATED });
}

export async function reactivateSite({ firestore, identity, input } = {}) {
  assertIdentity(identity);
  const parsed = parseReactivateSiteInput(input);
  const target = refs(firestore, identity.companyId, parsed.siteId);
  const userRef = actorRef(firestore, identity);
  await firestore.runTransaction(async (transaction) => {
    const [systemSnapshot, userSnapshot, siteSnapshot] = await Promise.all([
      transaction.get(firestore.doc("System/system")),
      transaction.get(userRef),
      transaction.get(target.site),
    ]);
    assertMaintenanceOff(systemSnapshot);
    assertActor(identity, userSnapshot.exists ? userSnapshot.data() : null);
    if (!siteSnapshot.exists) fail(SITE_LIFECYCLE_ERROR_CODES.SITE_NOT_FOUND, "Site not found");
    if (siteSnapshot.data().status !== SITE_STATUS.TERMINATED) fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_STATE, "Site is not TERMINATED");
    transaction.update(target.site, {
      ...lifecyclePatch({
        status: SITE_STATUS.ACTIVE,
        actorUid: identity.uid,
        source: SITE_STATUS_SOURCE.REACTIVATION,
        reason: parsed.reason,
      }),
      constructionPeriodStartAt: jstDateTimestamp(parsed.constructionPeriodStartDate),
      constructionPeriodEndAt: jstDateTimestamp(parsed.constructionPeriodEndDate),
      hasConstructionPeriod: true,
      hasConstructionPeriodStartAt: true,
      hasConstructionPeriodEndAt: true,
    });
  });
  return Object.freeze({ success: true, siteId: parsed.siteId, status: SITE_STATUS.ACTIVE });
}

export function isAutoTerminationDue(site, now = new Date()) {
  const endDate = site?.constructionPeriodEndAt?.toDate?.();
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return false;
  const endDay = jstToday(endDate);
  const due = new Date(
    new Date(`${endDay}T00:00:00+09:00`).getTime() +
      90 * 24 * 60 * 60 * 1000,
  );
  return now.getTime() >= due.getTime();
}

export async function autoTerminateSite({ firestore, siteReference, now = new Date() } = {}) {
  const segments = siteReference?.path?.split("/") ?? [];
  if (segments.length !== 4 || segments[0] !== "Companies" || segments[2] !== "Sites") {
    fail(SITE_LIFECYCLE_ERROR_CODES.INVALID_DEPENDENCY, "Site reference is invalid");
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
    transaction.update(target.site, {
      ...lifecyclePatch({
        status: SITE_STATUS.TERMINATED,
        actorUid: "system",
        source: SITE_STATUS_SOURCE.AUTO,
        reason: "工期終了後90日経過",
      }),
    });
    return true;
  });
}
