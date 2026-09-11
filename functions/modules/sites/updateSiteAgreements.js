import { FieldValue } from "firebase-admin/firestore";
import {
  SiteAgreementContractError,
  buildStoredSiteAgreements,
  normalizeSiteAgreements,
  parseSiteAgreementUpdateInput,
  siteAgreementsEqual,
} from "./siteAgreementContract.js";

export const SITE_AGREEMENT_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "invalid-input",
  INVALID_DEPENDENCY: "invalid-dependency",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  MAINTENANCE: "maintenance",
  SITE_NOT_FOUND: "site-not-found",
  INVALID_STATE: "invalid-state",
  CONFLICT: "conflict",
});

export class SiteAgreementUpdateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "SiteAgreementUpdateError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new SiteAgreementUpdateError(code, message, options);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertIdentity(identity) {
  if (!isPlainObject(identity) || typeof identity.uid !== "string" || !identity.uid ||
      typeof identity.companyId !== "string" || !identity.companyId ||
      typeof identity.isSuperUser !== "boolean") {
    fail(SITE_AGREEMENT_ERROR_CODES.INVALID_DEPENDENCY, "Identity is invalid");
  }
}

function assertActor(identity, actor) {
  if (!isPlainObject(actor) || actor.docId !== identity.uid ||
      actor.companyId !== identity.companyId || actor.isTemporary !== false ||
      actor.disabled !== false || typeof actor.isAdmin !== "boolean") {
    fail(SITE_AGREEMENT_ERROR_CODES.ACTOR_NOT_ALLOWED, "Actor is not active");
  }
}

function parseInput(input) {
  try {
    return parseSiteAgreementUpdateInput(input);
  } catch (error) {
    if (error instanceof SiteAgreementContractError) {
      fail(SITE_AGREEMENT_ERROR_CODES.INVALID_INPUT, error.message, { cause: error });
    }
    throw error;
  }
}

export async function updateSiteAgreements({ firestore, identity, input } = {}) {
  assertIdentity(identity);
  if (!firestore || typeof firestore.doc !== "function" ||
      typeof firestore.runTransaction !== "function") {
    fail(SITE_AGREEMENT_ERROR_CODES.INVALID_DEPENDENCY, "Firestore is invalid");
  }
  const parsed = parseInput(input);
  const prefix = `Companies/${identity.companyId}`;
  const systemRef = firestore.doc("System/system");
  const actorRef = firestore.doc(`${prefix}/Users/${identity.uid}`);
  const siteRef = firestore.doc(`${prefix}/Sites/${parsed.siteId}`);

  return await firestore.runTransaction(async (transaction) => {
    const [systemSnapshot, actorSnapshot, siteSnapshot] = await Promise.all([
      transaction.get(systemRef), transaction.get(actorRef), transaction.get(siteRef),
    ]);
    if (!systemSnapshot?.exists || systemSnapshot.data()?.isMaintenance !== false) {
      fail(SITE_AGREEMENT_ERROR_CODES.MAINTENANCE, "Maintenance is active or unavailable");
    }
    assertActor(identity, actorSnapshot?.exists ? actorSnapshot.data() : null);
    if (!siteSnapshot?.exists) {
      fail(SITE_AGREEMENT_ERROR_CODES.SITE_NOT_FOUND, "Site not found");
    }
    const site = siteSnapshot.data();
    if (site?.docId !== parsed.siteId || site?.status !== "ACTIVE") {
      fail(SITE_AGREEMENT_ERROR_CODES.INVALID_STATE, "Site is not an active canonical Site");
    }
    let current;
    try {
      current = normalizeSiteAgreements(site.agreementsV2);
    } catch (error) {
      fail(SITE_AGREEMENT_ERROR_CODES.INVALID_STATE, "Stored agreements are invalid", { cause: error });
    }
    if (!siteAgreementsEqual(current, parsed.baselineAgreements)) {
      fail(SITE_AGREEMENT_ERROR_CODES.CONFLICT, "Agreements changed after the editor opened");
    }
    if (siteAgreementsEqual(current, parsed.candidateAgreements)) {
      return Object.freeze({ success: true, updated: false });
    }
    transaction.update(siteRef, {
      agreementsV2: buildStoredSiteAgreements(parsed.candidateAgreements),
      uid: identity.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return Object.freeze({ success: true, updated: true });
  });
}
