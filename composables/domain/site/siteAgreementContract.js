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
  throw new SiteAgreementContractError("invalid-agreement", message);
}

function calendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) fail("適用開始日を確認してください。");
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day) fail("適用開始日を確認してください。");
  return value;
}

function dateFromAgreement(value) {
  if (typeof value?.date === "string") return calendarDate(value.date);
  const source = value?.dateAt?.toDate?.() ?? value?.dateAt;
  if (!(source instanceof Date) || Number.isNaN(source.getTime())) {
    fail("適用開始日を確認してください。");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(source);
  const item = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${item.year}-${item.month}-${item.day}`;
}

function integer(value, min, max, message) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(message);
  return value;
}

function minutes(value) {
  const [hours, minute] = value.split(":").map(Number);
  return hours * 60 + minute;
}

export function siteAgreementWorkIntervalMinutes(startTime, endTime) {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    fail("勤務時刻を確認してください。");
  }
  const difference = (minutes(endTime) - minutes(startTime) + 1440) % 1440;
  return difference === 0 ? 1440 : difference;
}

function normalizeRates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("単価を確認してください。");
  return Object.fromEntries(SITE_AGREEMENT_DAY_TYPES.map((dayType) => {
    const rateSet = value[dayType];
    if (!rateSet || typeof rateSet !== "object" || Array.isArray(rateSet)) {
      fail("単価を確認してください。");
    }
    return [dayType, Object.fromEntries(SITE_AGREEMENT_RATE_FIELDS.map((field) => [
      field,
      integer(rateSet[field], 0, 10000000, "単価は0円以上10,000,000円以下の整数で入力してください。"),
    ]))];
  }));
}

export function normalizeSiteAgreement(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("取極めを確認してください。");
  const date = dateFromAgreement(value);
  const shiftType = value.shiftType;
  if (!["DAY", "NIGHT"].includes(shiftType)) fail("勤務区分を確認してください。");
  const startTime = value.startTime;
  const endTime = value.endTime;
  const interval = siteAgreementWorkIntervalMinutes(startTime, endTime);
  if (typeof value.isStartNextDay !== "boolean") fail("翌日開始設定を確認してください。");
  const breakMinutes = integer(value.breakMinutes, 0, 1440, "休憩時間を確認してください。");
  if (breakMinutes > interval) fail("休憩時間は勤務区間以内で入力してください。");
  const regulationWorkMinutes = integer(
    value.regulationWorkMinutes, 0, 1440, "規定実働時間を確認してください。",
  );
  if (!["PER_DAY", "PER_HOUR"].includes(value.billingUnitType)) {
    fail("請求単位を確認してください。");
  }
  if (typeof value.includeBreakInBilling !== "boolean") fail("休憩時間の請求設定を確認してください。");
  const cutoffDate = integer(value.cutoffDate, 0, 25, "締日を確認してください。");
  if (!CUTOFF_DATES.includes(cutoffDate)) fail("締日を確認してください。");
  return Object.freeze({
    date, shiftType, startTime, isStartNextDay: value.isStartNextDay, endTime,
    breakMinutes, regulationWorkMinutes, rates: normalizeRates(value.rates),
    billingUnitType: value.billingUnitType,
    includeBreakInBilling: value.includeBreakInBilling,
    cutoffDate,
  });
}

export function normalizeSiteAgreements(value) {
  if (!Array.isArray(value)) fail("取極めを確認してください。");
  const result = value.map(normalizeSiteAgreement);
  const keys = new Set();
  for (const agreement of result) {
    const key = `${agreement.date}_${agreement.shiftType}`;
    if (keys.has(key)) fail("同じ適用開始日と勤務区分の取極めが重複しています。");
    keys.add(key);
  }
  return Object.freeze(result);
}

export function siteAgreementsHaveZeroPrice(value) {
  return normalizeSiteAgreements(value).some((agreement) =>
    SITE_AGREEMENT_DAY_TYPES.some((dayType) =>
      SITE_AGREEMENT_RATE_FIELDS.some((field) => agreement.rates[dayType][field] === 0),
    ),
  );
}
