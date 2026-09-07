/*****************************************************************************
 * @file ./functions/modules/company/updateCompanyBilling.js
 * @description Company振込先をoperation所有fieldだけで更新します。
 *****************************************************************************/
import { FieldValue } from "firebase-admin/firestore";
import {
  CompanyConfigurationValidationError,
  parseUpdateCompanyBillingInputV1,
} from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

export const COMPANY_BILLING_FIELDS = Object.freeze([
  "bankName",
  "branchName",
  "accountType",
  "accountNumber",
  "accountHolder",
]);

export const COMPANY_BILLING_UPDATE_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "invalid-input",
  INVALID_DEPENDENCY: "invalid-dependency",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  COMPANY_NOT_FOUND: "company-not-found",
});

export class CompanyBillingUpdateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "CompanyBillingUpdateError";
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
    throw new CompanyBillingUpdateError(
      COMPANY_BILLING_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      `[updateCompanyBilling] ${name} is invalid`,
    );
  }
}

export function parseCompanyBillingChanges(input) {
  if (
    !isPlainRecord(input) ||
    Object.keys(input).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(input, "changes") ||
    !isPlainRecord(input.changes)
  ) {
    throw new CompanyBillingUpdateError(
      COMPANY_BILLING_UPDATE_ERROR_CODES.INVALID_INPUT,
      "[updateCompanyBilling] Input must contain only a changes object",
    );
  }

  const entries = Object.entries(input.changes);
  if (
    entries.length === 0 ||
    entries.some(([field]) => !COMPANY_BILLING_FIELDS.includes(field))
  ) {
    throw new CompanyBillingUpdateError(
      COMPANY_BILLING_UPDATE_ERROR_CODES.INVALID_INPUT,
      "[updateCompanyBilling] Changes are empty or contain an unmanaged field",
    );
  }

  return Object.fromEntries(entries);
}

function currentBilling(company) {
  return {
    invoiceNumber: company.invoiceNumber ?? null,
    ...Object.fromEntries(
      COMPANY_BILLING_FIELDS.map((field) => [field, company[field] ?? null]),
    ),
  };
}

function isLegacyDefaultOnlyBilling(company) {
  const billing = currentBilling(company);
  return (
    billing.accountType === "普通" &&
    COMPANY_BILLING_FIELDS.filter((field) => field !== "accountType").every(
      (field) => billing[field] === null,
    )
  );
}

function isNoopChange(company, changes) {
  return Object.entries(changes).every(([field, value]) =>
    Object.is(company[field] ?? null, value),
  );
}

export function buildCompanyBillingUpdate(company, changes) {
  if (isLegacyDefaultOnlyBilling(company) && isNoopChange(company, changes)) {
    return {};
  }

  let normalized;
  try {
    normalized = parseUpdateCompanyBillingInputV1({
      expectedRevision: 1,
      value: { ...currentBilling(company), ...changes },
    }).value;
  } catch (error) {
    if (error instanceof CompanyConfigurationValidationError) {
      throw new CompanyBillingUpdateError(
        COMPANY_BILLING_UPDATE_ERROR_CODES.INVALID_INPUT,
        `[updateCompanyBilling] Invalid Company billing at ${error.path}`,
        { cause: error },
      );
    }
    throw error;
  }

  return Object.fromEntries(
    Object.keys(changes)
      .filter(
        (field) => !Object.is(company[field] ?? null, normalized[field]),
      )
      .map((field) => [field, normalized[field]]),
  );
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
    throw new CompanyBillingUpdateError(
      COMPANY_BILLING_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[updateCompanyBilling] Actor is not an active Company administrator",
    );
  }
}

export async function updateCompanyBilling({
  firestore,
  identity,
  input,
  serverTimestampFactory = () => FieldValue.serverTimestamp(),
} = {}) {
  if (!firestore || typeof firestore.doc !== "function") {
    throw new CompanyBillingUpdateError(
      COMPANY_BILLING_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      "[updateCompanyBilling] Firestore service is invalid",
    );
  }
  if (!identity || typeof identity !== "object") {
    throw new CompanyBillingUpdateError(
      COMPANY_BILLING_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      "[updateCompanyBilling] Identity is invalid",
    );
  }
  assertIdentifier(identity.companyId, "companyId");
  assertIdentifier(identity.uid, "actorUid");

  const changes = parseCompanyBillingChanges(input);
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
      throw new CompanyBillingUpdateError(
        COMPANY_BILLING_UPDATE_ERROR_CODES.COMPANY_NOT_FOUND,
        "[updateCompanyBilling] Company was not found",
      );
    }

    const update = buildCompanyBillingUpdate(companySnapshot.data(), changes);
    updatedFields = Object.keys(update);
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
