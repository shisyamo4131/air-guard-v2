import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Site, SiteOperationSchedule, OperationResult, ArrangementNotification, AgreementV2 } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { saveOperation } from "../../functions/modules/operations/saveOperation.js";
import { expectedForOperation, notificationExpectation } from "../../functions/shared/operationWriteContract.js";
import { prepareNotificationState, expectedNotificationState } from "../../functions/shared/notificationStateContract.js";
import { operationDateTime } from "../../functions/shared/operationDateTime.js";
import { parseDate, encodeExpected } from "../../functions/shared/employeeContract.js";

async function scenarios() {
  // Reuse the existing transaction fixture, not a second implementation of the
  // writer: every operation below executes the actual saveOperation module.
  const text = await readFile(new URL("./operation-write.test.mjs", import.meta.url), "utf8");
  const setup = text.slice(text.indexOf('const root = "Companies/company";'), text.indexOf('test("schedule worker row operations'));
  const { harness, command, path } = new Function("Site", "SiteOperationSchedule", "OperationResult", "saveOperation", "expectedForOperation", "Timestamp", "assert", `${setup};return {harness,command,path};`)(Site, SiteOperationSchedule, OperationResult, saveOperation, expectedForOperation, Timestamp, assert);
  const results = [];
  const cases = [
    { startTime: "08:00", endTime: "17:00", breakMinutes: 60, minutes: 480, span: false },
    { startTime: "08:59", endTime: "09:01", breakMinutes: 0, minutes: 2, span: false },
    { startTime: "22:00", endTime: "06:00", breakMinutes: 0, minutes: 480, span: true },
    { startTime: "08:00", endTime: "08:00", breakMinutes: 0, minutes: 1440, span: true },
  ];
  for (const day of ["2026-09-08", "2026-12-31", "2028-02-29"]) for (const times of cases) for (const isStartNextDay of [false, true]) {
    const state = harness(null, { actor: { isAdmin: true } });
    const rates = (extra = 0) => Object.fromEntries([["WEEKDAY", 10000], ["SATURDAY", 14000], ["SUNDAY", 16000], ["HOLIDAY", 18000]].map(([dayType, price]) => [dayType, { unitPriceBase: price + extra, unitPriceQualified: price + extra + 2000, overtimeUnitPriceBase: extra ? 1200 : 600, overtimeUnitPriceQualified: extra ? 1800 : 900 }]));
    const agreement = new AgreementV2({ dateAt: parseDate("2020-01-01"), shiftType: "DAY", cutoffDate: 20, startTime: "08:00", endTime: "17:00", billingUnitType: "PER_DAY", rates: rates() });
    const revisedAgreement = new AgreementV2({ ...agreement.toObject(), dateAt: parseDate("2026-11-21"), rates: rates(10000) });
    const site = state.records.get("Companies/company/Sites/site"); site.agreementsV2 = [agreement.toObject(), revisedAgreement.toObject()];
    const changes = { siteId: "site", dateAt: day, shiftType: "DAY", securityType: "TRAFFIC", startTime: times.startTime, endTime: times.endTime, breakMinutes: times.breakMinutes, isStartNextDay, requiredPersonnel: 2 };
    await state.save(command(null, "create", changes, { siteStatuses: { site: "ACTIVE" } }));
    let raw = state.records.get(path("schedule"));
    assert.equal(raw.date, day); assert.equal(raw.dateAt.toISOString(), parseDate(day).toISOString());
    for (const [array, id] of [["employees", "employee-a"], ["outsourcers", "outsourcer"]]) {
      await state.save(command(raw, "workers", { id }, { array, rowAction: "add", position: 0 })); raw = state.records.get(path("schedule"));
    }
    const check = (value, date) => {
      assert.equal(value.date, date); assert.equal(value.dateAt.getTime(), parseDate(date).getTime());
      const start = new Date(`${date}T${times.startTime}:00+09:00`).getTime() + (isStartNextDay ? 86400000 : 0);
      assert.equal(value.startAt.getTime(), start);
      assert.equal(value.endAt.getTime(), start + (times.minutes + times.breakMinutes) * 60000);
      assert.equal(value.isSpansNextDay, times.span); assert.equal(value.totalWorkMinutes, times.minutes);
      assert.equal(value.attendanceDateAt.getTime(), parseDate(date).getTime() + (isStartNextDay ? 86400000 : 0));
    };
    check(raw, day); raw.workers.forEach((row) => check(row, day));
    // Reconstructed children must retain the adapter before parent callbacks.
    const model = operationDateTime(new SiteOperationSchedule(raw));
    model.employees = model.employees.map((row) => row.toObject()); model.outsourcers = model.outsourcers.map((row) => row.toObject());
    model.dateAt = parseDate("2026-09-12");
    assert.equal(model.dayType, "SATURDAY"); assert.ok(model.workers.every((row) => row.dayType === "SATURDAY"));
    check(model.toObject(), "2026-09-12"); model.workers.forEach((row) => check(row.toObject(), "2026-09-12"));
    await state.save(command(raw, "duplicate", { dateAt: "2026-09-08" }, { documentId: "copy", sourceId: raw.docId, siteStatuses: { site: "ACTIVE" } }));
    let copy = state.records.get(path("schedule", "copy")); check(copy, "2026-09-08"); copy.workers.forEach((row) => check(row, "2026-09-08"));
    await state.save(command(copy, "overview", { dateAt: "2026-09-12" }, { siteStatuses: { site: "ACTIVE" } }));
    copy = state.records.get(path("schedule", "copy")); assert.equal(copy.dayType, "SATURDAY"); assert.ok(copy.workers.every((row) => row.dayType === "SATURDAY"));
    // A date-unchanged worker edit must not normalize raw date precision.
    const nano = new Timestamp(1788793200, 123456789); copy.unknown = { stamp: nano };
    copy.dateAt = new Timestamp(Math.floor(copy.dateAt.getTime() / 1000), 123456789);
    const originalDate = copy.dateAt;
    await state.save(command(copy, "workers", { isOjt: true }, { array: "employees", rowAction: "update", position: 0 }));
    copy = state.records.get(path("schedule", "copy")); assert.strictEqual(copy.dateAt, originalDate); assert.strictEqual(copy.unknown.stamp, nano);
    await state.save(command(copy, "notify", { shouldNotify: false })); copy = state.records.get(path("schedule", "copy"));
    const notices = {};
    for (const worker of copy.workers) {
      const id = `copy_${worker.workerId}`, noticePath = `Companies/company/ArrangementNotifications/${id}`;
      let notice = state.records.get(noticePath);
      assert.equal(notice.actualEndAt.getTime(), worker.endAt.getTime());
      for (const targetStatus of ["ARRANGED", "CONFIRMED", "ARRIVED", "LEAVED"]) {
        const patch = prepareNotificationState(notice, { expected: expectedNotificationState(notice), changes: { targetStatus, actualStartTime: "09:00", actualEndTime: "18:00", actualBreakMinutes: 0, actualIsStartNextDay: !isStartNextDay, isQualified: false, isOjt: false } }, parseDate("2026-09-12"));
        notice = { ...notice, ...patch };
      }
      // Preserve existing JST semantics: actual dates use scheduled next-day
      // and scheduled span flags, even when actual times/flag differ.
      const start = new Date("2026-09-12T09:00:00+09:00").getTime() + (isStartNextDay ? 86400000 : 0);
      assert.equal(notice.actualStartAt.getTime(), start);
      assert.equal(notice.actualEndAt.getTime(), start + 9 * 3600000 + (times.span ? 86400000 : 0));
      state.records.set(noticePath, notice); notices[id] = notificationExpectation(notice);
    }
    await state.save(command(copy, "convert", {}, { notifications: notices }));
    let result = state.records.get(path("result", "copy")); assert.equal(result.date, "2026-09-12"); assert.equal(result.workers[0].totalWorkMinutes, 540);
    assert.equal(result.agreement.key, "2020-01-01_DAY"); assert.equal(result.salesAmount, 29200); // 2 workers × (Saturday 14000 + 1h overtime 600).
    assert.equal(result.billingDateAt.toISOString(), "2026-09-19T15:00:00.000Z");
    await state.save(command(result, "agreement", { billingDateAt: "2026-10-20" }, { kind: "billing" }));
    result = state.records.get(path("result", "copy")); assert.equal(result.billingDate, "2026-10-20");
    await state.save(command(result, "articles", { articleId: "article", price: 300, quantity: 2 }, { kind: "billing", array: "articles", rowAction: "add", position: 0 }));
    result = state.records.get(path("result", "copy")); assert.equal(result.salesArticles, 600);
    const before = encodeExpected(result); const noOp = await state.save(command(result, "overview", { remarks: result.remarks }, { kind: "result" }));
    assert.equal(noOp.updated, false); assert.deepEqual(encodeExpected(state.records.get(path("result", "copy"))), before);
    await state.save(command(result, "duplicate", { dateAt: "2026-12-31" }, { kind: "result", documentId: "result-copy", sourceId: "copy" }));
    const duplicated = state.records.get(path("result", "result-copy")); assert.equal(duplicated.date, "2026-12-31"); assert.equal(duplicated.billingDate, "2027-01-20");
    // A real result date edit crosses both the cutoff and the effective date of
    // a revised agreement; fixed amounts detect wrong weekday/old agreement use.
    if (day === "2026-09-08" && times.startTime === "08:00" && times.endTime === "17:00" && !isStartNextDay) {
      await state.save(command(duplicated, "overview", { dateAt: "2026-11-20" }, { kind: "result" }));
      const cutoffDay = state.records.get(path("result", "result-copy"));
      assert.equal(cutoffDay.dayType, "WEEKDAY"); assert.equal(cutoffDay.agreement.key, "2020-01-01_DAY");
      assert.equal(cutoffDay.billingDate, "2026-11-20"); assert.equal(cutoffDay.salesAmount, 21800); // 2 × (10000 + 600) + articles 600.
      await state.save(command(cutoffDay, "overview", { dateAt: "2026-11-21" }, { kind: "result" }));
      const followingDay = state.records.get(path("result", "result-copy"));
      assert.equal(followingDay.dayType, "SATURDAY"); assert.equal(followingDay.agreement.key, "2026-11-21_DAY");
      assert.equal(followingDay.billingDate, "2026-12-20"); assert.equal(followingDay.salesAmount, 51000); // 2 × (24000 + 1200) + articles 600.
    }
    results.push({ day, times, isStartNextDay, date: duplicated.date, billing: duplicated.billingDate, sales: duplicated.sales, workers: duplicated.workers.map((row) => ({ date: row.date, start: row.startAt.toISOString(), end: row.endAt.toISOString(), minutes: row.totalWorkMinutes, dayType: row.dayType })) });
  }
  return results;
}

if (process.argv.includes("--operation-datetime-child")) {
  console.log(JSON.stringify(await scenarios()));
} else {
  test("B operation and notification calculations satisfy fixed JST expectations in UTC and JST processes", () => {
    const outputs = ["UTC", "Asia/Tokyo"].map((TZ) => {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--operation-datetime-child"], { env: { ...process.env, TZ }, encoding: "utf8" });
      assert.equal(child.status, 0, `${TZ}\n${child.stderr}\n${child.stdout}`);
      return JSON.parse(child.stdout);
    });
    assert.equal(outputs[0].length, 24); assert.deepEqual(outputs[0], outputs[1]);
  });
}
