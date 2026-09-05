import { FieldValue } from "firebase-admin/firestore";
import { resolveRolePermissions } from "../auth/policies/rolePermissions.js";
import {
  buildSiteArchiveEnvelope,
  isPlainObject,
  isServerTimestampSentinel,
  isValidSiteArchiveEnvelope,
  isValidSiteArchiveSnapshot,
} from "./siteArchiveDocumentContract.js";

export const SITE_ARCHIVE_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "invalid-input",
  INVALID_DEPENDENCY: "invalid-dependency",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  MAINTENANCE: "maintenance",
  SITE_NOT_FOUND: "site-not-found",
  SITE_INVALID: "site-invalid",
  REFERENCES_EXIST: "references-exist",
  ARCHIVE_INVALID: "archive-invalid",
  ARCHIVE_CONFLICT: "archive-conflict",
});

export class SiteArchiveError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "SiteArchiveError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new SiteArchiveError(code, message, options);
}

function ownKeys(value) {
  return Reflect.ownKeys(value).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key),
  );
}

function normalizeInputString(value, maxLength, field) {
  if (typeof value !== "string") {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_INPUT, `[archiveSite] ${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength ||
      /[\u0000-\u001f\u007f]/u.test(normalized)) {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_INPUT, `[archiveSite] ${field} is invalid`);
  }
  return normalized;
}

function assertSafeIdentifier(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 ||
      value.trim() !== value || value.includes("/") ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY, `[archiveSite] ${field} is invalid`);
  }
}

export function parseSiteArchiveInput(input) {
  const expected = ["siteId", "reason", "operationId"];
  if (!isPlainObject(input)) {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_INPUT, "[archiveSite] Input must be a plain object");
  }
  const keys = ownKeys(input);
  if (keys.length !== expected.length || keys.some((key) =>
    typeof key !== "string" || !expected.includes(key)) ||
    expected.some((key) => !Object.hasOwn(input, key))) {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_INPUT, "[archiveSite] Input fields are invalid");
  }
  const siteId = normalizeInputString(input.siteId, 128, "siteId");
  if (siteId.includes("/")) {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_INPUT, "[archiveSite] siteId is not path-safe");
  }
  const operationId = normalizeInputString(input.operationId, 128, "operationId");
  if (operationId.includes("/")) {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_INPUT, "[archiveSite] operationId is not path-safe");
  }
  return Object.freeze({
    siteId,
    reason: normalizeInputString(input.reason, 200, "reason"),
    operationId,
  });
}

function assertDependencies(firestore, identity, timestampFactory) {
  if (!firestore || typeof firestore.doc !== "function" ||
      typeof firestore.collection !== "function" ||
      typeof firestore.runTransaction !== "function" ||
      typeof timestampFactory !== "function" || !isPlainObject(identity) ||
      typeof identity.isSuperUser !== "boolean") {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY, "[archiveSite] Dependencies are invalid");
  }
  assertSafeIdentifier(identity.uid, "actorUid");
  assertSafeIdentifier(identity.companyId, "companyId");
}

function assertActor(identity, actor) {
  if (!isPlainObject(actor) || actor.docId !== identity.uid ||
      actor.companyId !== identity.companyId || actor.isTemporary !== false ||
      actor.disabled !== false || typeof actor.isAdmin !== "boolean") {
    fail(SITE_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED, "[archiveSite] Actor is not active");
  }
  if (actor.isAdmin === true) return;
  if (identity.isSuperUser !== false || !Array.isArray(actor.roles) || actor.roles.length > 6) {
    fail(SITE_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED, "[archiveSite] Actor is not allowed");
  }
  let permissions;
  try {
    permissions = resolveRolePermissions(actor.roles);
  } catch {
    fail(SITE_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED, "[archiveSite] Actor roles are invalid");
  }
  if (!permissions.includes("sites:write")) {
    fail(SITE_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED, "[archiveSite] Actor lacks sites:write");
  }
}

function assertMaintenanceOff(snapshot) {
  if (!snapshot?.exists || snapshot.data()?.isMaintenance !== false) {
    fail(SITE_ARCHIVE_ERROR_CODES.MAINTENANCE, "[archiveSite] Maintenance is active or unavailable");
  }
}

function limitedQuery(firestore, companyId, collectionName, siteId) {
  return firestore.collection(`Companies/${companyId}/${collectionName}`)
    .where("siteId", "==", siteId).limit(1);
}

function assertDocumentSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.exists !== "boolean" ||
      (snapshot.exists && typeof snapshot.data !== "function")) {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY, "[archiveSite] Document snapshot is invalid");
  }
}

function hasReference(snapshot) {
  if (!snapshot || !Number.isSafeInteger(snapshot.size) || snapshot.size < 0 || snapshot.size > 1) {
    fail(SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY, "[archiveSite] Query snapshot is invalid");
  }
  return snapshot.size > 0;
}

export async function archiveSite({
  firestore,
  identity,
  input,
  serverTimestampFactory = () => FieldValue.serverTimestamp(),
} = {}) {
  assertDependencies(firestore, identity, serverTimestampFactory);
  const parsed = parseSiteArchiveInput(input);
  const prefix = `Companies/${identity.companyId}`;
  const systemRef = firestore.doc("System/system");
  const actorRef = firestore.doc(`${prefix}/Users/${identity.uid}`);
  const activeRef = firestore.doc(`${prefix}/Sites/${parsed.siteId}`);
  const archiveRef = firestore.doc(`${prefix}/Sites_archive/${parsed.siteId}`);
  const referenceQueries = [
    "SiteOperationSchedules", "OperationResults", "ArrangementNotifications",
    "Billings", "SiteEmployeeHistories",
  ].map((name) => limitedQuery(firestore, identity.companyId, name, parsed.siteId));

  await firestore.runTransaction(async (transaction) => {
    if (!transaction || typeof transaction.get !== "function" ||
        typeof transaction.create !== "function" || typeof transaction.delete !== "function") {
      fail(SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY, "[archiveSite] Transaction is invalid");
    }
    const [system, actor, active, archived, ...references] = await Promise.all([
      transaction.get(systemRef), transaction.get(actorRef), transaction.get(activeRef),
      transaction.get(archiveRef), ...referenceQueries.map((query) => transaction.get(query)),
    ]);
    [system, actor, active, archived].forEach(assertDocumentSnapshot);
    assertMaintenanceOff(system);
    assertActor(identity, actor.exists ? actor.data() : null);
    if (references.some(hasReference)) {
      fail(SITE_ARCHIVE_ERROR_CODES.REFERENCES_EXIST, "[archiveSite] Site references exist");
    }
    if (active.exists && archived.exists) {
      fail(SITE_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT, "[archiveSite] Active and archive both exist");
    }
    if (!active.exists && !archived.exists) {
      fail(SITE_ARCHIVE_ERROR_CODES.SITE_NOT_FOUND, "[archiveSite] Site was not found");
    }
    if (archived.exists) {
      const envelope = archived.data();
      if (!isValidSiteArchiveEnvelope(envelope, parsed.siteId)) {
        fail(SITE_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID, "[archiveSite] Existing archive is invalid");
      }
      if (envelope.audit.actorUid !== identity.uid ||
          envelope.audit.operationId !== parsed.operationId ||
          envelope.audit.reason !== parsed.reason) {
        fail(SITE_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT, "[archiveSite] Archive operation conflicts");
      }
      return;
    }
    const site = active.data();
    if (!isValidSiteArchiveSnapshot(site, parsed.siteId)) {
      fail(SITE_ARCHIVE_ERROR_CODES.SITE_INVALID, "[archiveSite] Active Site is invalid");
    }
    let archivedAt;
    try {
      archivedAt = serverTimestampFactory();
    } catch (error) {
      fail(SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY, "[archiveSite] Timestamp failed", { cause: error });
    }
    if (!isServerTimestampSentinel(archivedAt)) {
      fail(SITE_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY, "[archiveSite] Timestamp is invalid");
    }
    const envelope = buildSiteArchiveEnvelope({
      site, siteId: parsed.siteId, operationId: parsed.operationId,
      reason: parsed.reason, actorUid: identity.uid, archivedAt,
    });
    transaction.create(archiveRef, envelope);
    transaction.delete(activeRef);
  });
  return Object.freeze({ success: true, archived: true });
}
