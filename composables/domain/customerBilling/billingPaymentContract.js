import {
  plain,
  identifier,
  parseDate,
  dateInput,
  equal,
  expectedFields,
} from "../shared/valueContract.js";

// Client-only UX gating, draft projection, and expected-value encoding.
// Functions reauthorize and validate the latest Billing before persisting.

export const PAYMENT_FIELDS = Object.freeze([
  "paymentDueDateAt",
  "paymentDueDate",
  "paymentDueMonth",
]);

export const billingIdentifier = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 268 &&
  value.trim() === value &&
  !/[\/\u0000-\u001f\u007f]/u.test(value);

/** Client UX gate only; Functions authentication and authorization remain authoritative. */
export function isBillingPaymentUxActorAllowed(identity, user) {
  return (
    identifier(identity?.uid) &&
    identifier(identity?.companyId) &&
    typeof identity.isSuperUser === "boolean" &&
    plain(user) &&
    user.docId === identity.uid &&
    user.companyId === identity.companyId &&
    user.disabled === false &&
    user.isTemporary === false
  );
}

export const paymentExpected = (raw) =>
  expectedFields(raw, ["paymentDueDateAt", "billingDateAt"]);

export function paymentPatch(raw, value) {
  const paymentDueDateAt = parseDate(value);
  const billingDate = dateInput(raw.billingDateAt);
  if (!billingDate) throw new TypeError("missing billing date");
  if (value !== null && value < billingDate) {
    throw new TypeError("payment date precedes billing date");
  }
  return {
    paymentDueDateAt,
    paymentDueDate: value,
    paymentDueMonth: value === null ? null : value.slice(0, 7),
  };
}

export function paymentMatches(raw, patch) {
  return PAYMENT_FIELDS.every((key) => equal(raw[key], patch[key]));
}
