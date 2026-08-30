/*****************************************************************************
 * @file ./functions/modules/company/updateCompanyProfile.js
 * @description Company基本情報をoperation所有fieldだけで更新します。
 *****************************************************************************/
import { FieldValue } from "firebase-admin/firestore";
import {
  CompanyConfigurationValidationError,
  parseUpdateCompanyBillingInputV1,
  parseUpdateCompanyProfileInputV1,
} from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

export const COMPANY_PROFILE_FIELDS = Object.freeze([
  "companyName",
  "companyNameKana",
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
  "tel",
  "fax",
  "invoiceNumber",
]);

const ADDRESS_FIELDS = Object.freeze([
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
]);

export const COMPANY_PROFILE_UPDATE_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "invalid-input",
  INVALID_DEPENDENCY: "invalid-dependency",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  COMPANY_NOT_FOUND: "company-not-found",
});

export class CompanyProfileUpdateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "CompanyProfileUpdateError";
    this.code = code;
  }
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertIdentifier(value, name) {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    value.includes("/")
  ) {
    throw new CompanyProfileUpdateError(
      COMPANY_PROFILE_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      `[updateCompanyProfile] ${name} is invalid`,
    );
  }
}

export function parseCompanyProfileChanges(input) {
  if (
    !isPlainRecord(input) ||
    Object.keys(input).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(input, "changes") ||
    !isPlainRecord(input.changes)
  ) {
    throw new CompanyProfileUpdateError(
      COMPANY_PROFILE_UPDATE_ERROR_CODES.INVALID_INPUT,
      "[updateCompanyProfile] Input must contain only a changes object",
    );
  }

  const entries = Object.entries(input.changes);
  if (
    entries.length === 0 ||
    entries.some(([field]) => !COMPANY_PROFILE_FIELDS.includes(field))
  ) {
    throw new CompanyProfileUpdateError(
      COMPANY_PROFILE_UPDATE_ERROR_CODES.INVALID_INPUT,
      "[updateCompanyProfile] Changes are empty or contain an unmanaged field",
    );
  }

  return Object.fromEntries(entries);
}

function currentProfile(company) {
  return Object.fromEntries(
    COMPANY_PROFILE_FIELDS.map((field) => [field, company[field] ?? null]),
  );
}

function normalizeProfile(value) {
  const profile = parseUpdateCompanyProfileInputV1({
    expectedRevision: 1,
    value: Object.fromEntries(
      COMPANY_PROFILE_FIELDS.filter((field) => field !== "invoiceNumber").map(
        (field) => [field, value[field]],
      ),
    ),
  }).value;
  const billing = parseUpdateCompanyBillingInputV1({
    expectedRevision: 1,
    value: {
      invoiceNumber: value.invoiceNumber,
      bankName: null,
      branchName: null,
      accountType: null,
      accountNumber: null,
      accountHolder: null,
    },
  }).value;
  return { ...profile, invoiceNumber: billing.invoiceNumber };
}

export function buildCompanyProfileUpdate(company, changes) {
  const requested = { ...currentProfile(company), ...changes };
  let normalized;
  try {
    normalized = normalizeProfile(requested);
  } catch (error) {
    if (error instanceof CompanyConfigurationValidationError) {
      throw new CompanyProfileUpdateError(
        COMPANY_PROFILE_UPDATE_ERROR_CODES.INVALID_INPUT,
        `[updateCompanyProfile] Invalid Company profile at ${error.path}`,
        { cause: error },
      );
    }
    throw error;
  }

  const update = {};
  for (const field of Object.keys(changes)) {
    const currentValue = company[field] ?? null;
    if (!Object.is(currentValue, normalized[field])) {
      update[field] = normalized[field];
    }
  }

  if (ADDRESS_FIELDS.some((field) => Object.hasOwn(update, field))) {
    update.location = null;
    update.geopoint = null;
  }

  return update;
}

function assertActor(identity, actorUser) {
  if (
    identity.isSuperUser !== false ||
    !isPlainRecord(actorUser) ||
    actorUser.companyId !== identity.companyId ||
    actorUser.isTemporary !== false ||
    actorUser.disabled !== false ||
    actorUser.isAdmin !== true
  ) {
    throw new CompanyProfileUpdateError(
      COMPANY_PROFILE_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[updateCompanyProfile] Actor is not an active Company administrator",
    );
  }
}

export async function updateCompanyProfile({
  firestore,
  identity,
  input,
  serverTimestampFactory = () => FieldValue.serverTimestamp(),
} = {}) {
  if (!firestore || typeof firestore.doc !== "function") {
    throw new CompanyProfileUpdateError(
      COMPANY_PROFILE_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      "[updateCompanyProfile] Firestore service is invalid",
    );
  }
  if (!identity || typeof identity !== "object") {
    throw new CompanyProfileUpdateError(
      COMPANY_PROFILE_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      "[updateCompanyProfile] Identity is invalid",
    );
  }
  assertIdentifier(identity.companyId, "companyId");
  assertIdentifier(identity.uid, "actorUid");

  const changes = parseCompanyProfileChanges(input);
  const companyRef = firestore.doc(`Companies/${identity.companyId}`);
  const actorRef = firestore.doc(
    `Companies/${identity.companyId}/Users/${identity.uid}`,
  );

  let updatedFields = [];
  await firestore.runTransaction(async (transaction) => {
    const actorSnapshot = await transaction.get(actorRef);
    assertActor(identity, actorSnapshot.exists ? actorSnapshot.data() : null);

    const companySnapshot = await transaction.get(companyRef);
    if (!companySnapshot.exists) {
      throw new CompanyProfileUpdateError(
        COMPANY_PROFILE_UPDATE_ERROR_CODES.COMPANY_NOT_FOUND,
        "[updateCompanyProfile] Company was not found",
      );
    }

    const update = buildCompanyProfileUpdate(companySnapshot.data(), changes);
    updatedFields = Object.keys(update).filter(
      (field) => field !== "location" && field !== "geopoint",
    );
    if (updatedFields.length === 0) return;

    transaction.update(companyRef, {
      ...update,
      updatedAt: serverTimestampFactory(),
      uid: identity.uid,
    });
  });

  return {
    success: true,
    updated: updatedFields.length > 0,
    updatedFields,
  };
}
