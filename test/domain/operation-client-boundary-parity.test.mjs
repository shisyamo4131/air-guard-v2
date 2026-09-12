import test from "node:test";
import assert from "node:assert/strict";
import { SiteOperationSchedule, OperationResult, ArrangementNotification } from "@shisyamo4131/air-guard-v2-schemas";
import * as clientValues from "../../composables/domain/shared/valueContract.js";
import * as serverValues from "../../functions/shared/employeeContract.js";
import * as clientCommands from "../../composables/domain/operation/operationCommandContract.js";
import * as serverCommands from "../../functions/shared/operationWriteContract.js";
import { applyOperationProjection } from "../../composables/domain/operation/operationProjection.js";
import * as clientReferences from "../../composables/domain/operation/operationReferences.js";
import * as serverReferences from "../../functions/shared/operationReferences.js";
import * as clientNotifications from "../../composables/domain/operation/notificationStateContract.js";
import * as serverNotifications from "../../functions/shared/notificationStateContract.js";
import { operationDateTime as clientDateTime } from "../../composables/domain/operation/operationDateTime.js";
import { operationDateTime as serverDateTime } from "../../functions/shared/operationDateTime.js";
import { operationUxAllowed } from "../../utils/auth/policies/operationActorPolicy.js";

const encoded = (value) => serverValues.encodeExpected(value);

function operation() {
  const model = new SiteOperationSchedule({
    docId: "operation",
    siteId: "site",
    securityType: "TRAFFIC",
    dateAt: new Date("2026-09-01T00:00:00+09:00"),
    startTime: "08:00",
    endTime: "17:00",
    requiredPersonnel: 2,
  });
  model.addWorker({ id: "employee-a", isEmployee: true }, -1);
  model.addWorker({ id: "employee-b", isEmployee: true }, -1);
  model.addWorker({ id: "outsourcer-a", isEmployee: false }, -1);
  model.addWorker({ id: "outsourcer-b", isEmployee: false }, -1);
  return { ...model.toObject(), unknown: { retained: true } };
}

function result() {
  return {
    ...new OperationResult({
      ...operation(),
      docId: "result",
      customerId: "customer",
      isLocked: false,
      articles: [
        { articleId: "article-a", price: 100, quantity: 1 },
        { articleId: "article-b", price: 200, quantity: 2 },
      ],
    }).toObject(),
    unknown: { retained: true },
  };
}

const sorted = (values) => [...values].sort();

function commandCases() {
  const schedule = operation();
  const billing = result();
  const workerExpected = ["operationResultId", "siteId", "dateAt", "employees", "outsourcers"];
  return [
    { name: "create", raw: null, command: { kind: "schedule", documentId: "created", action: "create", changes: { siteId: "site", securityType: "TRAFFIC", dateAt: "2026-09-03", startTime: "08:00", endTime: "17:00", requiredPersonnel: 1 } }, keys: [] },
    { name: "overview/basic", raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "overview", changes: { remarks: "updated" } }, keys: ["remarks", "operationResultId"] },
    { name: "overview/worker-parent-and-agreement", raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "overview", changes: { dateAt: "2026-09-02" } }, keys: [...clientCommands.WORKER_PARENT_FIELDS, "employees", "outsourcers", "customerId", "agreement", "billingDateAt", "operationResultId"] },
    ...["employees", "outsourcers"].flatMap((array) => [
      { name: `workers/${array}/add`, raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "workers", array, rowAction: "add", position: 1, changes: { id: array === "employees" ? "employee-c" : "outsourcer-c" } }, keys: workerExpected },
      { name: `workers/${array}/update`, raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "workers", array, rowAction: "update", position: 0, changes: { isOjt: true } }, keys: workerExpected },
      { name: `workers/${array}/remove`, raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "workers", array, rowAction: "remove", position: 0, changes: {} }, keys: workerExpected },
      { name: `workers/${array}/move`, raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "workers", array, rowAction: "move", position: 1, destination: 0, changes: {} }, keys: workerExpected },
    ]),
    ...["add", "update", "remove", "move"].map((rowAction) => ({
      name: `articles/${rowAction}`,
      raw: billing,
      command: {
        kind: "billing",
        documentId: billing.docId,
        action: "articles",
        array: "articles",
        rowAction,
        position: rowAction === "add" ? 1 : rowAction === "move" ? 1 : 0,
        ...(rowAction === "move" ? { destination: 0 } : {}),
        changes: ["remove", "move"].includes(rowAction) ? {} : { articleId: rowAction === "add" ? "article-c" : "article-a", price: 300, quantity: 3 },
      },
      keys: ["articles"],
    })),
    { name: "order", raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "order", changes: { displayOrder: 3 } }, keys: ["siteId", "dateAt", "shiftType", "displayOrder", "operationResultId"] },
    { name: "agreement", raw: billing, command: { kind: "billing", documentId: billing.docId, action: "agreement", changes: { agreementKey: null, billingDateAt: "2026-09-30" } }, keys: ["siteId", "dateAt", "shiftType", "agreement", "billingDateAt"] },
    { name: "adjusted", raw: billing, command: { kind: "billing", documentId: billing.docId, action: "adjusted", changes: { useAdjusted: true, adjustedQuantityBase: 2, adjustedUnitPriceBase: 12000 } }, keys: clientCommands.ADJUSTED_FIELDS },
    { name: "lock", raw: billing, command: { kind: "billing", documentId: billing.docId, action: "lock", changes: { desiredLocked: true } }, keys: ["isLocked"] },
    { name: "notify", raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "notify", changes: { shouldNotify: true } }, keys: workerExpected },
    { name: "convert", raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "convert", changes: {}, notifications: {} }, keys: workerExpected },
    { name: "duplicate", raw: schedule, command: { kind: "schedule", documentId: "copy", sourceId: schedule.docId, action: "duplicate", changes: { dateAt: "2026-09-02" } }, keys: [...clientCommands.WORKER_PARENT_FIELDS, "employees", "outsourcers", "customerId", "agreement", "billingDateAt", "operationResultId"] },
    { name: "delete", raw: schedule, command: { kind: "schedule", documentId: schedule.docId, action: "delete", changes: {} }, keys: ["siteId", "employees", "outsourcers", "articles", "operationResultId", "siteOperationScheduleId", "updatedAt"] },
  ];
}

test("client value encoding and operation command expectations stay wire-compatible with Functions", () => {
  const raw = operation();
  for (const name of ["OVERVIEW_FIELDS", "WORKER_FIELDS", "ADJUSTED_FIELDS", "NOTIFICATION_VALUES", "NOTIFICATION_IDENTITY", "WORKER_PARENT_FIELDS"]) {
    assert.deepEqual(clientCommands[name], serverCommands[name], name);
  }
  for (const { name, raw, command, keys } of commandCases()) {
    assert.deepEqual(sorted(clientCommands.operationExpectedKeys(command)), sorted(keys), `${name}: client keys`);
    assert.deepEqual(sorted(serverCommands.operationExpectedKeys(command)), sorted(keys), `${name}: Functions keys`);
    const clientExpected = clientCommands.expectedForOperation(raw, command);
    const serverExpected = serverCommands.expectedForOperation(raw, command);
    assert.deepEqual(clientExpected, serverExpected, `${name}: wire expectation`);
    assert.deepEqual(
      sorted(Object.keys(clientExpected)),
      sorted(command.action === "duplicate" ? Object.keys(raw) : keys),
      `${name}: wire expectation fields`,
    );
  }
  for (const value of [undefined, null, false, 12, "value", new Date("2026-09-01T00:00:00+09:00"), [1, { b: true }], { z: null, a: "first" }]) {
    assert.deepEqual(clientValues.encodeExpected(value), serverValues.encodeExpected(value));
  }
  assert.equal(clientValues.dateInput(raw.dateAt), serverValues.dateInput(raw.dateAt));
  assert.deepEqual(clientValues.parseDate("2026-09-02"), serverValues.parseDate("2026-09-02"));
});

test("client optimistic operation projection stays aligned with the authoritative server projection", () => {
  for (const { name, raw, command } of commandCases().filter(({ name }) => !["create", "duplicate"].includes(name))) {
    const projectionCommand = {
      ...command,
      changes: Object.fromEntries(Object.entries(command.changes).map(([key, value]) => [key, ["dateAt", "billingDateAt"].includes(key) ? clientValues.parseDate(value) : value])),
    };
    let client;
    let server;
    try {
      client = applyOperationProjection(clientValues.rawForClass(raw), projectionCommand);
      server = serverCommands.applyOperationCommand(serverValues.rawForClass(raw), projectionCommand);
    } catch (error) {
      error.message = `${name}: ${error.message}`;
      throw error;
    }
    assert.deepEqual(encoded(client), encoded(server), name);
    if (name === "delete") assert.equal(client, null);
    if (name === "lock") assert.equal(client.isLocked, true);
    if (["notify", "convert", "agreement"].includes(name)) assert.deepEqual(client.unknown, raw.unknown, `${name}: no-op retains unknown data`);
  }

  const create = commandCases().find(({ name }) => name === "create").command;
  const clientCreated = clientDateTime(new SiteOperationSchedule({ ...clientValues.rawForClass(create.changes), dateAt: clientValues.parseDate(create.changes.dateAt), docId: create.documentId })).toObject();
  const serverCreated = serverDateTime(new SiteOperationSchedule({ ...serverValues.rawForClass(create.changes), dateAt: serverValues.parseDate(create.changes.dateAt), docId: create.documentId })).toObject();
  assert.deepEqual(encoded(clientCreated), encoded(serverCreated), "create");

  // Duplicate creation is implemented by the Callable around the shared
  // projection. Calling either projection directly with the destination ID
  // must reject the source workers rather than silently rewrite references.
  const duplicateCase = commandCases().find(({ name }) => name === "duplicate");
  const duplicateCommand = {
    ...duplicateCase.command,
    changes: { dateAt: clientValues.parseDate(duplicateCase.command.changes.dateAt) },
  };
  for (const project of [applyOperationProjection, serverCommands.applyOperationCommand]) {
    assert.throws(
      () => project(clientValues.rawForClass(duplicateCase.raw), duplicateCommand),
      { code: "failed-precondition" },
      "duplicate is not a direct projection branch",
    );
  }

  const raw = operation();
  assert.deepEqual([...clientReferences.operationEmployeeReferences(raw, { scheduleId: raw.docId })], [...serverReferences.operationEmployeeReferences(raw, { scheduleId: raw.docId })]);
});

test("client date and notification projections retain Functions parity", () => {
  const raw = operation();
  const left = clientDateTime(new SiteOperationSchedule(clientValues.rawForClass(raw)));
  const right = serverDateTime(new SiteOperationSchedule(serverValues.rawForClass(raw)));
  left.dateAt = new Date("2026-09-12T00:00:00+09:00");
  right.dateAt = new Date("2026-09-12T00:00:00+09:00");
  assert.deepEqual(encoded(left.toObject()), encoded(right.toObject()));

  const worker = raw.employees[0];
  const notification = serverDateTime(new ArrangementNotification({
    ...serverValues.rawForClass(worker),
    docId: `${raw.docId}_${worker.workerId}`,
    siteOperationScheduleId: raw.docId,
    actualStartTime: worker.startTime,
    actualEndTime: worker.endTime,
    actualBreakMinutes: worker.breakMinutes,
    actualIsStartNextDay: worker.isStartNextDay,
  })).toObject();
  assert.deepEqual([...clientReferences.notificationEmployeeReferences(notification)], [...serverReferences.notificationEmployeeReferences(notification)]);
  assert.deepEqual(clientNotifications.expectedNotificationState(notification), serverNotifications.expectedNotificationState(notification));
  assert.deepEqual(clientCommands.notificationExpectation(notification), serverCommands.notificationExpectation(notification));
  const input = {
    expected: serverNotifications.expectedNotificationState(notification),
    changes: { targetStatus: "ARRIVED", isQualified: false, isOjt: true },
  };
  const now = new Date("2026-09-12T00:00:00+09:00");
  assert.deepEqual(encoded(clientNotifications.prepareNotificationState(notification, input, now)), encoded(serverNotifications.prepareNotificationState(notification, input, now)));
});

test("schedule CUD and result editing use tenant-wide server authorization while restricted operations retain the UX role matrix", () => {
  const identity = { uid: "actor", companyId: "company", isSuperUser: false };
  const base = { docId: "actor", companyId: "company", disabled: false, isTemporary: false, isAdmin: false, roles: [] };
  const scheduleCud = ["create", "duplicate", "overview", "workers", "order", "delete"]
    .map((action) => ({ kind: "schedule", action }));
  const restrictedSchedule = [{ kind: "schedule", action: "notify" }, { kind: "schedule", action: "convert" }];
  const resultEdits = ["overview", "workers"].map((action) => ({ kind: "result", action }));
  const restrictedResult = ["create", "duplicate", "delete", "articles"].map((action) => ({ kind: "result", action }));
  const billing = ["overview", "articles", "agreement", "adjusted"].map((action) => ({ kind: "billing", action }));
  for (const roles of [[], ["controller"], ["accountant"], ["human-resource"], ["unknown"]]) {
    const user = { ...base, roles };
    for (const command of scheduleCud) assert.equal(serverCommands.operationAllowed(identity, user, command), true, `${roles}: ${command.action}`);
    for (const command of resultEdits) assert.equal(serverCommands.operationAllowed(identity, user, command), true, `${roles}: result/${command.action}`);
    for (const command of restrictedSchedule) assert.equal(serverCommands.operationAllowed(identity, user, command), operationUxAllowed(identity, user), `${roles}: ${command.action}`);
    for (const command of restrictedResult) assert.equal(serverCommands.operationAllowed(identity, user, command), operationUxAllowed(identity, user), `${roles}: result/${command.action}`);
    for (const command of billing) assert.equal(serverCommands.operationAllowed(identity, user, command), operationUxAllowed(identity, user, { billing: true }), `${roles}: billing/${command.action}`);
  }
  const superIdentity = { ...identity, isSuperUser: true };
  for (const command of [...scheduleCud, ...resultEdits]) assert.equal(serverCommands.operationAllowed(superIdentity, base, command), true, `super: ${command.kind}/${command.action}`);
  for (const command of [...restrictedSchedule, ...restrictedResult, ...billing]) assert.equal(serverCommands.operationAllowed(superIdentity, base, command), false, `super: ${command.kind}/${command.action}`);
  const admin = { ...base, isAdmin: true };
  assert.equal(operationUxAllowed(identity, admin), true);
  for (const command of [...scheduleCud, ...restrictedSchedule, ...resultEdits, ...restrictedResult, ...billing]) assert.equal(serverCommands.operationAllowed(identity, admin, command), true);
  for (const user of [{ ...base, disabled: true }, { ...base, isTemporary: true }, { ...base, companyId: "other" }]) {
    for (const command of [...scheduleCud, ...resultEdits]) assert.equal(serverCommands.operationAllowed(identity, user, command), false);
  }
});
