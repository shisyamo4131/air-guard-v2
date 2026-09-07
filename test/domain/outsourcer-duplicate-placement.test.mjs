import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ArrangementNotification,
  OperationResult,
  SiteOperationSchedule,
} from "../../schemas/index.js";

const OUTSOURCER_ID = "outsourcer-shared";
const SCHEDULE_ID = "schedule-a";

function schedule(overrides = {}) {
  return new SiteOperationSchedule({
    docId: SCHEDULE_ID,
    siteId: "site-a",
    dateAt: new Date("2026-09-04T00:00:00.000Z"),
    shiftType: "DAY",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: 60,
    ...overrides,
  });
}

function addOutsourcer(target, overrides = {}, position = -1) {
  target.addWorker(
    {
      id: OUTSOURCER_ID,
      isEmployee: false,
      ...overrides,
    },
    position,
  );
  return target.outsourcers.at(position === -1 ? -1 : position);
}

test("the same Outsourcer is stored as separate amount-one rows with stable identities", () => {
  const target = schedule();
  addOutsourcer(target);
  addOutsourcer(target);
  addOutsourcer(target);

  assert.equal(target.outsourcers.length, 3);
  assert.deepEqual(
    target.outsourcers.map(({ id }) => id),
    [OUTSOURCER_ID, OUTSOURCER_ID, OUTSOURCER_ID],
  );
  assert.deepEqual(
    target.outsourcers.map(({ amount }) => amount),
    [1, 1, 1],
  );
  assert.deepEqual(
    target.outsourcers.map(({ index }) => index),
    [1, 2, 3],
  );
  assert.deepEqual(
    target.outsourcers.map(({ workerId }) => workerId),
    [
      `${OUTSOURCER_ID}:1`,
      `${OUTSOURCER_ID}:2`,
      `${OUTSOURCER_ID}:3`,
    ],
  );
  assert.deepEqual(target.outsourcerIds, [
    OUTSOURCER_ID,
    OUTSOURCER_ID,
    OUTSOURCER_ID,
  ]);
  assert.equal(target.outsourcersCount, 3);
  assert.equal(target.assignedPersonnelCount, 3);
});

test("removing a middle duplicate and re-adding uses the next maximum index without renumbering survivors", () => {
  const target = schedule();
  addOutsourcer(target);
  addOutsourcer(target);
  addOutsourcer(target);
  const survivorIds = [
    `${OUTSOURCER_ID}:1`,
    `${OUTSOURCER_ID}:3`,
  ];

  target.removeWorker({
    workerId: `${OUTSOURCER_ID}:2`,
    isEmployee: false,
  });
  assert.deepEqual(
    target.outsourcers.map(({ workerId }) => workerId),
    survivorIds,
  );

  addOutsourcer(target);
  assert.deepEqual(
    target.outsourcers.map(({ workerId }) => workerId),
    [...survivorIds, `${OUTSOURCER_ID}:4`],
  );
  assert.deepEqual(
    target.outsourcers.map(({ index }) => index),
    [1, 3, 4],
  );
});

test("reordering changes only row order and preserves multiplicity and worker IDs", () => {
  const target = schedule();
  addOutsourcer(target);
  addOutsourcer(target);
  addOutsourcer(target);
  const originalIds = target.outsourcers.map(({ workerId }) => workerId);

  target.moveWorker({ oldIndex: 0, newIndex: 2, isEmployee: false });

  assert.deepEqual(
    target.outsourcers.map(({ workerId }) => workerId),
    [originalIds[1], originalIds[2], originalIds[0]],
  );
  assert.equal(new Set(target.outsourcers.map(({ workerId }) => workerId)).size, 3);
  assert.deepEqual(target.outsourcerIds, [
    OUTSOURCER_ID,
    OUTSOURCER_ID,
    OUTSOURCER_ID,
  ]);
});

test("an employee and Outsourcer with the same raw ID remain in distinct worker namespaces", () => {
  const target = schedule();
  target.addWorker({ id: OUTSOURCER_ID, isEmployee: true }, -1);
  addOutsourcer(target);

  assert.equal(target.employees[0].workerId, OUTSOURCER_ID);
  assert.equal(target.outsourcers[0].workerId, `${OUTSOURCER_ID}:1`);
  assert.notEqual(
    target.employees[0].workerId,
    target.outsourcers[0].workerId,
  );
  assert.equal(target.employees[0].employeeId, OUTSOURCER_ID);
  assert.equal(target.outsourcers[0].outsourcerId, OUTSOURCER_ID);
});

test("serialization, reconstruction, cloning, and OperationResult construction preserve duplicate rows", () => {
  const target = schedule();
  addOutsourcer(target, { startTime: "08:30" });
  addOutsourcer(target, { startTime: "09:00" });

  const reconstructed = new SiteOperationSchedule(target.toObject());
  const cloned = target.clone();
  const result = new OperationResult({
    ...target.toObject(),
    siteOperationScheduleId: target.docId,
  });
  const expected = target.outsourcers.map(({ workerId }) => workerId);

  for (const copy of [reconstructed, cloned, result]) {
    assert.equal(copy.outsourcers.length, 2);
    assert.deepEqual(
      copy.outsourcers.map(({ workerId }) => workerId),
      expected,
    );
    assert.deepEqual(copy.outsourcerIds, [OUTSOURCER_ID, OUTSOURCER_ID]);
    assert.deepEqual(
      copy.outsourcers.map(({ amount }) => amount),
      [1, 1],
    );
  }
});

test("ArrangementNotification instances inherit distinct placement worker IDs", () => {
  const target = schedule();
  addOutsourcer(target);
  addOutsourcer(target);
  const notifications = target.outsourcers.map(
    (worker) => new ArrangementNotification(worker.toObject()),
  );

  assert.deepEqual(
    notifications.map(({ workerId }) => workerId),
    [`${OUTSOURCER_ID}:1`, `${OUTSOURCER_ID}:2`],
  );
  assert.deepEqual(
    notifications.map(
      (notification) =>
        `${notification.siteOperationScheduleId}_${notification.workerId}`,
    ),
    [
      `${SCHEDULE_ID}_${OUTSOURCER_ID}:1`,
      `${SCHEDULE_ID}_${OUTSOURCER_ID}:2`,
    ],
  );
});

test("placement identity does not depend on ACTIVE or TERMINATED master status", () => {
  const active = schedule({ docId: "schedule-active" });
  const terminated = schedule({ docId: "schedule-terminated" });
  addOutsourcer(active, { contractStatus: "ACTIVE" });
  addOutsourcer(terminated, { contractStatus: "TERMINATED" });

  assert.equal(active.outsourcers[0].workerId, `${OUTSOURCER_ID}:1`);
  assert.equal(terminated.outsourcers[0].workerId, `${OUTSOURCER_ID}:1`);
  assert.equal(active.outsourcers[0].amount, 1);
  assert.equal(terminated.outsourcers[0].amount, 1);
  assert.equal("contractStatus" in active.outsourcers[0], false);
  assert.equal("contractStatus" in terminated.outsourcers[0], false);
});

test("schedule-to-result and table source contracts preserve per-placement identity", async () => {
  const scheduleSource = await readFile(
    new URL(
      "../../node_modules/@shisyamo4131/air-guard-v2-schemas/src/SiteOperationSchedule.js",
      import.meta.url,
    ),
    "utf8",
  );
  const notificationSource = await readFile(
    new URL(
      "../../node_modules/@shisyamo4131/air-guard-v2-schemas/src/ArrangementNotification.js",
      import.meta.url,
    ),
    "utf8",
  );
  const table = await readFile(
    new URL("../../components/Workers/Table/index.vue", import.meta.url),
    "utf8",
  );
  const row = await readFile(
    new URL("../../components/Workers/Table/Tr.vue", import.meta.url),
    "utf8",
  );
  const syncMethod = scheduleSource.slice(
    scheduleSource.indexOf("async syncToOperationResult"),
  );
  const converter = syncMethod.slice(
    syncMethod.indexOf("const converter"),
    syncMethod.indexOf("const employees"),
  );

  assert.match(converter, /return this\[prop\]\.map\(\(w\) =>/u);
  assert.doesNotMatch(converter, /new Set|\.reduce\(|groupBy|\.filter\(/u);
  assert.match(syncMethod, /const outsourcers = converter\("outsourcers"\)/u);
  assert.match(syncMethod, /outsourcers,\s*\/\/ 配置通知/u);
  assert.match(
    notificationSource,
    /const docId = `\$\{this\.siteOperationScheduleId\}_\$\{this\.workerId\}`/u,
  );
  assert.match(table, /:key="worker\.workerId"/u);
  assert.match(
    table,
    /notification\.workerId === worker\.workerId/u,
  );
  assert.match(row, /fetchOutsourcer\(newVal\.id\)/u);
  assert.match(row, /cachedData\.value\[props\.worker\.id\]/u);
  assert.doesNotMatch(table, /:key="worker\.id"/u);
});
