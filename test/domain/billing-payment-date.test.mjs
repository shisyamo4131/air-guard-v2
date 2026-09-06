import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Vue from "vue";
import { User } from "@shisyamo4131/air-guard-v2-schemas";
import { Timestamp } from "../../functions/node_modules/firebase-admin/lib/firestore/index.js";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import * as contract from "../../functions/shared/billingPaymentContract.js";
import { parseDate, dateInput, encodeExpected } from "../../functions/shared/employeeContract.js";
import { updateBillingPaymentDate } from "../../functions/modules/billings/updateBillingPaymentDate.js";

const id = "customer_site_2026-09-30";
const billing = () => ({ docId: id, billingDateAt: Timestamp.fromDate(parseDate("2026-09-30")), paymentDueDateAt: Timestamp.fromDate(parseDate("2026-10-31")), paymentDueDate: "2026-10-31", paymentDueMonth: "2026-10", employeeIds: ["a"], operationResults: [{ unknown: true }], unknown: { nano: new Timestamp(1788200000, 123456789), nil: null } });
function server({ raw = billing(), actor = { docId: "actor", companyId: "company", disabled: false, isTemporary: false, roles: [] }, identity = { uid: "actor", companyId: "company", isSuperUser: false }, resolveIdentity } = {}) {
  const writes = [], reads = [];
  const firestore = { doc: (path) => ({ path }), runTransaction: async (callback) => callback({ get: async (ref) => { assert.equal(writes.length, 0); reads.push(ref.path); const value = ref.path.endsWith("/Users/actor") ? actor : ref.path.endsWith(`/Billings/${id}`) ? raw : null; return { exists: !!value, data: () => value }; }, update: (ref, patch) => writes.push({ ref, patch }) }) };
  return { raw, writes, reads, save: (paymentDueDate, overrides = {}) => updateBillingPaymentDate({ firestore, resolveIdentity: resolveIdentity || (async () => identity), input: { documentId: id, expected: contract.paymentExpected(raw), paymentDueDate, ...overrides } }) };
}

for (const value of [null, "2026-09-30", "2026-12-31", "2027-01-01", "2028-02-29"]) test(`payment ${value} updates exactly three fields and audit while preserving raw`, async () => {
  const state = server(), before = encodeExpected(state.raw); await state.save(value);
  assert.equal(state.writes.length, 1); const { patch } = state.writes[0]; assert.deepEqual(Object.keys(patch).sort(), [...contract.PAYMENT_FIELDS, "uid", "updatedAt"].sort());
  assert.equal(dateInput(patch.paymentDueDateAt), value); assert.equal(patch.paymentDueDate, value); assert.equal(patch.paymentDueMonth, value?.slice(0, 7) ?? null); assert.deepEqual(encodeExpected(state.raw), before);
});
test("payment no-op requires all three values; missing/null remain distinct expected states", async () => {
  let state = server(); assert.deepEqual(await state.save("2026-10-31"), { success: true, updated: false }); assert.equal(state.writes.length, 0);
  delete state.raw.paymentDueMonth; await state.save("2026-10-31"); assert.equal(state.writes.length, 1);
  const raw = billing(); delete raw.paymentDueDateAt; delete raw.paymentDueDate; delete raw.paymentDueMonth; state = server({ raw });
  await assert.rejects(state.save(null, { expected: contract.paymentExpected({ ...raw, paymentDueDateAt: null }) }), { code: "aborted" }); assert.equal(state.writes.length, 0);
  await state.save(null); assert.deepEqual(Object.fromEntries(contract.PAYMENT_FIELDS.map((key) => [key, state.writes[0].patch[key]])), { paymentDueDateAt: null, paymentDueDate: null, paymentDueMonth: null });
});
for (const value of ["2026-09-29", "2027-02-29", "2026-13-01", "2026-09-30T00:00:00Z", undefined]) test(`invalid payment ${value} writes nothing`, async () => { const state = server(); await assert.rejects(state.save(value)); assert.equal(state.writes.length, 0); });
for (const actor of [null, { docId: "actor", companyId: "other", disabled: false, isTemporary: false }, { docId: "actor", companyId: "company", disabled: true, isTemporary: false }, { docId: "actor", companyId: "company", disabled: false, isTemporary: true }]) test("payment refuses missing/other/disabled/temporary current User", async () => { const state = server({ actor }); await assert.rejects(state.save(null), { code: "permission-denied" }); assert.equal(state.writes.length, 0); });
test("payment compound Billing IDs accept maximum existing generation size; traversal and unknown fields reject", async () => {
  assert.equal(contract.billingIdentifier(`${"c".repeat(128)}_${"s".repeat(128)}_2026-09-30`), true);
  assert.equal(contract.billingIdentifier("x".repeat(269)), false);
  const state = server(); await assert.rejects(state.save(null, { documentId: "../other" })); await assert.rejects(state.save(null, { employeeIds: [] })); assert.equal(state.writes.length, 0);
});

test("payment rechecks current Auth and billing date inside the transaction while preserving newer background fields", async () => {
  let calls = 0;
  const changedAuth = server({ resolveIdentity: async () => ({ uid: "actor", companyId: ++calls === 1 ? "company" : "other", isSuperUser: false }) });
  await assert.rejects(changedAuth.save(null), { code: "permission-denied" }); assert.equal(changedAuth.writes.length, 0);
  const raw = billing(), oldExpected = contract.paymentExpected(raw), originalDate = raw.billingDateAt;
  raw.billingDateAt = Timestamp.fromDate(parseDate("2026-10-01")); const changedDate = server({ raw });
  await assert.rejects(changedDate.save(null, { expected: oldExpected }), { code: "aborted" }); assert.equal(changedDate.writes.length, 0);
  raw.billingDateAt = originalDate; raw.operationResults = [{ background: "newer" }]; raw.employeeIds = ["new"];
  const current = server({ raw }); await current.save(null, { expected: oldExpected });
  const committed = { ...raw, ...current.writes[0].patch };
  assert.deepEqual(committed.operationResults, [{ background: "newer" }]); assert.deepEqual(committed.employeeIds, ["new"]);
  const precise = billing(); precise.paymentDueDateAt = new Timestamp(precise.paymentDueDateAt.seconds, 123456789);
  const stale = { ...precise, paymentDueDateAt: new Timestamp(precise.paymentDueDateAt.seconds, 123456000) }, precision = server({ raw: precise });
  await assert.rejects(precision.save(null, { expected: contract.paymentExpected(stale) }), { code: "aborted" }); assert.equal(precision.writes.length, 0);
});

const flush = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve(); };
async function client(options = {}) {
  const auth = Vue.reactive({ uid: "actor", companyId: "company", isSuperUser: false, isSuperUserClaimValid: true, user: new User({ docId: "actor", companyId: "company", disabled: false, isTemporary: false, roles: [] }) });
  let raw = billing(), count = 0; const calls = [], documentId = Vue.ref(id);
  const source = (await readFile(new URL("../../composables/application/customerBilling/useBillingPaymentDate.js", import.meta.url), "utf8")).replace(/import[\s\S]*?;\s*/gu, "").replace("export function", "function");
  const bindings = { ...Vue, ...contract, dateInput, useAuthStore: () => auth, useNuxtApp: () => ({ $firestore: {}, $functions: {} }), doc: (_, path) => ({ path }), getDocFromServer: async (ref) => { count++; if (options.read) return options.read(ref, count, raw); return { exists: () => true, data: () => raw }; }, httpsCallable: () => async (input) => { calls.push(input); return options.call ? options.call(input) : { data: { success: true } }; } };
  const make = new Function(...Object.keys(bindings), `${source}; return useBillingPaymentDate;`)(...Object.values(bindings));
  const effect = Vue.effectScope(); let editor; effect.run(() => { editor = make(documentId); });
  return { editor, effect, auth, documentId, calls, setRaw: (value) => { raw = value; } };
}
test("payment client accepts actual reactive User, opens independent draft and cancel sends zero", async () => { const state = await client(); assert.equal(state.editor.allowed.value, true); await state.editor.open(); state.editor.setValue(null); assert.equal(state.editor.baseline.value.paymentDueDate, "2026-10-31"); state.editor.close(); assert.equal(state.calls.length, 0); state.effect.stop(); });
for (const code of ["functions/aborted", "functions/unavailable"]) test(`payment ${code} keeps draft; reload unknown proves current match only`, async () => {
  const state = await client({ call: async () => { throw Object.assign(new Error(), { code }); } }); await state.editor.open(); state.editor.setValue("2026-12-31"); assert.equal(await state.editor.save(), false); assert.equal(state.editor.value.value, "2026-12-31"); await state.editor.save(); assert.equal(state.calls.length, 1);
  if (code === "functions/unavailable") { state.setRaw({ ...billing(), ...contract.paymentPatch(billing(), "2026-12-31") }); await state.editor.reload(); assert.match(state.editor.message.value, /現在値.*一致/u); assert.doesNotMatch(state.editor.message.value, /保存済み|保存しました/u); }
  state.effect.stop();
});
for (const code of ["permission-denied", "unavailable"]) test(`payment known save and ${code} read failure ends successful attempt without resend`, async () => {
  const state = await client({ read: async (_, count, raw) => { if (count > 1) throw Object.assign(new Error(), { code }); return { exists: () => true, data: () => raw }; } }); await state.editor.open(); state.editor.setValue(null); assert.equal(await state.editor.save(), true); assert.equal(state.editor.uncertain.value, false); assert.match(state.editor.message.value, /保存済み/u); await state.editor.save(); assert.equal(state.calls.length, 1); state.effect.stop();
});
test("payment route or claim change discards old read and save responses", async () => {
  let finish; const state = await client({ call: () => new Promise((resolve) => { finish = resolve; }) }); await state.editor.open(); state.editor.setValue(null); const pending = state.editor.save(); await flush(); state.documentId.value = "other_site_2026-09-30"; finish({ data: { success: true } }); assert.equal(await pending, false); assert.equal(state.editor.baseline.value, null); assert.equal(state.editor.message.value, "");
  state.auth.isSuperUserClaimValid = false; assert.equal(state.editor.allowed.value, false); state.effect.stop();
  let readFinish; const next = await client({ read: () => new Promise((resolve) => { readFinish = resolve; }) }); const opening = next.editor.open(); next.documentId.value = "next"; readFinish({ exists: () => true, data: billing }); assert.equal(await opening, false); assert.equal(next.editor.baseline.value, null); next.effect.stop();
});

for (const change of ["tenant", "actor", "disabled", "claim"]) test(`payment ${change} loss and restoration cannot revive a delayed refusal`, async () => {
  let reject; const state = await client({ call: () => new Promise((_, fail) => { reject = fail; }) });
  await state.editor.open(); state.editor.setValue(null); const pending = state.editor.save(); await flush();
  if (change === "tenant") { state.auth.companyId = "other"; state.auth.companyId = "company"; }
  if (change === "actor") { state.auth.uid = "other"; state.auth.uid = "actor"; }
  if (change === "disabled") { state.auth.user.disabled = true; state.auth.user.disabled = false; }
  if (change === "claim") { state.auth.isSuperUserClaimValid = false; state.auth.isSuperUserClaimValid = true; }
  reject(Object.assign(new Error(), { code: "functions/permission-denied" }));
  assert.equal(await pending, false); assert.equal(state.editor.message.value, ""); assert.equal(state.editor.conflict.value, false); assert.equal(state.editor.baseline.value, null);
  state.effect.stop();
});
test("payment dedicated component/page compile and old whole-document manager is unreachable", async () => {
  for (const file of ["components/CustomerBilling/PaymentDateEditor.vue", "pages/billings/customers/[id].vue"]) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8"), { descriptor } = parse(source); const compiled = compileScript(descriptor, { id: file });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: compiled.bindings } }).errors, []);
    if (file.startsWith("pages")) { assert.doesNotMatch(source, /air-item-manager|useCustomerBillingManager/u); assert.match(source, /PaymentDateEditor :document-id="docId"/u); assert.match(source, /computed\(\(\) => typeof route.params.id/u); }
  }
});
