import { defField, Site as BaseSite, SiteOperationSchedule } from "@shisyamo4131/air-guard-v2-schemas";

const LIFECYCLE_FIELDS = [
  "statusChangedAt",
  "statusChangedBy",
  "statusChangeSource",
  "statusChangeReason",
];

function jstToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function assertNoBlockingSchedules(siteId) {
  const schedule = new SiteOperationSchedule();
  const [future, unprocessed] = await Promise.all([
    schedule.fetchDocs({
      constraints: [
        ["where", "siteId", "==", siteId],
        ["where", "date", ">=", jstToday()],
        ["limit", 1],
      ],
    }),
    schedule.fetchDocs({
      constraints: [
        ["where", "siteId", "==", siteId],
        ["where", "operationResultId", "==", null],
        ["limit", 1],
      ],
    }),
  ]);
  if (future.length || unprocessed.length) {
    throw new Error("JST当日以降の予定または未処理予定がある現場は終了できません。");
  }
}

function isValidReason(value) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200;
}

function isValidTransitionMetadata(site, expectedSource) {
  return site.statusChangeSource === expectedSource &&
    isValidReason(site.statusChangeReason) &&
    site.statusChangedAt instanceof Date &&
    !Number.isNaN(site.statusChangedAt.getTime()) &&
    typeof site.statusChangedBy === "string" &&
    site.statusChangedBy.length > 0;
}

function normalizedValue(value) {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (Array.isArray(value)) return value.map(normalizedValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizedValue(value[key])]));
  }
  return value;
}

function changedFields(site) {
  const before = site._beforeData || {};
  const current = site.toObject();
  return [...new Set([...Object.keys(before), ...Object.keys(current)])]
    .filter((key) => key !== "_beforeData")
    .filter((key) => JSON.stringify(normalizedValue(before[key])) !== JSON.stringify(normalizedValue(current[key])));
}

const COMMON_UPDATE_FIELDS = new Set(["uid", "updatedAt", ...LIFECYCLE_FIELDS, "status"]);
const REACTIVATION_UPDATE_FIELDS = new Set([
  ...COMMON_UPDATE_FIELDS,
  "constructionPeriodStartAt",
  "constructionPeriodEndAt",
  "hasConstructionPeriod",
  "hasConstructionPeriodStartAt",
  "hasConstructionPeriodEndAt",
]);

export default class Site extends BaseSite {
  static classProps = {
    ...BaseSite.classProps,
    statusChangedAt: defField("dateTimeAt", { label: "状態変更日時", hidden: true }),
    statusChangedBy: defField("oneLine", { label: "状態変更者", length: 128, hidden: true }),
    statusChangeSource: defField("oneLine", {
      label: "状態変更元",
      length: 20,
      hidden: true,
      validator: (value) => value == null || ["MANUAL", "REACTIVATION", "AUTO"].includes(value),
    }),
    statusChangeReason: defField("multipleLine", { label: "状態変更理由", length: 200, hidden: true }),
  };

  afterInitialize(item = {}) {
    super.afterInitialize(item);
    for (const field of LIFECYCLE_FIELDS) {
      if (!Object.hasOwn(item, field)) delete this[field];
    }
  }

  async beforeUpdate(args = {}) {
    await super.beforeUpdate(args);

    const previousStatus = this._beforeData?.status;
    const nextStatus = this.status;
    if (previousStatus === nextStatus) {
      return;
    }

    if (previousStatus === Site.STATUS_ACTIVE && nextStatus === Site.STATUS_TERMINATED) {
      if (!isValidTransitionMetadata(this, "MANUAL")) {
        throw new Error("終了理由と状態変更metadataを確認してください。");
      }
      if (this.constructionPeriodStartAt?.getTime?.() !== this._beforeData.constructionPeriodStartAt?.getTime?.() ||
          this.constructionPeriodEndAt?.getTime?.() !== this._beforeData.constructionPeriodEndAt?.getTime?.()) {
        throw new Error("現場終了では工期を変更できません。");
      }
      if (changedFields(this).some((field) => !COMMON_UPDATE_FIELDS.has(field))) {
        throw new Error("現場終了では状態変更に関係しない項目を変更できません。");
      }
      await assertNoBlockingSchedules(this.docId);
      return;
    }

    if (previousStatus === Site.STATUS_TERMINATED && nextStatus === Site.STATUS_ACTIVE) {
      if (!isValidTransitionMetadata(this, "REACTIVATION")) {
        throw new Error("再開理由と状態変更metadataを確認してください。");
      }
      if (!this.constructionPeriodStartAt || !this.constructionPeriodEndAt) {
        throw new Error("再開には新しい工期が必要です。");
      }
      if (this.constructionPeriodStartAt.getTime() > this.constructionPeriodEndAt.getTime()) {
        throw new Error("再開時の工期開始日は終了日以前にしてください。");
      }
      if (this._beforeData.customerId !== this.customerId) {
        throw new Error("再開時に取引先は変更できません。");
      }
      if (changedFields(this).some((field) => !REACTIVATION_UPDATE_FIELDS.has(field))) {
        throw new Error("再有効化では状態変更に関係しない項目を変更できません。");
      }
      return;
    }

    throw new Error("現場の状態遷移が不正です。");
  }
}

export { LIFECYCLE_FIELDS, assertNoBlockingSchedules };
