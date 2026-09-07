import test from "node:test";
import assert from "node:assert/strict";
import { Employee, Certification } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp, GeoPoint } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { parseDate, plain } from "../../functions/shared/employeeContract.js";
import { parseEmployeeArchiveInput, validateEmployeeArchiveRaw } from "../../functions/shared/employeeArchiveContract.js";
import { archiveEmployee, EMPLOYEE_ARCHIVE_QUERIES, EMPLOYEE_ARCHIVE_DOCUMENTS, parseArchiveTenants } from "../../functions/modules/employees/archiveEmployee.js";
import { demoEmployeeArchiveTenants } from "../../functions/codex-test/employeeArchive.js";
import { saveEmployee } from "../../functions/modules/employees/saveEmployee.js";

const root = "Companies/company", live = `${root}/Employees/employee`, archive = `${root}/Employees_archive/employee`;
const identity = { uid: "actor", companyId: "company", isSuperUser: false };
const actor = { docId: "actor", companyId: "company", isAdmin: false, disabled: false, isTemporary: false, roles: ["manager"] };
// Independent acceptance catalog from employee-master.md, "従属document".
// Never generate these fixtures from the implementation's exports: removing a
// production query must fail coverage instead of removing its refusal test.
const REQUIRED_QUERIES = [
  ["SiteOperationSchedules", "employeeIds", "array-contains"],
  ["OperationResults", "employeeIds", "array-contains"],
  ["ArrangementNotifications", "employeeId", "=="],
  ["SiteEmployeeHistories", "employeeId", "=="],
  ["Users", "employeeId", "=="],
  ["LifecycleOperations", "employeeId", "=="],
  ["Billings", "employeeIds", "array-contains"],
  ["DailyAttendances", "employeeIds", "array-contains"],
  ["DailyOperationsByEmployee", "employeeIds", "array-contains"],
];
const REQUIRED_DOCUMENTS = ["EmployeeUserReservations", "EmployeeLifecycleLocks", "EmployeeLifecycleHeads"];
function independentRaw(value) {
  if (value instanceof Timestamp) return new Timestamp(value.seconds, value.nanoseconds);
  if (value instanceof GeoPoint) return new GeoPoint(value.latitude, value.longitude);
  if (Array.isArray(value)) return value.map(independentRaw);
  if (value !== null && typeof value === "object") {
    assert.equal(Object.getPrototypeOf(value), Object.prototype, "unexpected raw type must not remain shared");
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, independentRaw(item)]));
  }
  return value;
}
function employee() {
  const model = new Employee({ docId: "employee", lastName: "合成", firstName: "太郎", lastNameKana: "ゴウセイ", firstNameKana: "タロウ", displayName: "合成太郎", displayNameKana: "ゴウセイタロウ", gender: "MALE", dateOfBirth: parseDate("1990-01-01"), dateOfHire: parseDate("2026-01-01"), zipcode: "1000001", prefCode: "13", city: "合成市", address: "合成一丁目" });
  const raw = model.toObject(), convert = (value) => value instanceof Date ? Timestamp.fromDate(value) : Array.isArray(value) ? value.map(convert) : plain(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, convert(entry)])) : value;
  return { ...convert(raw), uid: "registered-by", createdAt: new Timestamp(1788200000, 123456789), updatedAt: new Timestamp(1788200001, 987654321) };
}
function setup(options = {}) {
  const records = new Map([[live, options.raw || employee()], [`${root}/Users/actor`, options.actor || actor], ["System/system", { isMaintenance: false }]]);
  const reads = [], writes = []; let identities = 0;
  const ref = (path, filter = null) => ({ path, filter, where: (field, operator, id) => ref(path, [field, operator, id]), limit: (n) => { assert.equal(n, 1); return ref(path, filter); } });
  const firestore = { doc: ref, collection: ref, runTransaction: async (callback) => {
    const pending = [];
    await callback({ get: async (reference) => {
      assert.equal(pending.length, 0, "all reads before writes"); reads.push(reference);
      if (options.failRead?.(reference)) throw new Error("read failure");
      if (reference.filter) return { size: [...records].filter(([path, raw]) => path.startsWith(`${reference.path}/`) && (reference.filter[1] === "==" ? raw[reference.filter[0]] === reference.filter[2] : raw[reference.filter[0]]?.includes(reference.filter[2]))).length ? 1 : 0 };
      return { exists: records.has(reference.path), data: () => records.get(reference.path) };
    }, create: (reference, raw) => pending.push([reference.path, raw]), delete: (reference) => pending.push([reference.path, null]) });
    if (options.commitError) throw new Error("commit refused");
    for (const [path, raw] of pending) { writes.push(path); if (raw === null) records.delete(path); else records.set(path, raw); }
  } };
  const resolveIdentity = async () => { identities++; return options.identity?.(identities) || identity; };
  const run = (input = { employeeId: "employee", reason: " 誤登録 ", operationId: "attempt" }, extra = {}) => archiveEmployee({ firestore, resolveIdentity, input, resolveAllowedTenants: () => ["company"], timestamp: () => new Timestamp(1788200100, 111222333), ...extra });
  return { records, reads, writes, run, firestore, resolveIdentity };
}

test("archive implements the independent twelve-dependency acceptance catalog", () => {
  assert.deepEqual(EMPLOYEE_ARCHIVE_QUERIES, REQUIRED_QUERIES);
  assert.deepEqual(EMPLOYEE_ARCHIVE_DOCUMENTS, REQUIRED_DOCUMENTS);
});
test("archive copies complete raw without changing unknown/null/missing/nanos/GeoPoint and is idempotent", async () => {
  const raw = employee(); delete raw.dateOfTermination; delete raw.reasonOfTermination; delete raw.insuranceOperationVersions;
  raw.fullName = "古い派生名"; raw.unknown = { stamp: new Timestamp(1788200000, 123456789), point: new GeoPoint(35, 139), nil: null, nested: [{ keep: true }] };
  raw.geopoint = raw.unknown.point;
  raw.securityCertifications = [{ name: "合成資格", type: Certification.classProps.type.component.attrs.items[0].value, issueDateAt: new Timestamp(1788200000, 123456789), nestedUnknown: { entries: [{ stamp: raw.updatedAt, point: raw.geopoint, nil: null }] } }];
  raw.healthInsurance.history = [{ status: "ENROLLED", previousStatus: null, enrollmentDateAt: raw.createdAt, number: "合成番号", lossDateAt: raw.updatedAt, unknown: { entries: [raw.createdAt, null, { keep: true }] } }];
  const before = independentRaw(raw), state = setup({ raw });
  assert.notStrictEqual(before.unknown.nested, raw.unknown.nested);
  assert.notStrictEqual(before.healthInsurance.history[0], raw.healthInsurance.history[0]);
  assert.notStrictEqual(before.securityCertifications[0].nestedUnknown, raw.securityCertifications[0].nestedUnknown);
  assert.notStrictEqual(before.createdAt, raw.createdAt); assert.ok(before.createdAt instanceof Timestamp);
  assert.notStrictEqual(before.geopoint, raw.geopoint); assert.ok(before.geopoint instanceof GeoPoint);
  assert.deepEqual(await state.run(), { success: true, archived: true });
  assert.equal(state.records.has(live), false); const envelope = state.records.get(archive);
  assert.deepEqual(Object.keys(envelope).sort(), ["audit", "employee", "schemaVersion"]); assert.deepEqual(envelope.employee, before); assert.strictEqual(envelope.employee, raw);
  assert.equal(Object.hasOwn(envelope.employee, "dateOfTermination"), false); assert.equal(Object.hasOwn(envelope.employee, "insuranceOperationVersions"), false);
  assert.equal(envelope.audit.reason, "誤登録"); assert.equal(envelope.audit.archivedAt.nanoseconds, 111222333);
  assert.deepEqual(state.reads.filter((reference) => reference.filter).map(({ path, filter }) => [path, ...filter]), REQUIRED_QUERIES.map(([name, field, operator]) => [`${root}/${name}`, field, operator, "employee"]));
  for (const name of REQUIRED_DOCUMENTS) assert.equal(state.reads.filter((reference) => reference.path === `${root}/${name}/employee`).length, 1);
  await state.run(); assert.equal(state.writes.length, 2);
  for (const changes of [{ operationId: "other" }, { reason: "別理由" }]) await assert.rejects(state.run({ employeeId: "employee", reason: "誤登録", operationId: "attempt", ...changes }), { code: "already-exists" });
  state.records.set(`${root}/Users/other-actor`, { ...actor, docId: "other-actor" });
  await assert.rejects(state.run(undefined, { resolveIdentity: async () => ({ ...identity, uid: "other-actor" }) }), { code: "already-exists" });
  await assert.rejects(saveEmployee({ firestore: state.firestore, resolveIdentity: state.resolveIdentity, input: { employeeId: "employee", changes: {}, expected: {} }, operation: "create", geocode: async () => { throw new Error("must not geocode"); } }), { code: "already-exists" });
});
for (const lifecycleState of ["access-revoke-pending", "access-revoked", "auth-delete-intent", "data-finalized", "completed", "failed-retryable"]) test(`archive refuses LifecycleOperations state ${lifecycleState}`, async () => {
  const state = setup(); state.records.set(`${root}/LifecycleOperations/op`, { employeeId: "employee", state: lifecycleState });
  await assert.rejects(state.run(), { code: "failed-precondition" }); assert.equal(state.writes.length, 0);
});
test("archive reads current User after initial authorization and rejects lost role", async () => {
  const state = setup(); let calls = 0;
  await assert.rejects(state.run(undefined, { resolveIdentity: async () => { if (++calls === 2) state.records.set(`${root}/Users/actor`, { ...actor, roles: [] }); return identity; } }), { code: "permission-denied" });
  assert.equal(state.writes.length, 0);
});
for (const [collection, field] of REQUIRED_QUERIES) test(`archive refuses ${collection} in any state`, async () => {
  const state = setup(); state.records.set(`${root}/${collection}/dependency`, { [field]: field === "employeeIds" ? ["employee"] : "employee", status: "COMPLETED", disabled: true, isTemporary: true });
  await assert.rejects(state.run(), { code: "failed-precondition" }); assert.equal(state.writes.length, 0); assert.equal(state.records.has(live), true);
});
for (const collection of REQUIRED_DOCUMENTS) test(`archive refuses even malformed ${collection} existence`, async () => {
  const state = setup(); state.records.set(`${root}/${collection}/employee`, { malformed: true }); await assert.rejects(state.run(), { code: "failed-precondition" }); assert.equal(state.writes.length, 0);
});
for (const options of [{ actor: { ...actor, isAdmin: true, roles: [] } }, {}]) test("archive allows only administrator or manager", async () => { const state = setup(options); await state.run(); assert.equal(state.writes.length, 2); });
for (const change of [{ roles: ["human-resource"] }, { roles: ["controller"] }, { roles: [] }, { roles: ["manager", "unknown"] }, { disabled: true }, { isTemporary: true }, { companyId: "other" }]) test("archive refuses unapproved current actor", async () => { const state = setup({ actor: { ...actor, ...change } }); await assert.rejects(state.run(), { code: "permission-denied" }); assert.equal(state.writes.length, 0); });
test("archive rechecks identity, maintenance, destination collisions and errors without writes", async () => {
  const states = [setup({ identity: (call) => ({ ...identity, companyId: call === 1 ? "company" : "other" }) }), setup({ failRead: (ref) => !!ref.filter }), setup({ commitError: true })];
  const maintenance = setup(); maintenance.records.set("System/system", { isMaintenance: true }); states.push(maintenance);
  const both = setup(); both.records.set(archive, { legacy: true }); states.push(both);
  const legacy = setup(); legacy.records.delete(live); legacy.records.set(archive, employee()); states.push(legacy);
  const missing = setup(); missing.records.delete(live); states.push(missing);
  for (const state of states) { await assert.rejects(state.run()); assert.equal(state.writes.length, 0); }
});
test("archive validates known raw before Class normalization while preserving valid resignation", async () => {
  for (const patch of [{ docId: "other" }, { createdAt: new Date() }, { dateOfHire: undefined }, { isForeigner: "false" }, { healthInsurance: null }, { securityCertifications: [{}] }, { insuranceOperationVersions: null }, { location: { lat: Infinity, lng: 0, formattedAddress: "x" } }]) {
    const state = setup({ raw: { ...employee(), ...patch } }); await assert.rejects(state.run()); assert.equal(state.writes.length, 0);
  }
  const raw = { ...employee(), employmentStatus: "RESIGNED", dateOfTermination: Timestamp.fromDate(parseDate("2026-08-01")), reasonOfTermination: "退職" };
  validateEmployeeArchiveRaw(raw, "employee"); const state = setup({ raw }); await state.run(); assert.strictEqual(state.records.get(archive).employee, raw);
});
test("archive input and startup configuration are strict and demo injection cannot authorize normal execution", async () => {
  for (const input of [{ employeeId: "../employee", reason: "x", operationId: "op" }, { employeeId: "employee", reason: " ", operationId: "op" }, { employeeId: "employee", reason: "x", operationId: "op", companyId: "company" }]) assert.throws(() => parseEmployeeArchiveInput(input));
  assert.deepEqual(parseArchiveTenants(undefined), []); assert.deepEqual(parseArchiveTenants('["company"]'), ["company"]);
  for (const setting of ["", "null", "{}", '["company","company"]', '["../company"]', '[1]']) assert.throws(() => parseArchiveTenants(setting));
  const state = setup(); await assert.rejects(state.run(undefined, { resolveAllowedTenants: () => [] }), { code: "permission-denied" }); assert.equal(state.writes.length, 0);
  const env = { GCLOUD_PROJECT: "demo-air-guard-v2-codex", FUNCTIONS_EMULATOR: "true", AIR_GUARD_EXTERNAL_EFFECTS: "deny", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", AIR_GUARD_CODEX_EMPLOYEE_ARCHIVE_TENANTS: '["company"]' };
  assert.deepEqual(demoEmployeeArchiveTenants(env), ["company"]);
  for (const field of ["GCLOUD_PROJECT", "FUNCTIONS_EMULATOR", "AIR_GUARD_EXTERNAL_EFFECTS", "FIRESTORE_EMULATOR_HOST"]) assert.throws(() => demoEmployeeArchiveTenants({ ...env, [field]: "invalid" }));
});
