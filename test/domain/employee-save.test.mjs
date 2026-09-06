import test from "node:test";
import assert from "node:assert/strict";
import { Employee } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { saveEmployee } from "../../functions/modules/employees/saveEmployee.js";
import { parseDate, encodeExpected, parseEmployeeInput, buildEmployeePatch, employeeAllowed, expectedFields, NATIONALITY_FIELDS } from "../../functions/shared/employeeContract.js";

const identity = { uid: "actor", companyId: "company", isSuperUser: false };
const actor = { docId: "actor", companyId: "company", isAdmin: false, disabled: false, isTemporary: false, roles: ["human-resource"] };
export function validEmployee() {
  return new Employee({ docId: "employee", lastName: "試験", firstName: "太郎", lastNameKana: "シケン", firstNameKana: "タロウ", displayName: "試験太郎", displayNameKana: "シケンタロウ", gender: "MALE", dateOfBirth: parseDate("1990-01-01"), dateOfHire: parseDate("2026-01-01"), zipcode: "1000001", prefCode: "13", city: "試験市", address: "合成一丁目" }).toObject();
}
function setup(raw = validEmployee(), overrides = {}) {
  const values = new Map([["Companies/company/Users/actor", actor], ...(raw ? [["Companies/company/Employees/employee", raw]] : [])]);
  let writes = 0, coordinates = 0, identities = 0;
  const firestore = { doc: (path) => ({ path }), runTransaction: async (fn) => {
    const pending = [];
    const result = await fn({ get: async (ref) => ({ exists: values.has(ref.path), data: () => values.get(ref.path) }), create: (ref, data) => pending.push([ref.path, data]), update: (ref, data) => pending.push([ref.path, { ...values.get(ref.path), ...data }]) });
    for (const [path, data] of pending) { values.set(path, data); writes++; }
    return result;
  } };
  const save = (operation, changes, expected = {}) => saveEmployee({ firestore, resolveIdentity: async () => { identities++; return identity; }, operation, input: { employeeId: "employee", changes, expected }, geocode: async () => { coordinates++; return null; }, timestamp: () => "server-time", ...overrides });
  return { save, values, counts: () => ({ writes, coordinates, identities }), raw: () => values.get("Companies/company/Employees/employee") };
}
test("EMP02 exact basic patch preserves unknown, absent lifecycle, insurance, and other sections", async () => {
  const raw = validEmployee(); delete raw.dateOfTermination; delete raw.reasonOfTermination; raw.unknown = { keep: 1 }; raw.insuranceOperationVersions = { healthInsurance: 8, pensionInsurance: 3, employmentInsurance: 0 };
  const state = setup(raw); await state.save("basic", { title: "主任" });
  assert.equal(state.raw().title, "主任"); assert.deepEqual(state.raw().unknown, { keep: 1 }); assert.equal(Object.hasOwn(state.raw(), "dateOfTermination"), false);
  assert.deepEqual(state.raw().healthInsurance, raw.healthInsurance); assert.deepEqual(state.raw().insuranceOperationVersions, raw.insuranceOperationVersions); assert.equal(state.counts().coordinates, 0);
});
test("EMP02 no-op performs no write or geocoding", async () => { const state = setup(); await state.save("basic", {}); assert.equal(state.counts().writes, 0); assert.equal(state.counts().coordinates, 0); });
test("EMP02 changed names derive display, but explicit display wins and kana stays independent", () => {
  const raw = validEmployee(); const first = buildEmployeePatch(raw, { firstName: "次郎" }, "basic"); assert.equal(first.patch.displayName, "試験次郎");
  const second = buildEmployeePatch(raw, { displayName: "表示指定", firstName: "次郎" }, "basic"); assert.equal(second.patch.displayName, "表示指定"); assert.equal(Object.hasOwn(second.patch, "displayNameKana"), false);
});
test("EMP02 strict dates retain expected nanoseconds and missing/null distinction", () => {
  assert.throws(() => parseDate("2026-02-30")); assert.throws(() => parseDate("2026-01-01T00:00:00Z"));
  assert.deepEqual(encodeExpected(new Timestamp(10, 123)), ["timestamp", 10, 123]); assert.notDeepEqual(encodeExpected(undefined), encodeExpected(null));
});
test("EMP02 malformed changes and unsafe actor roles fail closed", () => {
  for (const changes of [{ "healthInsurance.status": "X" }, { gender: {} }, { isForeigner: "false" }, { dateOfBirth: "bad" }]) assert.throws(() => parseEmployeeInput("basic", { employeeId: "employee", changes, expected: {} }));
  for (const roles of [[], ["employees:write"], ["human-resource", "unknown"], ["controller"]]) assert.equal(employeeAllowed({ ...identity, actorUser: { ...actor, roles } }), false);
  for (const role of ["manager", "human-resource"]) assert.equal(employeeAllowed({ ...identity, actorUser: { ...actor, roles: [role] } }), true);
  assert.equal(employeeAllowed({ ...identity, isSuperUser: true, actorUser: { ...actor, isAdmin: true } }), true);
});
test("EMP02 stale membership and nationality destructive expected values write nothing", async () => {
  const state = setup(); await assert.rejects(state.save("basic", { dateOfHire: "2026-02-01" }, { dateOfHire: ["null"] }), { code: "aborted" }); assert.equal(state.counts().writes, 0);
  const expected = expectedFields(state.raw(), NATIONALITY_FIELDS); expected.foreignName = ["string", "stale"];
  await assert.rejects(state.save("nationality", { isForeigner: false }, expected), { code: "aborted" }); assert.equal(state.counts().writes, 0);
});
test("EMP02 foreign flag clear owns defaults only and leaves unrelated fields", async () => {
  const raw = { ...validEmployee(), isForeigner: true, foreignName: "Synthetic", nationality: "試験国", residenceStatus: "試験資格" };
  const state = setup(raw); await state.save("nationality", { isForeigner: false }, expectedFields(raw, NATIONALITY_FIELDS)); assert.equal(state.raw().foreignName, null); assert.equal(state.raw().isForeigner, false); assert.equal(state.raw().lastName, raw.lastName);
});
test("EMP02 geocoding failure saves address, clears stale coordinates, and returns warning", async () => {
  const state = setup({ ...validEmployee(), location: { lat: 1, lng: 1 }, geopoint: "old" }); const result = await state.save("basic", { address: "新合成住所" });
  assert.equal(state.raw().address, "新合成住所"); assert.equal(state.raw().location, null); assert.equal(state.raw().geopoint, null); assert.ok(result.warning); assert.equal(state.counts().coordinates, 1);
});
test("EMP02 geocoding result cannot overwrite an address changed during request", async () => {
  let state; state = setup(validEmployee(), { geocode: async () => { state.values.set("Companies/company/Employees/employee", { ...state.raw(), address: "別画面" }); return null; } });
  await assert.rejects(state.save("basic", { address: "古い入力" }), { code: "aborted" }); assert.equal(state.counts().writes, 0); assert.equal(state.raw().address, "別画面");
});
test("EMP02 latest actor and retired state are checked again after geocoding", async () => {
  let state; state = setup(validEmployee(), { geocode: async () => { state.values.set("Companies/company/Users/actor", { ...actor, disabled: true }); return null; } });
  await assert.rejects(state.save("basic", { address: "変更" }), { code: "permission-denied" }); assert.equal(state.counts().writes, 0);
  const retired = setup({ ...validEmployee(), employmentStatus: "RESIGNED" }); await assert.rejects(retired.save("basic", { title: "変更" }), { code: "failed-precondition" });
});
test("EMP02 create is same-ID create-only and initializes insurance versions", async () => {
  const raw = validEmployee(); const input = Object.fromEntries(Object.keys(raw).filter((key) => ["lastName", "firstName", "lastNameKana", "firstNameKana", "displayName", "displayNameKana", "gender", "zipcode", "prefCode", "city", "address"].includes(key)).map((key) => [key, raw[key]])); Object.assign(input, { dateOfBirth: "1990-01-01", dateOfHire: "2026-01-01" });
  const state = setup(null); await state.save("create", input); assert.equal(state.raw().docId, "employee"); assert.deepEqual(state.raw().insuranceOperationVersions, { healthInsurance: 0, pensionInsurance: 0, employmentInsurance: 0 });
  await assert.rejects(state.save("create", input), { code: "already-exists" }); assert.equal(state.counts().writes, 1);
  const archived = setup(null); archived.values.set("Companies/company/Employees_archive/employee", {}); await assert.rejects(archived.save("create", input), { code: "already-exists" }); assert.equal(archived.counts().writes, 0);
});
test("EMP02 initially equal address cannot become a final address write with stale coordinates", async () => {
  for (const changes of [{ address: "合成一丁目", title: "主任" }, { address: "合成一丁目" }]) {
    let state, calls = 0;
    state = setup(validEmployee(), { resolveIdentity: async () => {
      if (++calls === 2) state.values.set("Companies/company/Employees/employee", { ...state.raw(), address: "別住所", location: { lat: 2, lng: 3 }, geopoint: "new-point" });
      return identity;
    } });
    await assert.rejects(state.save("basic", changes), { code: "aborted" });
    assert.equal(state.counts().writes, 0); assert.equal(state.counts().coordinates, 0); assert.equal(state.raw().address, "別住所"); assert.equal(state.raw().geopoint, "new-point");
  }
});
test("EMP02 nationality flag clear persists normalized candidate even for default raw mixed payload", async () => {
  for (const isForeigner of [false, true]) {
    const raw = { ...validEmployee(), isForeigner, foreignName: isForeigner ? "Original" : null, nationality: isForeigner ? "試験国" : null, residenceStatus: isForeigner ? "試験資格" : null };
    const state = setup(raw);
    await state.save("nationality", { isForeigner: false, foreignName: "残留不可", nationality: "残留不可", residenceStatus: "残留不可", hasPeriodOfStayLimit: true, periodOfStay: "2027-01-01", hasWorkRestrictions: true }, expectedFields(raw, NATIONALITY_FIELDS));
    assert.equal(state.raw().foreignName, null); assert.equal(state.raw().nationality, null); assert.equal(state.raw().periodOfStay, null); assert.equal(state.raw().hasPeriodOfStayLimit, false); assert.equal(state.raw().hasWorkRestrictions, false);
  }
});
test("EMP02 stay-limit clear owns the date and rejects stale destructive requests", async () => {
  const raw = { ...validEmployee(), isForeigner: true, foreignName: "Synthetic", nationality: "試験国", residenceStatus: "試験資格", hasPeriodOfStayLimit: true, periodOfStay: parseDate("2027-01-01"), unknown: "keep" };
  const expected = expectedFields(raw, ["hasPeriodOfStayLimit", "periodOfStay"]);
  const state = setup(raw); await state.save("nationality", { hasPeriodOfStayLimit: false, periodOfStay: "2028-01-01" }, expected);
  assert.equal(state.raw().periodOfStay, null); assert.equal(state.raw().hasPeriodOfStayLimit, false); assert.equal(state.raw().unknown, "keep"); assert.deepEqual(state.raw().healthInsurance, raw.healthInsurance);
  const stale = setup({ ...raw, periodOfStay: parseDate("2029-01-01") }); await assert.rejects(stale.save("nationality", { hasPeriodOfStayLimit: false }, expected), { code: "aborted" }); assert.equal(stale.counts().writes, 0);
  const noExpected = setup(raw); await assert.rejects(noExpected.save("nationality", { hasPeriodOfStayLimit: false }), { code: "invalid-argument" });
});
