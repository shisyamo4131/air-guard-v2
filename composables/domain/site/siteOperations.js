import { Site } from "../../../schemas/index.js";

export const SITE_OPERATION = Object.freeze({
  CREATE: "CREATE",
  UPDATE_BASIC: "UPDATE_BASIC",
  UPDATE_CUSTOMER: "UPDATE_CUSTOMER",
  UPDATE_AGREEMENTS: "UPDATE_AGREEMENTS",
});

export const SITE_BASIC_FIELDS = Object.freeze([
  "code",
  "name",
  "hasAbbreviation",
  "abbreviation",
  "nameKana",
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
  "securityType",
  "siteNumber",
  "constructionPeriodStartAt",
  "constructionPeriodEndAt",
  "remarks",
]);

export const SITE_CUSTOMER_FIELDS = Object.freeze(["customerId"]);
export const SITE_AGREEMENT_FIELDS = Object.freeze(["agreementsV2"]);
export const SITE_CREATE_FIELDS = Object.freeze([
  "customerId",
  "customerName",
  ...SITE_BASIC_FIELDS,
]);
export const SITE_ADDRESS_FIELDS = Object.freeze([
  "prefCode",
  "city",
  "address",
]);
export const SITE_TOKEN_FIELDS = Object.freeze(["name", "nameKana"]);
export const SITE_DISPLAY_NAME_FIELDS = Object.freeze([
  "name",
  "hasAbbreviation",
  "abbreviation",
]);
export const SITE_CONSTRUCTION_FIELDS = Object.freeze([
  "constructionPeriodStartAt",
  "constructionPeriodEndAt",
]);

const OPERATION_FIELDS = Object.freeze({
  [SITE_OPERATION.CREATE]: SITE_CREATE_FIELDS,
  [SITE_OPERATION.UPDATE_BASIC]: SITE_BASIC_FIELDS,
  [SITE_OPERATION.UPDATE_CUSTOMER]: SITE_CUSTOMER_FIELDS,
  [SITE_OPERATION.UPDATE_AGREEMENTS]: SITE_AGREEMENT_FIELDS,
});

export class SiteOperationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SiteOperationError";
    this.code = code;
  }
}

export function cloneSiteValue(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneSiteValue);
  if (value?.toObject && typeof value.toObject === "function") {
    return cloneSiteValue(value.toObject());
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneSiteValue(item)]),
    );
  }
  return value;
}

export function siteValuesEqual(left, right) {
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime();
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => siteValuesEqual(item, right[index]));
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftObject = left?.toObject ? left.toObject() : left;
    const rightObject = right?.toObject ? right.toObject() : right;
    const leftKeys = Object.keys(leftObject);
    const rightKeys = Object.keys(rightObject);
    return leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => Object.hasOwn(rightObject, key) &&
          siteValuesEqual(leftObject[key], rightObject[key]),
      );
  }
  return Object.is(left ?? null, right ?? null);
}

export function siteOperationFields(operation) {
  const fields = OPERATION_FIELDS[operation];
  if (!fields) {
    throw new SiteOperationError(
      "invalid-operation",
      "現場の操作内容を確認してください。",
    );
  }
  return fields;
}

export function siteOperationSchema(operation) {
  const schemaByKey = new Map(
    Site.schema.map((definition) => [definition.key, definition]),
  );
  return siteOperationFields(operation).map((field) => schemaByKey.get(field));
}

export function siteSnapshot(source = {}, operation) {
  return Object.fromEntries(
    siteOperationFields(operation).map((field) => [
      field,
      cloneSiteValue(source?.[field] ?? null),
    ]),
  );
}

export function siteSnapshotsEqual(left, right, operation) {
  return siteOperationFields(operation).every((field) =>
    siteValuesEqual(left?.[field], right?.[field]),
  );
}

export function changedSiteFields({ operation, baseline, draft }) {
  return siteOperationFields(operation).filter(
    (field) => !siteValuesEqual(baseline?.[field], draft?.[field]),
  );
}

export function conflictingSiteFields({ operation, baseline, latest, draft }) {
  return changedSiteFields({ operation, baseline, draft }).filter(
    (field) => !siteValuesEqual(baseline?.[field], latest?.[field]),
  );
}

function assertString(value, field, { required = false, max } = {}) {
  if (value == null) {
    if (!required) return;
    throw new SiteOperationError("invalid-site", `${field}を入力してください。`);
  }
  if (
    typeof value !== "string" ||
    (required && value.length === 0) ||
    (typeof max === "number" && value.length > max)
  ) {
    throw new SiteOperationError(
      "invalid-site",
      `${field}の入力内容を確認してください。`,
    );
  }
}

export function validateSiteCandidate(candidate) {
  if (!(candidate instanceof Site)) {
    throw new SiteOperationError("invalid-site", "現場の入力内容を確認してください。");
  }
  try {
    candidate.validate();
  } catch (error) {
    const first = error?.validationErrors?.[0];
    throw new SiteOperationError(
      "invalid-site",
      first?.messages?.ja || "現場の入力内容を確認してください。",
    );
  }

  assertString(candidate.customerId, "取引先", { max: 128 });
  assertString(candidate.customerName, "取引先名", { max: 20 });
  assertString(candidate.code, "現場コード", { max: 10 });
  assertString(candidate.name, "現場名", { required: true, max: 40 });
  assertString(candidate.abbreviation, "略称", {
    required: candidate.hasAbbreviation,
    max: 40,
  });
  assertString(candidate.nameKana, "現場名（カナ）", {
    required: true,
    max: 60,
  });
  assertString(candidate.zipcode, "郵便番号");
  assertString(candidate.prefCode, "都道府県", { required: true, max: 2 });
  assertString(candidate.city, "市区町村", { required: true, max: 20 });
  assertString(candidate.address, "町域名・番地", { required: true, max: 30 });
  assertString(candidate.building, "建物名・階数", { max: 30 });
  assertString(candidate.siteNumber, "現場番号", { max: 40 });
  assertString(candidate.remarks, "備考", { max: 200 });
  if (typeof candidate.hasAbbreviation !== "boolean") {
    throw new SiteOperationError("invalid-site", "略称の使用設定を確認してください。");
  }
  if (!/^(0[1-9]|[1-3][0-9]|4[0-7])$/u.test(candidate.prefCode)) {
    throw new SiteOperationError("invalid-site", "都道府県を確認してください。");
  }
  if (!["UNSET", "FACILITY", "CROWD", "TRAFFIC", "TRAINING", "OTHER"].includes(candidate.securityType)) {
    throw new SiteOperationError("invalid-site", "警備種別を確認してください。");
  }
  if (![Site.STATUS_ACTIVE, Site.STATUS_TERMINATED].includes(candidate.status)) {
    throw new SiteOperationError("invalid-site", "現場の状態を確認してください。");
  }
  if (!candidate.customerId && !candidate.customerName) {
    throw new SiteOperationError(
      "invalid-site",
      "取引先が未設定の場合は取引先名を入力してください。",
    );
  }
  for (const value of [
    candidate.constructionPeriodStartAt,
    candidate.constructionPeriodEndAt,
  ]) {
    if (value != null && !(value instanceof Date)) {
      throw new SiteOperationError("invalid-site", "工期を確認してください。");
    }
  }
  if (
    candidate.constructionPeriodStartAt &&
    candidate.constructionPeriodEndAt &&
    candidate.constructionPeriodStartAt > candidate.constructionPeriodEndAt
  ) {
    throw new SiteOperationError("invalid-site", "工期の開始日と終了日を確認してください。");
  }
  if (!Array.isArray(candidate.agreementsV2)) {
    throw new SiteOperationError("invalid-site", "取極め情報を確認してください。");
  }
  return candidate;
}

export function getSiteOperationErrorMessage(error, fallback) {
  return error instanceof SiteOperationError || error?.name === "SiteAuthorizationError"
    ? error.message
    : fallback;
}

export async function prepareSiteCreate({ draft, docId, actorUid, now }) {
  const candidate = new Site(draft?.toObject?.() ?? draft ?? {});
  candidate.docId = docId;
  candidate.uid = actorUid;
  candidate.createdAt = now;
  candidate.updatedAt = now;
  candidate.status = Site.STATUS_ACTIVE;
  candidate.agreementsV2 = [];
  await candidate.beforeCreate();
  validateSiteCandidate(candidate);
  return candidate;
}

export function prepareSiteUpdate({
  operation,
  latest,
  baseline,
  draft,
  actorUid,
  now,
  customer,
  location,
}) {
  if (!(latest instanceof Site) || !latest.docId) {
    throw new SiteOperationError("not-found", "現場の最新情報を確認できません。");
  }
  const conflicts = conflictingSiteFields({ operation, baseline, latest, draft });
  if (conflicts.length) {
    throw new SiteOperationError(
      "conflict",
      "別の画面で同じ現場情報が更新されました。最新情報を読み直してください。",
    );
  }
  const fields = changedSiteFields({ operation, baseline, draft });
  const candidate = new Site(latest.toObject());
  if (!fields.length) return { candidate, fields: [] };

  Object.assign(
    candidate,
    Object.fromEntries(fields.map((field) => [field, cloneSiteValue(draft[field])])),
  );
  if (operation === SITE_OPERATION.UPDATE_CUSTOMER) {
    if (latest.customerId && !candidate.customerId) {
      throw new SiteOperationError(
        "invalid-customer",
        "設定済みの取引先は未設定へ戻せません。",
      );
    }
  }
  candidate.customer = candidate.customerId ? customer : null;
  if (candidate.customerId && !candidate.customer) {
    throw new SiteOperationError("invalid-customer", "取引先の最新情報を確認できません。");
  }
  if (location !== undefined) candidate.location = cloneSiteValue(location);
  candidate.uid = actorUid;
  candidate.updatedAt = now;
  validateSiteCandidate(candidate);
  return { candidate, fields };
}
