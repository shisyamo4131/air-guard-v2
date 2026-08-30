/*****************************************************************************
 * @file ./functions/modules/company/updateCompanyArrangement.js
 * @description Company表示順を対象fieldだけで更新します。
 *****************************************************************************/
import { FieldValue } from "firebase-admin/firestore";
import { resolveRolePermissions } from "../auth/policies/rolePermissions.js";

export const COMPANY_ARRANGEMENT_FIELDS = Object.freeze([
  "siteOrder",
  "scheduleOrder",
]);

const REQUIRED_PERMISSION_BY_FIELD = Object.freeze({
  siteOrder: "sites:write",
  scheduleOrder: "site-operation-schedules:write",
});

export const COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "invalid-input",
  INVALID_DEPENDENCY: "invalid-dependency",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  COMPANY_NOT_FOUND: "company-not-found",
});

export class CompanyArrangementUpdateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "CompanyArrangementUpdateError";
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
    throw new CompanyArrangementUpdateError(
      COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      `[updateCompanyArrangement] ${name} is invalid`,
    );
  }
}

function isValidSiteId(value) {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    !value.includes("/") &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export function parseCompanyArrangementInput(input) {
  if (
    !isPlainRecord(input) ||
    Object.keys(input).length !== 2 ||
    !Object.hasOwn(input, "field") ||
    !Object.hasOwn(input, "order") ||
    !COMPANY_ARRANGEMENT_FIELDS.includes(input.field) ||
    !Array.isArray(input.order) ||
    input.order.length > 2000
  ) {
    throw new CompanyArrangementUpdateError(
      COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.INVALID_INPUT,
      "[updateCompanyArrangement] Input must contain an allowed field and order",
    );
  }

  const keys = new Set();
  const order = input.order.map((item, index) => {
    if (
      !isPlainRecord(item) ||
      Object.keys(item).length !== 2 ||
      !Object.hasOwn(item, "siteId") ||
      !Object.hasOwn(item, "shiftType") ||
      !isValidSiteId(item.siteId) ||
      !["DAY", "NIGHT"].includes(item.shiftType)
    ) {
      throw new CompanyArrangementUpdateError(
        COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.INVALID_INPUT,
        `[updateCompanyArrangement] Invalid order item at index ${index}`,
      );
    }

    const key = `${item.siteId}\u0000${item.shiftType}`;
    if (keys.has(key)) {
      throw new CompanyArrangementUpdateError(
        COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.INVALID_INPUT,
        `[updateCompanyArrangement] Duplicate order item at index ${index}`,
      );
    }
    keys.add(key);
    return { siteId: item.siteId, shiftType: item.shiftType };
  });

  return { field: input.field, order };
}

function ordersEqual(current, requested) {
  if (!Array.isArray(current) || current.length !== requested.length) {
    return false;
  }
  return current.every(
    (item, index) =>
      item?.siteId === requested[index].siteId &&
      item?.shiftType === requested[index].shiftType,
  );
}

function assertActor(identity, actorUser, field) {
  if (
    identity.isSuperUser !== false ||
    !isPlainRecord(actorUser) ||
    actorUser.companyId !== identity.companyId ||
    actorUser.isTemporary !== false ||
    actorUser.disabled !== false ||
    typeof actorUser.isAdmin !== "boolean"
  ) {
    throw new CompanyArrangementUpdateError(
      COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[updateCompanyArrangement] Actor is not active in the Company",
    );
  }

  if (actorUser.isAdmin === true) return;

  let permissions;
  try {
    permissions = resolveRolePermissions(actorUser.roles);
  } catch (error) {
    throw new CompanyArrangementUpdateError(
      COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[updateCompanyArrangement] Actor roles are not approved presets",
      { cause: error },
    );
  }

  if (!permissions.includes(REQUIRED_PERMISSION_BY_FIELD[field])) {
    throw new CompanyArrangementUpdateError(
      COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[updateCompanyArrangement] Actor lacks the required preset permission",
    );
  }
}

export async function updateCompanyArrangement({
  firestore,
  identity,
  input,
  serverTimestampFactory = () => FieldValue.serverTimestamp(),
} = {}) {
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.runTransaction !== "function"
  ) {
    throw new CompanyArrangementUpdateError(
      COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      "[updateCompanyArrangement] Firestore service is invalid",
    );
  }
  if (!identity || typeof identity !== "object") {
    throw new CompanyArrangementUpdateError(
      COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.INVALID_DEPENDENCY,
      "[updateCompanyArrangement] Identity is invalid",
    );
  }
  assertIdentifier(identity.companyId, "companyId");
  assertIdentifier(identity.uid, "actorUid");

  const { field, order } = parseCompanyArrangementInput(input);
  const companyRef = firestore.doc(`Companies/${identity.companyId}`);
  const actorRef = firestore.doc(
    `Companies/${identity.companyId}/Users/${identity.uid}`,
  );

  let updated = false;
  await firestore.runTransaction(async (transaction) => {
    const actorSnapshot = await transaction.get(actorRef);
    assertActor(
      identity,
      actorSnapshot.exists ? actorSnapshot.data() : null,
      field,
    );

    const companySnapshot = await transaction.get(companyRef);
    if (!companySnapshot.exists) {
      throw new CompanyArrangementUpdateError(
        COMPANY_ARRANGEMENT_UPDATE_ERROR_CODES.COMPANY_NOT_FOUND,
        "[updateCompanyArrangement] Company was not found",
      );
    }

    if (ordersEqual(companySnapshot.data()?.[field], order)) return;

    transaction.update(companyRef, {
      [field]: order,
      updatedAt: serverTimestampFactory(),
      uid: identity.uid,
    });
    updated = true;
  });

  return { success: true, updated, field };
}
