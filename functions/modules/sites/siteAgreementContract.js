import { AgreementV2 } from "@shisyamo4131/air-guard-v2-schemas";

export const SITE_AGREEMENT_DAY_TYPES = Object.freeze([
  "WEEKDAY", "SATURDAY", "SUNDAY", "HOLIDAY",
]);
export const SITE_AGREEMENT_RATE_FIELDS = Object.freeze([
  "unitPriceBase", "overtimeUnitPriceBase",
  "unitPriceQualified", "overtimeUnitPriceQualified",
]);
export const SITE_AGREEMENT_FIELDS = Object.freeze([
  "date", "shiftType", "startTime", "isStartNextDay", "endTime",
  "breakMinutes", "regulationWorkMinutes", "rates", "billingUnitType",
  "includeBreakInBilling", "cutoffDate",
]);

const INPUT_FIELDS = Object.freeze([
  "siteId", "baselineAgreements", "candidateAgreements",
]);
const CUTOFF_DATES = Object.freeze([0, 5, 10, 15, 20, 25]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export class SiteAgreementContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SiteAgreementContractError";
    this.code = code;
  }
}

function fail(message) {
  throw new SiteAgreementContractError("invalid-input", message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownKeys(value) {
  return Reflect.ownKeys(value).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key),
  );
}

function assertExactKeys(value, fields, message) {
  if (!isPlainObject(value)) fail(message);
  const keys = ownKeys(value);
  if (keys.length !== fields.length || keys.some((key) =>
    typeof key !== "string" || !fields.includes(key)) ||
    fields.some((field) => !Object.hasOwn(value, field))) fail(message);
}

function calendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) fail("Agreement date is invalid");
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day) fail("Agreement date is invalid");
  return value;
}

function dateFromStored(value) {
  if (typeof value?.date === "string") return calendarDate(value.date);
  const source = value?.dateAt?.toDate?.() ?? value?.dateAt;
  if (!(source instanceof Date) || Number.isNaN(source.getTime())) fail("Agreement date is invalid");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(source);
  const item = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return calendarDate(`${item.year}-${item.month}-${item.day}`);
}

function integer(value, min, max, message) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(message);
  return value;
}

export function siteAgreementWorkIntervalMinutes(startTime, endTime) {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) fail("Agreement time is invalid");
  const toMinutes = (value) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const difference = (toMinutes(endTime) - toMinutes(startTime) + 1440) % 1440;
  return difference === 0 ? 1440 : difference;
}

function normalizeRates(value, exact) {
  if (exact) assertExactKeys(value, SITE_AGREEMENT_DAY_TYPES, "Agreement rates are invalid");
  else if (!isPlainObject(value)) fail("Agreement rates are invalid");
  return Object.fromEntries(SITE_AGREEMENT_DAY_TYPES.map((dayType) => {
    const rateSet = value[dayType];
    if (exact) assertExactKeys(rateSet, SITE_AGREEMENT_RATE_FIELDS, "Agreement rates are invalid");
    else if (!isPlainObject(rateSet)) fail("Agreement rates are invalid");
    return [dayType, Object.fromEntries(SITE_AGREEMENT_RATE_FIELDS.map((field) => [
      field,
      integer(rateSet[field], 0, 10000000, "Agreement price is invalid"),
    ]))];
  }));
}

export function normalizeSiteAgreement(value, { exact = false } = {}) {
  if (exact) assertExactKeys(value, SITE_AGREEMENT_FIELDS, "Agreement fields are invalid");
  else if (!isPlainObject(value)) fail("Agreement is invalid");
  const date = exact ? calendarDate(value.date) : dateFromStored(value);
  if (!["DAY", "NIGHT"].includes(value.shiftType)) fail("Agreement shift is invalid");
  const interval = siteAgreementWorkIntervalMinutes(value.startTime, value.endTime);
  if (typeof value.isStartNextDay !== "boolean") fail("Agreement next-day flag is invalid");
  const breakMinutes = integer(value.breakMinutes, 0, 1440, "Agreement break is invalid");
  if (breakMinutes > interval) fail("Agreement break exceeds the work interval");
  const regulationWorkMinutes = integer(
    value.regulationWorkMinutes, 0, 1440, "Agreement regulation time is invalid",
  );
  if (!["PER_DAY", "PER_HOUR"].includes(value.billingUnitType)) fail("Agreement billing unit is invalid");
  if (typeof value.includeBreakInBilling !== "boolean") fail("Agreement billing flag is invalid");
  const cutoffDate = integer(value.cutoffDate, 0, 25, "Agreement cutoff is invalid");
  if (!CUTOFF_DATES.includes(cutoffDate)) fail("Agreement cutoff is invalid");
  return Object.freeze({
    date,
    shiftType: value.shiftType,
    startTime: value.startTime,
    isStartNextDay: value.isStartNextDay,
    endTime: value.endTime,
    breakMinutes,
    regulationWorkMinutes,
    rates: normalizeRates(value.rates, exact),
    billingUnitType: value.billingUnitType,
    includeBreakInBilling: value.includeBreakInBilling,
    cutoffDate,
  });
}

export function normalizeSiteAgreements(value, options = {}) {
  if (!Array.isArray(value)) fail("Agreements must be an array");
  const result = value.map((agreement) => normalizeSiteAgreement(agreement, options));
  const keys = new Set();
  for (const agreement of result) {
    const key = `${agreement.date}_${agreement.shiftType}`;
    if (keys.has(key)) fail("Agreement key is duplicated");
    keys.add(key);
  }
  return Object.freeze(result);
}

export function parseSiteAgreementUpdateInput(input) {
  assertExactKeys(input, INPUT_FIELDS, "Input fields are invalid");
  if (typeof input.siteId !== "string" || input.siteId.trim() !== input.siteId ||
      input.siteId.length < 1 || input.siteId.length > 128 || input.siteId.includes("/") ||
      /[\u0000-\u001f\u007f]/u.test(input.siteId)) fail("Site id is invalid");
  return Object.freeze({
    siteId: input.siteId,
    baselineAgreements: normalizeSiteAgreements(input.baselineAgreements, { exact: true }),
    candidateAgreements: normalizeSiteAgreements(input.candidateAgreements, { exact: true }),
  });
}

export function siteAgreementsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildStoredSiteAgreements(value) {
  return normalizeSiteAgreements(value, { exact: true }).map((agreement) => {
    const model = new AgreementV2({
      ...agreement,
      dateAt: new Date(`${agreement.date}T00:00:00+09:00`),
    });
    return AgreementV2.converter().toFirestore(model);
  });
}
