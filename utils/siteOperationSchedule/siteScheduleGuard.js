export const SCHEDULABLE_SITE_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  TERMINATED: "TERMINATED",
});

export const MAX_GUARDED_SITES_PER_TRANSACTION = 8;
export const SITE_SCHEDULE_CONFIRMATION = Symbol("site-schedule-confirmation");

export class SiteScheduleGuardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SiteScheduleGuardError";
    this.code = code;
  }
}

export function attachSiteScheduleConfirmation(schedule, {
  companyId,
  siteId,
  operationId,
} = {}) {
  if (!schedule || typeof companyId !== "string" || !companyId ||
      typeof siteId !== "string" || !siteId || !operationId) {
    throw new SiteScheduleGuardError("invalid-confirmation", "終了済み現場の確認情報が不正です。");
  }
  const context = Object.freeze({
    companyId,
    siteId,
    status: SCHEDULABLE_SITE_STATUS.TERMINATED,
    operationId,
  });
  Object.defineProperty(schedule, SITE_SCHEDULE_CONFIRMATION, {
    configurable: true,
    enumerable: false,
    value: context,
  });
  return context;
}

export function clearSiteScheduleConfirmation(schedule) {
  if (schedule && Object.hasOwn(schedule, SITE_SCHEDULE_CONFIRMATION)) {
    delete schedule[SITE_SCHEDULE_CONFIRMATION];
  }
}

// Kept as a fail-closed compatibility export. The dedicated server operation
// owns Site validation/revision and raw Employee-reference transactions.
export function createSiteOperationScheduleWriter() {
  const reject = async () => { throw new SiteScheduleGuardError("dedicated-operation-required", "予定の保存は専用処理から実行してください。"); };
  return { create: reject, createMany: reject, update: reject, updateMany: reject };
}
