import assert from "node:assert/strict";
import test from "node:test";
import { getSiteLifecyclePresentation } from "../../composables/domain/site/siteLifecyclePresentation.js";

const timestamp = (iso) => ({ toDate: () => new Date(iso) });

test("Site lifecycle presentation derives TERMINATED, missing-period, live, and elapsed states", () => {
  assert.deepEqual(
    getSiteLifecyclePresentation({ status: "TERMINATED" }),
    {
      persistentStatus: "TERMINATED", label: "終了済み", color: "grey",
      automaticTerminationDate: null, hasScheduleBlocker: false,
    },
  );
  assert.equal(
    getSiteLifecyclePresentation({ status: "ACTIVE", constructionPeriodEndAt: null }).label,
    "工期未設定",
  );
  const live = getSiteLifecyclePresentation({
    status: "ACTIVE",
    constructionPeriodEndAt: timestamp("2028-03-30T15:00:00.000Z"),
  }, { now: new Date("2028-02-29T14:59:59.999Z") });
  assert.equal(live.label, "稼働中");
  assert.equal(live.automaticTerminationDate, "2028-06-29");

  const elapsed = getSiteLifecyclePresentation({
    status: "ACTIVE",
    constructionPeriodEndAt: timestamp("2028-01-01T15:00:00.000Z"),
  }, { now: new Date("2028-03-31T15:00:00.000Z") });
  assert.equal(elapsed.label, "工期終了済み");
  assert.equal(elapsed.automaticTerminationDate, "2028-04-01");
  assert.equal(elapsed.hasScheduleBlocker, null);

  const completeEmptyScheduleSet = getSiteLifecyclePresentation({
    status: "ACTIVE",
    constructionPeriodEndAt: timestamp("2028-01-01T15:00:00.000Z"),
  }, { schedules: [], now: new Date("2028-03-31T15:00:00.000Z") });
  assert.equal(completeEmptyScheduleSet.hasScheduleBlocker, false);
});

test("Site lifecycle presentation derives schedule blockers from unprocessed or JST-today/future schedules", () => {
  const site = {
    status: "ACTIVE",
    constructionPeriodEndAt: timestamp("2028-01-01T15:00:00.000Z"),
  };
  const now = new Date("2028-03-31T15:00:00.000Z");
  for (const schedule of [
    { date: "2028-03-01", operationResultId: null },
    { date: "2028-04-01", operationResultId: "result-a" },
    { dateAt: timestamp("2028-04-02T00:00:00.000Z"), operationResultId: "result-a" },
  ]) {
    const value = getSiteLifecyclePresentation(site, { schedules: [schedule], now });
    assert.equal(value.label, "工期終了済み・予定あり");
    assert.equal(value.hasScheduleBlocker, true);
  }
  const processedPast = getSiteLifecyclePresentation(site, {
    schedules: [{ date: "2028-03-31", operationResultId: "result-a" }], now,
  });
  assert.equal(processedPast.label, "工期終了済み");
  assert.equal(processedPast.hasScheduleBlocker, false);
});
