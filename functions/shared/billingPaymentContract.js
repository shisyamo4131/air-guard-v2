import { plain, identifier, parseDate, dateInput, equal, expectedFields } from "./employeeContract.js";
import { OperationWriteError } from "./operationReferences.js";

export const PAYMENT_FIELDS = Object.freeze(["paymentDueDateAt", "paymentDueDate", "paymentDueMonth"]);
export const billingIdentifier = (value) => typeof value === "string" && value.length > 0 && value.length <= 268 && value.trim() === value && !/[\/\u0000-\u001f\u007f]/u.test(value);
export function paymentActorAllowed(identity, user) {
  return identifier(identity?.uid) && identifier(identity?.companyId) && typeof identity.isSuperUser === "boolean"
    && plain(user) && user.docId === identity.uid && user.companyId === identity.companyId && user.disabled === false && user.isTemporary === false;
}
export const paymentExpected = (raw) => expectedFields(raw, ["paymentDueDateAt", "billingDateAt"]);
export function paymentPatch(raw, value) {
  const paymentDueDateAt = parseDate(value);
  const billingDate = dateInput(raw.billingDateAt);
  if (!billingDate) throw new OperationWriteError("failed-precondition", "請求日を確認できません。");
  if (value !== null && value < billingDate) throw new OperationWriteError("invalid-argument", "入金予定日は請求日以降を指定してください。");
  return { paymentDueDateAt, paymentDueDate: value, paymentDueMonth: value === null ? null : value.slice(0, 7) };
}
export function parsePaymentInput(input) {
  if (!plain(input) || Object.keys(input).some((key) => !["documentId", "paymentDueDate", "expected"].includes(key))
    || !billingIdentifier(input.documentId) || !Object.hasOwn(input, "paymentDueDate") || !plain(input.expected)) throw new OperationWriteError("invalid-argument");
  parseDate(input.paymentDueDate);
  return input;
}
export function paymentMatches(raw, patch) { return PAYMENT_FIELDS.every((key) => equal(raw[key], patch[key])); }
