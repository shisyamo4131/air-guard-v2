import test from "node:test";
import assert from "node:assert/strict";
import { Insurance } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp, FieldValue } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { saveEmployee } from "../../functions/modules/employees/saveEmployee.js";
import { encodeExpected, parseDate, rawForClass, INSURANCE_KINDS } from "../../functions/shared/employeeContract.js";
import { insuranceVersions, parseEmployeeInsuranceInput, prepareEmployeeInsurance, validateInsuranceRaw } from "../../functions/shared/employeeInsuranceContract.js";

const kind = "healthInsurance";
const fresh = () => ({ docId: "employee", employmentStatus: "ACTIVE", unknown: { keep: true }, ...Object.fromEntries(INSURANCE_KINDS.map((key) => [key, new Insurance().toObject()])) });
const enrolled = (processing = false) => { const value = new Insurance(); value.enroll({ enrollmentDateAt: parseDate("2026-01-01"), number: "SYNTHETIC", isProcessing: processing }); return value.toObject(); };
const loss = { lossDateAt: "2026-02-01", lossReason: "合成理由", isRetire: false };
const enroll = { enrollmentDateAt: "2026-01-01", number: "SYNTHETIC", isProcessing: false };
const request = (raw, action, changes = {}, target = kind) => ({ employeeId: "employee", kind: target, action, changes, expected: { map: encodeExpected(raw[target]), version: insuranceVersions(raw)[target] } });
const prepare = (raw, action, changes = {}, target = kind) => prepareEmployeeInsurance(raw, parseEmployeeInsuranceInput(request(raw, action, changes, target)));
const apply = (raw, prepared, target = kind) => ({ ...raw, [target]: prepared.nextMap, insuranceOperationVersions: prepared.versions });
for (const target of INSURANCE_KINDS) for (const action of ["enroll", "exempt"]) for (const version of [undefined, 0, 7]) {
  test(`EMP-INS absent ${target}/${action}/version ${version} initializes exactly one complete map`, async () => {
    const raw = fresh(); delete raw[target];
    if (version !== undefined) raw.insuranceOperationVersions = Object.fromEntries(INSURANCE_KINDS.map((key) => [key, version]));
    const other = INSURANCE_KINDS.find((key) => key !== target), stamp = new Timestamp(1767193200, 123456789);
    raw[other].history = [{ status: "NOT_ENROLLED", unknown: { stamp } }];
    const beforeOther = encodeExpected(raw[other]), input = request(raw, action, action === "enroll" ? enroll : {}, target);
    assert.deepEqual(input.expected.map, encodeExpected(undefined));
    const prepared = prepareEmployeeInsurance(raw, parseEmployeeInsuranceInput(input));
    assert.equal(Object.hasOwn(raw, target), false);
    const state = server(raw); await state.save(input);
    const model = new Insurance(); model[action](parseEmployeeInsuranceInput(input).changes);
    assert.deepEqual(state.raw()[target], model.toObject());
    assert.deepEqual(state.raw()[target], prepared.nextMap);
    assert.deepEqual(state.patches[0][target], prepared.nextMap);
    assert.ok(Array.isArray(state.raw()[target].history)); assert.equal(state.raw()[target].isProcessing, false);
    assert.equal(state.raw().insuranceOperationVersions[target], (version ?? 0) + 1);
    assert.deepEqual(encodeExpected(state.raw()[other]), beforeOther);
    assert.equal(state.raw().insuranceOperationVersions[other], version ?? 0);
    assert.equal(state.counts().writes, 1);
  });
}
test("EMP-INS present malformed maps never initialize and absent states only enroll or exempt", async () => {
  for (const value of [undefined, null, {}, [], { status: "NOT_ENROLLED" }]) {
    const raw = { ...fresh(), [kind]: value }, state = server(raw);
    await assert.rejects(state.save(request(raw, "enroll", enroll)), { code: "failed-precondition" }); assert.equal(state.counts().writes, 0);
  }
  for (const action of ["enrolled", "cancelEnroll", "loss", "rollback"]) {
    const raw = fresh(); delete raw[kind]; const state = server(raw);
    await assert.rejects(state.save(request(raw, action, action === "loss" ? loss : action === "enrolled" ? { number: "OK" } : {})), { code: "invalid-argument" });
    assert.equal(state.counts().writes, 0); assert.equal(Object.hasOwn(state.raw(), kind), false);
  }
});
test("EMP-INS final transaction rejects concurrent initialization and rechecks permission, retirement and tenant", async () => {
  for (const [beforeFinal, code] of [
    [({ raw }) => { raw[kind] = new Insurance().toObject(); }, "aborted"],
    [({ actor }) => { actor.disabled = true; }, "permission-denied"],
    [({ raw }) => { raw.employmentStatus = "RESIGNED"; }, "failed-precondition"],
  ]) {
    const raw = fresh(); delete raw[kind]; const state = server(raw, { beforeFinal });
    await assert.rejects(state.save(request(raw, "enroll", enroll)), { code }); assert.equal(state.counts().writes, 0);
  }
  const raw = fresh(); delete raw[kind];
  const state = server(raw, { resolveIdentity: (count) => ({ uid: "actor", companyId: count === 1 ? "company" : "other", isSuperUser: false }) });
  await assert.rejects(state.save(request(raw, "enroll", enroll)), { code: "permission-denied" }); assert.equal(state.counts().writes, 0);
});
function server(raw = fresh(), options = {}) {
  let writes = 0, geocodes = 0, auths = 0, transactions = 0, patches = [];
  const identity = { uid: "actor", companyId: "company", isSuperUser: false };
  let actor = { docId: "actor", companyId: "company", isAdmin: false, roles: ["human-resource"], disabled: false, isTemporary: false, ...options.actor };
  const firestore = { doc: (path) => ({ path }), runTransaction: async (fn) => {
    transactions++; if (transactions === 2) options.beforeFinal?.({ raw, actor });
    const pending = [];
    const result = await fn({ get: async (ref) => ({ exists: ref.path.endsWith("/actor") || raw !== null, data: () => ref.path.endsWith("/actor") ? actor : raw }), update: (_, patch) => pending.push(patch) });
    if (pending.length && options.rejectCommit) throw new Error("commit-rejected");
    for (const patch of pending) {
      patches.push(patch); const next = { ...raw };
      for (const [path, value] of Object.entries(patch)) {
        const [field, child] = path.split(".");
        if (child) { next[field] = { ...next[field] }; if (value?.isEqual?.(FieldValue.delete())) delete next[field][child]; else next[field][child] = value; }
        else next[field] = value;
      }
      raw = next; writes++;
    }
    return result;
  } };
  return { raw: () => raw, counts: () => ({ writes, geocodes, auths }), patches,
    save: (input) => saveEmployee({ firestore, operation: "insurance", input, resolveIdentity: async () => { auths++; return options.resolveIdentity?.(auths) ?? identity; }, timestamp: () => "server-time", geocode: async () => { geocodes++; throw Error("forbidden"); } }) };
}

test("EMP-INS initial map and generation remain absent together when commit fails", async () => {
  const raw = { docId: "employee", employmentStatus: "ACTIVE", unknown: { at: new Timestamp(1767193200, 123456789) } };
  const before = encodeExpected(raw), state = server(raw, { rejectCommit: true });
  await assert.rejects(state.save(request(raw, "enroll", enroll)), /commit-rejected/);
  assert.deepEqual(encodeExpected(state.raw()), before);
  for (const key of [...INSURANCE_KINDS, "insuranceOperationVersions"]) assert.equal(Object.hasOwn(state.raw(), key), false);
  assert.equal(state.counts().writes, 0);
});

for (const target of INSURANCE_KINDS) for (const action of ["enroll", "enrolled", "cancelEnroll", "exempt", "loss", "rollback"]) {
  test(`EMP04 ${target}/${action} matches installed transition and increments only its generation`, async () => {
    const raw = fresh(); let changes = {};
    if (action === "enroll") changes = enroll;
    if (["enrolled", "cancelEnroll"].includes(action)) raw[target] = enrolled(true);
    if (action === "enrolled") changes = { number: "COMPLETED" };
    if (["exempt", "loss", "rollback"].includes(action)) raw[target] = enrolled();
    if (action === "exempt") changes = { lossDateAt: loss.lossDateAt, lossReason: loss.lossReason };
    if (action === "loss") changes = loss;
    if (action === "rollback") { const previous = new Insurance(rawForClass(raw[target])); previous.loss({ ...loss, lossDateAt: parseDate(loss.lossDateAt) }); raw[target] = previous.toObject(); }
    raw.insuranceOperationVersions = { healthInsurance: 4, pensionInsurance: 5, employmentInsurance: 6 };
    const input = request(raw, action, changes, target), model = new Insurance(rawForClass(raw[target]));
    model[action](parseEmployeeInsuranceInput(input).changes);
    const state = server(raw); await state.save(input);
    assert.deepEqual(state.raw()[target], model.toObject());
    assert.equal(state.raw().insuranceOperationVersions[target], raw.insuranceOperationVersions[target] + 1);
    for (const other of INSURANCE_KINDS.filter((key) => key !== target)) { assert.deepEqual(state.raw()[other], raw[other]); assert.equal(state.raw().insuranceOperationVersions[other], raw.insuranceOperationVersions[other]); }
    assert.deepEqual(state.raw().unknown, { keep: true }); assert.deepEqual(state.counts(), { writes: 1, geocodes: 0, auths: 2 });
  });
}
test("EMP04 exact input rejects unknown operations, fields, types, malformed dates and lengths before method resets", () => {
  const raw = { ...fresh(), [kind]: enrolled() };
  for (const override of [{ rogue: true }, { kind: "other" }, { action: "toObject" }, { changes: { status: "EXEMPT" } }, { changes: { lossDateAt: "2026-02-30" } }, { changes: { isRetire: "false" } }, { changes: { lossReason: "a".repeat(41) } }, { expected: { map: [], version: 0, extra: true } }]) assert.throws(() => parseEmployeeInsuranceInput({ ...request(raw, "loss", loss), ...override }), { code: "invalid-argument" });
  assert.throws(() => parseEmployeeInsuranceInput(request(fresh(), "enroll", { ...enroll, isProcessing: true, number: "a".repeat(21) })), { code: "invalid-argument" });
  assert.doesNotThrow(() => prepare(raw, "loss", { ...loss, lossReason: "a".repeat(40) }));
  assert.doesNotThrow(() => prepare(fresh(), "enroll", { ...enroll, number: "a".repeat(20), enrollmentDateAt: "2099-01-01" }));
  assert.doesNotThrow(() => prepare(raw, "loss", { ...loss, lossDateAt: "1990-01-01" }));
});
test("EMP04 only wholly absent version map is legacy; malformed and overflow generations reject", () => {
  assert.deepEqual(insuranceVersions(fresh()), { healthInsurance: 0, pensionInsurance: 0, employmentInsurance: 0 });
  const zero = insuranceVersions(fresh());
  for (const value of [null, [], {}, { ...zero, extra: 0 }, { healthInsurance: 0, pensionInsurance: 0 }, ...[null, "0", -1, 0.1, Number.MAX_SAFE_INTEGER + 1].map((value) => ({ ...zero, [kind]: value }))]) assert.throws(() => insuranceVersions({ insuranceOperationVersions: value }), { code: "failed-precondition" });
  assert.throws(() => prepare({ ...fresh(), insuranceOperationVersions: { ...zero, [kind]: Number.MAX_SAFE_INTEGER } }, "enroll", enroll), { code: "failed-precondition" });
  assert.equal(prepare(fresh(), "enroll", enroll).legacyVersions, true);
});
test("EMP04 raw invalid shape fails without silent class default; missing optional fields survive", () => {
  for (const value of [null, {}, [], { ...new Insurance().toObject(), status: "unknown" }, { ...new Insurance().toObject(), isProcessing: null }, { ...new Insurance().toObject(), history: null }, { ...new Insurance().toObject(), enrollmentDateAt: "2026-01-01" }, { ...new Insurance().toObject(), history: [null] }]) assert.throws(() => validateInsuranceRaw(value), { code: "failed-precondition" });
  const raw = fresh(); delete raw[kind].lossDateAt; delete raw[kind].lossReason;
  const prepared = prepare(raw, "enroll", enroll); assert.equal(prepared.nextMap.lossDateAt, null); assert.equal(prepared.nextMap.lossReason, null);
});
test("EMP04 history push and rollback preserve raw nanos, unknowns and absent restored fields including dotted deletes", async () => {
  const stamp = new Timestamp(1767193200, 123456789), old = { status: "NOT_ENROLLED", mystery: { at: stamp } };
  const raw = { ...fresh(), [kind]: { ...enrolled(), enrollmentDateAt: stamp, unknown: { keep: stamp }, history: [old] } };
  const lost = apply(raw, prepare(raw, "loss", loss));
  assert.strictEqual(lost[kind].history[0], old); assert.strictEqual(lost[kind].history[1].enrollmentDateAt, stamp);
  const restored = apply(lost, prepare(lost, "rollback")); assert.strictEqual(restored[kind].enrollmentDateAt, stamp); assert.strictEqual(restored[kind].unknown.keep, stamp); assert.deepEqual(restored[kind].history, [old]); assert.equal(restored[kind].enrollmentDate, "2026-01-01");
  const state = server(restored), expected = prepare(restored, "rollback"); await state.save(request(restored, "rollback"));
  assert.deepEqual(state.raw()[kind], expected.nextMap);
  for (const field of ["previousStatus", "enrollmentDateAt", "number"]) { assert.equal(Object.hasOwn(state.raw()[kind], field), false); assert.equal(state.patches[0][`${kind}.${field}`].isEqual(FieldValue.delete()), true); }
  assert.equal(state.raw()[kind].enrollmentDate, ""); assert.equal(state.raw()[kind].unknown.keep.nanoseconds, 123456789);
});
test("EMP04 no unrelated raw date rounding or missing normalization on completion", async () => {
  const raw = { ...fresh(), [kind]: { ...enrolled(true), enrollmentDateAt: new Timestamp(1767193200, 999999999) } };
  delete raw[kind].previousStatus; delete raw[kind].enrollmentDate;
  const state = server(raw); await state.save(request(raw, "enrolled", { number: "OK" }));
  assert.strictEqual(state.raw()[kind].enrollmentDateAt, raw[kind].enrollmentDateAt); assert.equal(Object.hasOwn(state.raw()[kind], "previousStatus"), false); assert.equal(Object.hasOwn(state.raw()[kind], "enrollmentDate"), false);
});
test("EMP04 date transitions preserve absent getter and synchronize it only when already stored", async () => {
  for (const hasGetter of [false, true]) {
    const raw = { ...fresh(), [kind]: enrolled() }; if (!hasGetter) delete raw[kind].enrollmentDate;
    const original = encodeExpected(raw[kind]), state = server(raw);
    await state.save(request(state.raw(), "loss", loss));
    assert.equal(Object.hasOwn(state.raw()[kind], "enrollmentDate"), hasGetter);
    if (hasGetter) assert.equal(state.raw()[kind].enrollmentDate, "");
    await state.save(request(state.raw(), "rollback"));
    assert.deepEqual(encodeExpected(state.raw()[kind]), original);
    const initial = fresh(); if (!hasGetter) delete initial[kind].enrollmentDate;
    const enrolling = server(initial);
    await enrolling.save(request(enrolling.raw(), "enroll", { ...enroll, isProcessing: true }));
    assert.equal(Object.hasOwn(enrolling.raw()[kind], "enrollmentDate"), hasGetter);
    if (hasGetter) assert.equal(enrolling.raw()[kind].enrollmentDate, "2026-01-01");
    await enrolling.save(request(enrolling.raw(), "cancelEnroll"));
    assert.equal(Object.hasOwn(enrolling.raw()[kind], "enrollmentDate"), hasGetter);
    if (hasGetter) assert.equal(enrolling.raw()[kind].enrollmentDate, "");
    else for (const patch of [...state.patches, ...enrolling.patches]) assert.equal(Object.hasOwn(patch, `${kind}.enrollmentDate`), false);
  }
});
test("EMP04 loss while processing preserves processing and admits the next existing transition", () => {
  for (const isRetire of [false, true]) {
    const raw = { ...fresh(), [kind]: enrolled(true) }, next = apply(raw, prepare(raw, "loss", { ...loss, isRetire }));
    assert.equal(next[kind].isProcessing, true); assert.equal(next[kind].status, isRetire ? "NOT_ENROLLED" : "EXEMPT");
    assert.doesNotThrow(() => prepare(next, "enroll", enroll));
  }
});
test("EMP04 separate insurance changes preserve latest other generations and reject same-kind stale map", async () => {
  const raw = fresh(); raw.insuranceOperationVersions = insuranceVersions(raw);
  const oldOther = request(raw, "enroll", enroll, "pensionInsurance"), next = apply(raw, prepare(raw, "enroll", enroll));
  const state = server(next); await state.save(oldOther); assert.equal(state.raw().insuranceOperationVersions[kind], 1); assert.equal(state.raw().insuranceOperationVersions.pensionInsurance, 1);
  await assert.rejects(state.save(request(raw, "enroll", enroll)), { code: "aborted" }); assert.equal(state.counts().writes, 1);
});
test("EMP04 generations reject ABA loss/rollback/old-loss and rollback/other/old-rollback", () => {
  let raw = { ...fresh(), [kind]: enrolled() };
  const oldLoss = parseEmployeeInsuranceInput(request(raw, "loss", loss));
  raw = apply(raw, prepare(raw, "loss", loss));
  const oldRollback = parseEmployeeInsuranceInput(request(raw, "rollback"));
  raw = apply(raw, prepare(raw, "rollback"));
  assert.deepEqual(encodeExpected(raw[kind]), oldLoss.expected.map);
  assert.throws(() => prepareEmployeeInsurance(raw, oldLoss), { code: "aborted" });
  raw = apply(raw, prepare(raw, "loss", loss)); assert.deepEqual(encodeExpected(raw[kind]), oldRollback.expected.map); assert.throws(() => prepareEmployeeInsurance(raw, oldRollback), { code: "aborted" }); assert.equal(insuranceVersions(raw)[kind], 3);
});
test("EMP04 latest actor, tenant, lifecycle and raw expectation are checked before final write", async () => {
  for (const actor of [{ roles: ["manager"] }, { isAdmin: true, roles: [] }, { roles: ["human-resource"] }]) { const raw = fresh(), state = server(raw, { actor }); await state.save(request(raw, "enroll", enroll)); assert.equal(state.counts().writes, 1); }
  for (const actor of [{ roles: ["labor"] }, { disabled: true }, { isTemporary: true }, { roles: ["invented"] }, { companyId: "other" }]) { const raw = fresh(), state = server(raw, { actor }); await assert.rejects(state.save(request(raw, "enroll", enroll)), { code: "permission-denied" }); assert.equal(state.counts().writes, 0); }
  for (const beforeFinal of [({ actor }) => { actor.disabled = true; }, ({ raw }) => { raw.employmentStatus = "RESIGNED"; }, ({ raw }) => { raw[kind] = enrolled(); }]) { const raw = fresh(), state = server(raw, { beforeFinal }); await assert.rejects(state.save(request(raw, "enroll", enroll))); assert.equal(state.counts().writes, 0); }
  const raw = fresh(), state = server(raw, { resolveIdentity: (count) => ({ uid: "actor", companyId: count === 1 ? "company" : "other", isSuperUser: false }) }); await assert.rejects(state.save(request(raw, "enroll", enroll)), { code: "permission-denied" }); assert.equal(state.counts().writes, 0);
});
test("EMP04 every invalid transition and non-ACTIVE record produces zero writes", async () => {
  for (const action of ["enroll", "enrolled", "cancelEnroll", "exempt", "loss", "rollback"]) {
    const raw = fresh(); if (action === "enroll") raw[kind] = enrolled(); if (action === "exempt") raw[kind].status = "EXEMPT";
    const state = server(raw), changes = action === "enroll" ? enroll : action === "loss" ? loss : action === "enrolled" ? { number: "OK" } : {};
    await assert.rejects(state.save(request(raw, action, changes)), { code: "invalid-argument" }); assert.equal(state.counts().writes, 0);
  }
  for (const override of [{ employmentStatus: "RESIGNED" }, { employmentStatus: null }, { docId: "other" }]) { const raw = { ...fresh(), ...override }, state = server(raw); await assert.rejects(state.save(request(raw, "enroll", enroll)), { code: "failed-precondition" }); assert.equal(state.counts().writes, 0); }
});
test("EMP04 final transaction preserves concurrent other-insurance version and checks raw precision", async () => {
  const raw = fresh(); raw.insuranceOperationVersions = insuranceVersions(raw);
  const state = server(raw, { beforeFinal: ({ raw }) => { raw.insuranceOperationVersions.pensionInsurance = 9; raw.pensionInsurance = enrolled(); } });
  await state.save(request(raw, "enroll", enroll)); assert.equal(state.raw().insuranceOperationVersions.pensionInsurance, 9); assert.equal(state.raw().pensionInsurance.status, "ENROLLED");
  const precise = { ...fresh(), [kind]: { ...enrolled(true), enrollmentDateAt: new Timestamp(1767193200, 123) } }, input = request(precise, "enrolled", { number: "OK" });
  const raced = server(precise, { beforeFinal: ({ raw }) => { raw[kind].enrollmentDateAt = new Timestamp(1767193200, 124); } }); await assert.rejects(raced.save(input), { code: "aborted" }); assert.equal(raced.counts().writes, 0);
});
