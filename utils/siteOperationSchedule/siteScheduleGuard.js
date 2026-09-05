import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

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

function hasTerminatedSiteConfirmation(schedule, { companyId, siteId }) {
  const context = schedule?.[SITE_SCHEDULE_CONFIRMATION];
  return context?.companyId === companyId &&
    context?.siteId === siteId &&
    context?.status === SCHEDULABLE_SITE_STATUS.TERMINATED &&
    !!context?.operationId;
}

function siteRef(firestore, companyId, siteId) {
  return doc(collection(firestore, "Companies", companyId, "Sites"), siteId);
}

function revisionOf(data) {
  if (!Object.hasOwn(data || {}, "scheduleRevision")) return 0;
  if (!Number.isSafeInteger(data.scheduleRevision) || data.scheduleRevision < 0) {
    throw new SiteScheduleGuardError(
      "invalid-site-revision",
      "現場の予定競合情報を確認できません。",
    );
  }
  return data.scheduleRevision;
}

async function expectedSiteStatus({
  firestore,
  companyId,
  siteId,
  schedule = null,
  requireConfirmation = true,
  confirmTerminatedSite = null,
}) {
  const snapshot = await getDoc(siteRef(firestore, companyId, siteId));
  if (!snapshot.exists()) {
    throw new SiteScheduleGuardError("site-not-found", "選択した現場が見つかりません。");
  }
  const site = snapshot.data();
  if (site.isTemporary !== false) {
    throw new SiteScheduleGuardError("temporary-site", "取引先未設定の現場には予定を作成できません。");
  }
  if (!Object.values(SCHEDULABLE_SITE_STATUS).includes(site.status)) {
    throw new SiteScheduleGuardError("invalid-site-status", "現場の状態を確認できません。");
  }
  if (site.status === SCHEDULABLE_SITE_STATUS.TERMINATED && requireConfirmation &&
      !hasTerminatedSiteConfirmation(schedule, { companyId, siteId })) {
    const confirmed = typeof confirmTerminatedSite === "function"
      ? await confirmTerminatedSite({ companyId, siteId, site })
      : false;
    if (!confirmed) {
      throw new SiteScheduleGuardError("terminated-not-confirmed", "終了済み現場の使用が確認されませんでした。");
    }
  }
  return site.status;
}

async function readGuardedSite(transaction, reference, expectedStatus) {
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists()) {
    throw new SiteScheduleGuardError("site-not-found", "選択した現場が見つかりません。");
  }
  const data = snapshot.data();
  if (data.isTemporary !== false || data.status !== expectedStatus) {
    throw new SiteScheduleGuardError(
      "site-conflict",
      "現場の状態が変更されました。選択内容を確認してください。",
    );
  }
  return data;
}

function bump(transaction, reference, data, actorUid) {
  transaction.update(reference, {
    scheduleRevision: revisionOf(data) + 1,
    uid: actorUid,
    updatedAt: serverTimestamp(),
  });
}

function assertGuardedSiteLimit(siteIds) {
  if (siteIds.size > MAX_GUARDED_SITES_PER_TRANSACTION) {
    throw new SiteScheduleGuardError(
      "too-many-sites",
      "一度に変更できる現場数を超えています。操作を分けてください。",
    );
  }
}

function changedDate(schedule) {
  const before = schedule?._beforeData?.dateAt;
  const after = schedule?.dateAt;
  const beforeTime = before instanceof Date ? before.getTime() : before?.toDate?.().getTime?.();
  const afterTime = after instanceof Date ? after.getTime() : after?.toDate?.().getTime?.();
  return beforeTime !== afterTime;
}

export function createSiteOperationScheduleWriter({
  firestore,
  companyId,
  actorUid,
  confirmTerminatedSite = null,
}) {
  if (!firestore || !companyId || !actorUid) {
    throw new SiteScheduleGuardError("invalid-context", "予定の保存情報を確認できません。");
  }

  async function create(schedule) {
    const expected = await expectedSiteStatus({
      firestore, companyId, siteId: schedule.siteId, schedule, confirmTerminatedSite,
    });
    const reference = siteRef(firestore, companyId, schedule.siteId);
    schedule.operationResultId = null;
    await runTransaction(firestore, async (transaction) => {
      const site = await readGuardedSite(transaction, reference, expected);
      bump(transaction, reference, site, actorUid);
      await schedule.create({ transaction });
    });
    clearSiteScheduleConfirmation(schedule);
  }

  async function update(schedule) {
    if (schedule?._beforeData?.operationResultId && !schedule.operationResultId) {
      throw new SiteScheduleGuardError("result-rollback", "実績化済み予定を未処理へ戻せません。");
    }
    const oldSiteId = schedule?._beforeData?.siteId;
    const siteChanged = oldSiteId !== schedule.siteId;
    if (!siteChanged && !changedDate(schedule)) {
      await schedule.update();
      clearSiteScheduleConfirmation(schedule);
      return;
    }
    const newExpected = await expectedSiteStatus({
      firestore, companyId, siteId: schedule.siteId, schedule, confirmTerminatedSite,
    });
    const oldExpected = siteChanged
      ? await expectedSiteStatus({
        firestore, companyId, siteId: oldSiteId, requireConfirmation: false,
      })
      : newExpected;
    const oldReference = siteRef(firestore, companyId, oldSiteId);
    const newReference = siteRef(firestore, companyId, schedule.siteId);
    await runTransaction(firestore, async (transaction) => {
      const oldSite = await readGuardedSite(transaction, oldReference, oldExpected);
      const newSite = siteChanged
        ? await readGuardedSite(transaction, newReference, newExpected)
        : oldSite;
      bump(transaction, oldReference, oldSite, actorUid);
      if (siteChanged) bump(transaction, newReference, newSite, actorUid);
      await schedule.update({ transaction });
    });
    clearSiteScheduleConfirmation(schedule);
  }

  async function createMany(schedules) {
    if (!Array.isArray(schedules) || schedules.length === 0) return [];
    const expectedBySite = new Map();
    for (const schedule of schedules) {
      if (!expectedBySite.has(schedule.siteId)) {
        expectedBySite.set(schedule.siteId, await expectedSiteStatus({
          firestore, companyId, siteId: schedule.siteId, schedule, confirmTerminatedSite,
        }));
      }
    }
    assertGuardedSiteLimit(expectedBySite);
    await runTransaction(firestore, async (transaction) => {
      const guardedSites = await Promise.all([...expectedBySite].map(async ([siteId, expected]) => {
        const reference = siteRef(firestore, companyId, siteId);
        return { reference, site: await readGuardedSite(transaction, reference, expected) };
      }));
      for (const { reference, site } of guardedSites) bump(transaction, reference, site, actorUid);
      for (const schedule of schedules) {
        schedule.operationResultId = null;
        await schedule.create({ transaction });
      }
    });
    schedules.forEach(clearSiteScheduleConfirmation);
    return schedules;
  }

  async function updateMany(schedules) {
    if (!Array.isArray(schedules) || schedules.length === 0) return;
    if (schedules.some((schedule) =>
      schedule?._beforeData?.operationResultId && !schedule.operationResultId,
    )) {
      throw new SiteScheduleGuardError("result-rollback", "実績化済み予定を未処理へ戻せません。");
    }
    const guarded = schedules.filter((schedule) =>
      schedule?._beforeData?.siteId !== schedule.siteId || changedDate(schedule),
    );
    if (guarded.length === 0) {
      await runTransaction(firestore, async (transaction) => {
        for (const schedule of schedules) await schedule.update({ transaction });
      });
      schedules.forEach(clearSiteScheduleConfirmation);
      return;
    }
    const expectedBySite = new Map();
    for (const schedule of guarded) {
      const targetSiteId = schedule.siteId;
      if (!expectedBySite.has(targetSiteId)) {
        expectedBySite.set(targetSiteId, await expectedSiteStatus({
          firestore, companyId, siteId: targetSiteId, schedule, confirmTerminatedSite,
        }));
      }
      const oldSiteId = schedule._beforeData.siteId;
      if (oldSiteId !== targetSiteId && !expectedBySite.has(oldSiteId)) {
        expectedBySite.set(oldSiteId, await expectedSiteStatus({
          firestore, companyId, siteId: oldSiteId, requireConfirmation: false,
        }));
      }
    }
    assertGuardedSiteLimit(expectedBySite);
    await runTransaction(firestore, async (transaction) => {
      const guardedSites = await Promise.all([...expectedBySite].map(async ([siteId, expected]) => {
        const reference = siteRef(firestore, companyId, siteId);
        return { reference, site: await readGuardedSite(transaction, reference, expected) };
      }));
      for (const { reference, site } of guardedSites) bump(transaction, reference, site, actorUid);
      for (const schedule of schedules) await schedule.update({ transaction });
    });
    schedules.forEach(clearSiteScheduleConfirmation);
  }

  return { create, createMany, update, updateMany };
}
