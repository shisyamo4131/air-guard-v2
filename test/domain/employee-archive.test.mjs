import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Employee } from "@shisyamo4131/air-guard-v2-schemas";
import LocalEmployee from "../../schemas/Employee.js";
import { Timestamp } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { parseDate, plain } from "../../functions/shared/employeeContract.js";
import { parseEmployeeArchiveInput, validateEmployeeArchiveRaw } from "../../functions/shared/employeeArchiveContract.js";
import { archiveEmployee, EMPLOYEE_ARCHIVE_DOCUMENTS, EMPLOYEE_ARCHIVE_QUERIES } from "../../functions/modules/employees/archiveEmployee.js";
import { createEmployeeOnlyRetirementOperationRecord, createEmployeeReinstatementOperationRecord, createNextEmployeeLifecycleHead, LIFECYCLE_OPERATION_TYPES } from "../../functions/modules/auth/lifecycle/lifecycleOperationSchema.js";

const root = "Companies/company", live = `${root}/Employees/employee`, archive = `${root}/Employees_archive/employee`;
const identity = { uid: "actor", companyId: "company", isSuperUser: false };
const actor = { docId: "actor", companyId: "company", isAdmin: false, disabled: false, isTemporary: false, roles: ["manager"] };
const timestamp = new Timestamp(1788200000, 123456789);

function employee() {
  const model = new Employee({ docId: "employee", lastName: "合成", firstName: "太郎", lastNameKana: "ゴウセイ", firstNameKana: "タロウ", displayName: "合成太郎", displayNameKana: "ゴウセイタロウ", gender: "MALE", dateOfBirth: parseDate("1990-01-01"), dateOfHire: parseDate("2026-01-01"), zipcode: "1000001", prefCode: "13", city: "合成市", address: "合成一丁目" });
  const convert = (value) => value instanceof Date ? Timestamp.fromDate(value) : Array.isArray(value) ? value.map(convert) : plain(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, convert(entry)])) : value;
  return { ...convert(model.toObject()), uid: "registered-by", createdAt: new Timestamp(1788200000, 123456789), updatedAt: new Timestamp(1788200001, 987654321) };
}

function snapshot(value) { return { exists: value !== undefined, data: () => value }; }

function setup(options = {}) {
  const records = new Map([
    [live, options.raw || employee()],
    [`${root}/Users/actor`, Object.hasOwn(options, "actor") ? options.actor : actor],
    ["System/system", { isMaintenance: options.maintenance === true }],
  ]);
  if (options.archived) records.set(archive, { legacy: true });
  if (options.reservation) records.set(`${root}/EmployeeUserReservations/employee`, { active: true });
  if (options.lock) records.set(`${root}/EmployeeLifecycleLocks/employee`, { active: true });
  if (options.head !== undefined) records.set(`${root}/EmployeeLifecycleHeads/employee`, options.head);
  for (const [id, operation] of options.operations || []) records.set(`${root}/LifecycleOperations/${id}`, operation);
  const reads = [], writes = [];
  const firestore = {
    doc: (path) => ({ path }),
    collection: (path) => ({ where: (field, operator, value) => ({ path, filter: [field, operator, value], limit: () => ({ path, filter: [field, operator, value] }) }) }),
    runTransaction: async (callback) => callback({
      get: async (reference) => {
        reads.push(reference);
        if (options.failRead?.(reference)) throw new Error("read failure");
        if (reference.filter) {
          const docs = [...records.entries()].filter(([path, value]) => path.startsWith(`${reference.path}/`) && value?.[reference.filter[0]] === reference.filter[2]).map(([, value]) => ({ data: () => value }));
          return { size: docs.length, empty: docs.length === 0, docs };
        }
        return snapshot(records.get(reference.path));
      },
      set: (...args) => writes.push(["set", args]),
      delete: (...args) => writes.push(["delete", args]),
    }),
  };
  const run = () => archiveEmployee({ firestore, input: { employeeId: "employee" }, resolveIdentity: options.resolveIdentity || (async () => ({ ...identity, ...options.identity })) });
  return { records, reads, writes, run };
}

function retirement(operationId = "11111111-1111-4111-8111-111111111111") {
  return createEmployeeOnlyRetirementOperationRecord({ operationId, actorUid: "actor", actorDisplayName: "管理者", employeeId: "employee", terminationDate: "2026-08-24", reasonOfTermination: "本人都合", requestFingerprint: "a".repeat(64), timestamp });
}
function reinstatement(operationId = "22222222-2222-4222-8222-222222222222") {
  return createEmployeeReinstatementOperationRecord({ operationId, actorUid: "actor", actorDisplayName: "管理者", employeeId: "employee", reversesOperationId: "11111111-1111-4111-8111-111111111111", correctionReasonCode: "MISTAKEN_RETIREMENT", requestFingerprint: "b".repeat(64), timestamp });
}

test("archive preflight accepts exact employeeId and declares current dependencies", async () => {
  assert.deepEqual(EMPLOYEE_ARCHIVE_QUERIES, [["Users", "employeeId", "=="]]);
  assert.deepEqual(EMPLOYEE_ARCHIVE_DOCUMENTS, ["EmployeeUserReservations", "EmployeeLifecycleLocks", "EmployeeLifecycleHeads"]);
  assert.deepEqual(parseEmployeeArchiveInput({ employeeId: "employee" }), { employeeId: "employee" });
  for (const input of [undefined, {}, { employeeId: "employee", reason: "x" }, { employeeId: "../employee" }]) assert.throws(() => parseEmployeeArchiveInput(input));
  const state = setup();
  assert.deepEqual(await state.run(), { success: true, allowed: true, employeeId: "employee" });
  assert.equal(state.writes.length, 0);
});

test("Employee schema owns the three archive hasMany references and preflight does not duplicate them", async () => {
  assert.equal(LocalEmployee.logicalDelete, true);
  assert.deepEqual(LocalEmployee.hasMany, [
    { collectionPath: "SiteOperationSchedules", field: "employeeIds", condition: "array-contains", type: "collection" },
    { collectionPath: "OperationResults", field: "employeeIds", condition: "array-contains", type: "collection" },
    { collectionPath: "ArrangementNotifications", field: "employeeId", condition: "==", type: "collection" },
  ]);
  const source = await readFile(new URL("../../functions/modules/employees/archiveEmployee.js", import.meta.url), "utf8");
  for (const dependency of ["SiteOperationSchedules", "OperationResults", "ArrangementNotifications"]) assert.doesNotMatch(source, new RegExp(dependency, "u"));
});

test("archive preflight refuses auth, tenant, maintenance, state, User, reservation, lock, collision, and read failures", async () => {
  const cases = [
    [setup({ actor: null }), "permission-denied"],
    [setup({ maintenance: true }), "failed-precondition"],
    [setup({ raw: { ...employee(), employmentStatus: "RESIGNED" } }), "failed-precondition"],
    [setup({ actor: { ...actor, employeeId: "employee" } }), "failed-precondition"],
    [setup({ reservation: true }), "failed-precondition"],
    [setup({ lock: true }), "failed-precondition"],
    [setup({ archived: true }), "already-exists"],
    [setup({ failRead: () => true }), null],
    [setup({ resolveIdentity: async () => ({ ...identity, companyId: "other-company" }) }), "permission-denied"],
  ];
  for (const [state, code] of cases) {
    if (code) await assert.rejects(state.run(), { code });
    else await assert.rejects(state.run());
    assert.equal(state.writes.length, 0);
  }
});

test("archive accepts every current same-tenant registered role shape and rejects invalid User identity", async () => {
  for (const roles of [[], ["unknown"], ["manager"], ["human-resource"]]) {
    const state = setup({ actor: { ...actor, roles } });
    assert.deepEqual(await state.run(), { success: true, allowed: true, employeeId: "employee" });
    assert.equal(state.writes.length, 0);
  }
  const admin = setup({ actor: { ...actor, isAdmin: true, roles: [] } });
  assert.deepEqual(await admin.run(), { success: true, allowed: true, employeeId: "employee" });
  const superUser = setup({ actor: { ...actor, roles: [] }, identity: { isSuperUser: true } });
  assert.deepEqual(await superUser.run(), { success: true, allowed: true, employeeId: "employee" });
  for (const change of [{ docId: "other" }, { companyId: "other-company" }, { disabled: true }, { isTemporary: true }]) {
    const state = setup({ actor: { ...actor, ...change } });
    await assert.rejects(state.run(), { code: "permission-denied" });
    assert.equal(state.writes.length, 0);
  }
  for (const invalid of [{ uid: "" }, { companyId: "" }]) {
    const state = setup({ resolveIdentity: async () => ({ ...identity, ...invalid }) });
    await assert.rejects(state.run(), { code: "permission-denied" });
    assert.equal(state.writes.length, 0);
  }
});

test("archive validates lifecycle operations and head consistency without rejecting a completed reinstatement", async () => {
  const completedRetirement = retirement();
  const retirementState = setup({ operations: [[completedRetirement.operationId, completedRetirement]], head: createNextEmployeeLifecycleHead({ operationId: completedRetirement.operationId, operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT, timestamp }) });
  await assert.rejects(retirementState.run(), { code: "failed-precondition" });
  assert.equal(retirementState.writes.length, 0);

  const completedReinstatement = reinstatement();
  const reinstatementState = setup({ operations: [[retirement().operationId, retirement()], [completedReinstatement.operationId, completedReinstatement]], head: createNextEmployeeLifecycleHead({ operationId: completedReinstatement.operationId, operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT, timestamp }) });
  assert.deepEqual(await reinstatementState.run(), { success: true, allowed: true, employeeId: "employee" });
  assert.equal(reinstatementState.writes.length, 0);

  for (const options of [
    { operations: [[completedRetirement.operationId, completedRetirement]] },
    { operations: [[completedRetirement.operationId, { malformed: true }]], head: {} },
    { operations: [[completedRetirement.operationId, completedRetirement]], head: createNextEmployeeLifecycleHead({ operationId: "33333333-3333-4333-8333-333333333333", operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT, timestamp }) },
  ]) {
    const state = setup(options);
    await assert.rejects(state.run(), { code: "failed-precondition" });
    assert.equal(state.writes.length, 0);
  }
});

test("archive validates raw Employee before any archive side effect", async () => {
  const raw = employee();
  validateEmployeeArchiveRaw(raw, "employee");
  for (const patch of [{ docId: "other" }, { createdAt: new Date() }, { employmentStatus: "UNKNOWN" }, { dateOfHire: undefined }]) {
    const state = setup({ raw: { ...raw, ...patch } });
    await assert.rejects(state.run());
    assert.equal(state.writes.length, 0);
  }
});

test("archive Callable is preflight-only and does not write or delete archive data", async () => {
  const source = await readFile(new URL("../../functions/modules/employees/archiveEmployee.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /transaction\.(set|delete)|archiveRef\.set|activeRef\.delete/u);
  assert.match(source, /return \{ success: true, allowed: true, employeeId: parsed\.employeeId \}/u);
  assert.doesNotMatch(source, /Employees_archive.*set|Employees\/.*delete/u);
});
