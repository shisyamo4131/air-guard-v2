import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Site, SiteOperationSchedule, OperationResult, ArrangementNotification, AgreementV2 } from "@shisyamo4131/air-guard-v2-schemas";
import FireModel from "@shisyamo4131/air-firebase-v2";
import ClientAdapter from "@shisyamo4131/air-firebase-v2-client-adapter";
import { Timestamp } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { saveOperation } from "../../functions/modules/operations/saveOperation.js";
import { expectedForOperation } from "../../functions/shared/operationWriteContract.js";
import { operationDateTime } from "../../functions/shared/operationDateTime.js";
import { parseDate, encodeExpected } from "../../functions/shared/employeeContract.js";

async function scenarios() {
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
      await state.save(command(raw, "workers", { id }, { array, rowAction: "add", position: 0 }));
      raw = state.records.get(path("schedule"));
    }
    const check = (value, date) => {
      assert.equal(value.date, date);
      assert.equal(value.dateAt.getTime(), parseDate(date).getTime());
      const start = new Date(`${date}T${times.startTime}:00+09:00`).getTime() + (isStartNextDay ? 86400000 : 0);
      assert.equal(value.startAt.getTime(), start);
      assert.equal(value.endAt.getTime(), start + (times.minutes + times.breakMinutes) * 60000);
      assert.equal(value.isSpansNextDay, times.span);
      assert.equal(value.totalWorkMinutes, times.minutes);
      assert.equal(value.attendanceDateAt.getTime(), parseDate(date).getTime() + (isStartNextDay ? 86400000 : 0));
    };
    check(raw, day); raw.workers.forEach((row) => check(row, day));
    // Reconstructed children must retain the adapter before parent callbacks.
    const model = operationDateTime(new SiteOperationSchedule(raw));
    model.employees = model.employees.map((row) => row.toObject());
    model.outsourcers = model.outsourcers.map((row) => row.toObject());
    model.dateAt = parseDate("2026-09-12");
    assert.equal(model.dayType, "SATURDAY");
    assert.ok(model.workers.every((row) => row.dayType === "SATURDAY"));
    check(model.toObject(), "2026-09-12");
    model.workers.forEach((row) => check(row.toObject(), "2026-09-12"));
    await state.save(command(raw, "duplicate", { dateAt: "2026-09-08" }, { documentId: "copy", sourceId: raw.docId, siteStatuses: { site: "ACTIVE" } }));
    let copy = state.records.get(path("schedule", "copy"));
    check(copy, "2026-09-08");
    copy.workers.forEach((row) => check(row, "2026-09-08"));
    await state.save(command(copy, "overview", { dateAt: "2026-09-12" }, { siteStatuses: { site: "ACTIVE" } }));
    copy = state.records.get(path("schedule", "copy"));
    assert.equal(copy.dayType, "SATURDAY");
    assert.ok(copy.workers.every((row) => row.dayType === "SATURDAY"));
    // A date-unchanged worker edit must not normalize raw date precision.
    const nano = new Timestamp(1788793200, 123456789);
    copy.unknown = { stamp: nano };
    copy.dateAt = new Timestamp(Math.floor(copy.dateAt.getTime() / 1000), 123456789);
    const originalDate = copy.dateAt;
    await state.save(command(copy, "workers", { isOjt: true }, { array: "employees", rowAction: "update", position: 0 }));
    copy = state.records.get(path("schedule", "copy"));
    assert.strictEqual(copy.dateAt, originalDate);
    assert.strictEqual(copy.unknown.stamp, nano);
    await state.save(command(copy, "notify", { shouldNotify: false })); copy = state.records.get(path("schedule", "copy"));
    for (const worker of copy.workers) {
      const noticePath = `Companies/company/ArrangementNotifications/copy_${worker.workerId}`;
      let notice = state.records.get(noticePath);
      assert.equal(notice.actualEndAt.getTime(), worker.endAt.getTime());
      const item = new ArrangementNotification(notice);
      item.actualStartTime = "09:00";
      item.actualEndTime = "18:00";
      item.actualIsStartNextDay = isStartNextDay;
      item.actualBreakMinutes = 0;
      item.isQualified = false;
      item.isOjt = false;
      const previousAdapter = (() => { try { return FireModel.getAdapter(); } catch { return null; } })();
      const previousConfig = FireModel.getConfig();
      const adapter = Object.create(ClientAdapter.prototype);
      adapter.update = async () => null;
      FireModel.setAdapter(adapter);
      FireModel.setConfig({ prefix: "Companies/company" });
      try {
        for (const transition of ["toArranged", "toConfirmed", "toArrived", "toLeaved"]) {
          if (transition === "toLeaved") {
            item.actualStartTime = "09:00";
            item.actualEndTime = "18:00";
            item.actualIsStartNextDay = isStartNextDay;
            item.actualBreakMinutes = 0;
            item.isQualified = false;
            item.isOjt = false;
          }
          await item[transition]();
          if (transition === "toArranged") {
            assert.equal(item.status, "ARRANGED");
            assert.equal(item.confirmedAt, null);
            assert.equal(item.arrivedAt, null);
            assert.equal(item.leavedAt, null);
            assert.equal(item.actualStartTime, item.startTime);
            assert.equal(item.actualEndTime, item.endTime);
            assert.equal(item.actualIsStartNextDay, item.isStartNextDay);
            assert.equal(item.actualBreakMinutes, 60);
          }
          if (transition === "toConfirmed") {
            assert.equal(item.status, "CONFIRMED");
            assert.ok(item.confirmedAt instanceof Date);
            assert.equal(item.arrivedAt, null);
            assert.equal(item.leavedAt, null);
          }
          if (transition === "toArrived") {
            assert.equal(item.status, "ARRIVED");
            assert.ok(item.confirmedAt instanceof Date);
            assert.ok(item.arrivedAt instanceof Date);
            assert.equal(item.leavedAt, null);
          }
          if (transition === "toLeaved") assert.equal(item.status, "LEAVED");
        }
      } finally {
        FireModel.setAdapter(previousAdapter);
        FireModel.setConfig(previousConfig);
      }
      notice = item.toObject();
      assert.equal(notice.status, "LEAVED");
      assert.ok(notice.confirmedAt instanceof Date);
      assert.ok(notice.arrivedAt instanceof Date);
      assert.ok(notice.leavedAt instanceof Date);
      assert.equal(notice.actualStartTime, "09:00");
      assert.equal(notice.actualEndTime, "18:00");
      assert.equal(notice.actualBreakMinutes, 0);
      assert.equal(notice.isQualified, false);
      assert.equal(notice.isOjt, false);
      const start = new Date("2026-09-12T09:00:00+09:00").getTime() + (isStartNextDay ? 86400000 : 0);
      assert.equal(notice.actualStartAt.getTime(), start);
      assert.equal(notice.actualEndAt.getTime(), start + 9 * 3600000);
      state.records.set(noticePath, notice);
    }
    results.push({ day, times, isStartNextDay, date: copy.date, workers: copy.workers.map((row) => ({ date: row.date, start: row.startAt.toISOString(), end: row.endAt.toISOString(), minutes: row.totalWorkMinutes, dayType: row.dayType })) });
  }
  return results;
}

if (!process.argv.includes("--operation-datetime-child")) test("standard schedule sync preserves notification attendance values and writes one linked result", async () => {
  const calls = [];
  const siteData = { docId: "sync-site", customerId: "sync-customer" };
  const adapter = {
    async fetch() {
      calls.push({ method: "Site.fetch", docId: this.docId });
      Object.assign(this, siteData);
      return true;
    },
    async create(args = {}) {
      calls.push({ method: "OperationResult.create", docId: args.docId, transaction: args.transaction });
      calls.push({ method: "OperationResult.create.data", data: this.toObject() });
      return { id: args.docId };
    },
    async update(args = {}) {
      calls.push({ method: "SiteOperationSchedule.update", transaction: args.transaction });
      return { id: this.docId };
    },
    async runTransaction(callback) {
      calls.push({ method: "runTransaction" });
      return await callback({
        set: (...args) => calls.push({ method: "transaction.set", args }),
        update: (...args) => calls.push({ method: "transaction.update", args }),
      });
    },
  };
  const previousAdapter = (() => { try { return FireModel.getAdapter(); } catch { return null; } })();
  const previousConfig = FireModel.getConfig();
  FireModel.setAdapter(adapter);
  FireModel.setConfig({ prefix: "Companies/sync-company" });
  try {
    const schedule = new SiteOperationSchedule({
      docId: "sync-schedule",
      siteId: siteData.docId,
      dateAt: parseDate("2026-09-12"),
      startTime: "22:00",
      endTime: "06:00",
      breakMinutes: 60,
      isStartNextDay: true,
      requiredPersonnel: 3,
    });
    schedule.addWorker({ id: "employee-a", isEmployee: true }, -1);
    schedule.addWorker({ id: "employee-b", isEmployee: true }, -1);
    schedule.addWorker({ id: "outsourcer-a", isEmployee: false }, -1);
    const [employeeWithNotice, employeeFallback, outsourcerFallback] = schedule.workers;
    const notifications = {
      [employeeWithNotice.notificationKey]: {
        actualStartTime: "23:00",
        actualEndTime: "07:00",
        actualBreakMinutes: 0,
        actualIsStartNextDay: true,
        isQualified: true,
        isOjt: true,
      },
      [employeeFallback.notificationKey]: {
        actualStartTime: null,
        actualEndTime: undefined,
        actualBreakMinutes: 0,
        actualIsStartNextDay: false,
        isQualified: false,
        isOjt: false,
      },
    };
    const notificationsBefore = structuredClone(notifications);

    await schedule.syncToOperationResult(notifications);

    const result = calls.find((call) => call.method === "OperationResult.create.data").data;
    assert.equal(result.docId, schedule.docId);
    assert.equal(result.siteOperationScheduleId, schedule.docId);
    assert.equal(schedule.operationResultId, schedule.docId);
    assert.equal(result.employees[0].startTime, "23:00");
    assert.equal(result.employees[0].endTime, "07:00");
    assert.equal(result.employees[0].breakMinutes, 0);
    assert.equal(result.employees[0].isStartNextDay, true);
    assert.equal(result.employees[0].isQualified, true);
    assert.equal(result.employees[0].isOjt, true);
    assert.equal(result.employees[1].startTime, schedule.startTime);
    assert.equal(result.employees[1].endTime, schedule.endTime);
    assert.equal(result.employees[1].breakMinutes, 0);
    assert.equal(result.employees[1].isStartNextDay, false);
    assert.equal(result.employees[1].isQualified, false);
    assert.equal(result.employees[1].isOjt, false);
    assert.equal(result.outsourcers[0].startTime, schedule.startTime);
    assert.equal(result.outsourcers[0].endTime, schedule.endTime);
    assert.equal(result.outsourcers[0].breakMinutes, schedule.breakMinutes);
    assert.equal(result.outsourcers[0].isStartNextDay, schedule.isStartNextDay);
    assert.equal(result.outsourcers[0].isQualified, outsourcerFallback.isQualified);
    assert.equal(result.outsourcers[0].isOjt, outsourcerFallback.isOjt);
    assert.equal(result.employees[0].startAt.toISOString(), "2026-09-13T14:00:00.000Z");
    assert.equal(result.employees[0].endAt.toISOString(), "2026-09-13T22:00:00.000Z");
    assert.equal(result.employees[0].totalWorkMinutes, 480);
    assert.deepEqual(notifications, notificationsBefore);
    assert.equal(calls.filter(({ method }) => method === "Site.fetch").length, 1);
    assert.equal(calls.filter(({ method }) => method === "runTransaction").length, 1);
    assert.equal(calls.filter(({ method }) => method === "OperationResult.create").length, 1);
    assert.equal(calls.filter(({ method }) => method === "SiteOperationSchedule.update").length, 1);
  } finally {
    FireModel.setAdapter(previousAdapter);
    FireModel.setConfig(previousConfig);
  }
});

if (process.argv.includes("--operation-datetime-child")) {
  console.log(JSON.stringify(await scenarios()));
} else {
  test("B operation and notification calculations satisfy fixed JST expectations in UTC and JST processes", () => {
    const outputs = ["UTC", "Asia/Tokyo"].map((TZ) => {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--operation-datetime-child"], { env: { ...process.env, TZ }, encoding: "utf8" });
      assert.equal(child.status, 0, `${TZ}\n${child.stderr}\n${child.stdout}`);
      return JSON.parse(child.stdout);
    });
    assert.equal(outputs[0].length, 24);
    assert.deepEqual(outputs[0], outputs[1]);
  });
}
