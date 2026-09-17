import test from "node:test";
import assert from "node:assert/strict";
import FireModel from "@shisyamo4131/air-firebase-v2";
import { AgreementV2 } from "@shisyamo4131/air-guard-v2-schemas";
import { OperationBilling } from "../../schemas/index.js";

function agreement(date, extra = 0) {
  return new AgreementV2({
    dateAt: new Date(`${date}T00:00:00Z`), shiftType: "DAY", cutoffDate: 20, startTime: "08:00", endTime: "17:00", billingUnitType: "PER_DAY",
    rates: { WEEKDAY: { unitPriceBase: 100 + extra, unitPriceQualified: 120 + extra, overtimeUnitPriceBase: 10, overtimeUnitPriceQualified: 12 } },
  }).toObject();
}

function adapterHarness(sites, calls) {
  const load = async function load(args = {}, returnDocument = false) {
    calls.push({ method: returnDocument ? "Site.fetchDoc" : "Site.fetch", docId: args.docId, transaction: args.transaction });
    const value = sites.get(args.docId);
    if (!value) return returnDocument ? null : false;
    Object.assign(this, value, { docId: args.docId });
    return returnDocument ? this : true;
  };
  return {
    fetch: function fetch(args) { return load.call(this, args, false); },
    fetchDoc: function fetchDoc(args) { return load.call(this, args, true); },
    async update(args = {}) { calls.push({ method: "OperationBilling.update", transaction: args.transaction }); return { id: this.docId }; },
    async runTransaction(callback) { const transaction = { id: "transaction-1" }; calls.push({ method: "runTransaction", transaction }); return await callback(transaction); },
  };
}

function model(siteId, currentAgreement, previousAgreement = currentAgreement) {
  const value = new OperationBilling({ docId: "billing", uid: "actor", siteId, customerId: null, dateAt: new Date("2026-09-01"), shiftType: "DAY", agreement: currentAgreement, billingDateAt: new Date("2026-09-30") });
  value._beforeData = { ...value.toObject(), siteId, agreement: previousAgreement, isLocked: false, groupKey: value.groupKey };
  return value;
}

test("root OperationBilling runs transaction update and propagates the same transaction to Site fetch and draft update", async () => {
  const siteA = agreement("2026-01-01"), siteB = agreement("2026-02-01", 50);
  const sites = new Map([
    ["site-a", { customerId: "customer-a", agreementsV2: [siteA] }],
    ["site-b", { customerId: "customer-b", agreementsV2: [siteB] }],
  ]);
  const calls = [], previousConfig = FireModel.getConfig();
  FireModel.setAdapter(adapterHarness(sites, calls)); FireModel.setConfig({ prefix: "Companies/company" });
  try {
    const draft = model("site-b", siteB, siteA);
    draft._beforeData.siteId = "site-a";
    draft._beforeData.groupKey = "old-group";
    await OperationBilling.runTransaction(async (transaction) => {
      await draft._syncCustomerIdAndApplyAgreement({ transaction });
      await draft.update({ transaction });
    });
    assert.equal(draft.customerId, "customer-b");
    assert.deepEqual(draft.agreement.toObject(), siteB);
    assert.equal(calls.find((call) => call.method === "runTransaction").transaction.id, "transaction-1");
    const siteCalls = calls.filter((call) => call.method === "Site.fetch" || call.method === "Site.fetchDoc");
    assert.ok(siteCalls.length >= 1);
    assert.ok(siteCalls.every((call) => call.transaction?.id === "transaction-1"));
    assert.equal(calls.at(-1).method, "OperationBilling.update");
    assert.equal(calls.at(-1).transaction.id, "transaction-1");
  } finally {
    FireModel.setAdapter(null); FireModel.setConfig(previousConfig);
  }
});

test("root OperationBilling rejects same-site stale, missing, and duplicate live agreements", async () => {
  const live = agreement("2026-01-01"), stale = agreement("2026-01-01", 99);
  for (const [label, sites, expected] of [
    ["missing", new Map(), /保存時点の現場取極めを確認/u],
    ["duplicate", new Map([["site", { customerId: "customer", agreementsV2: [live, live] }]]), /存在しないか重複/u],
    ["stale", new Map([["site", { customerId: "customer", agreementsV2: [live] }]]), /内容が更新/u],
  ]) {
    const calls = [], previousConfig = FireModel.getConfig();
    FireModel.setAdapter(adapterHarness(sites, calls)); FireModel.setConfig({ prefix: "Companies/company" });
    try {
      const current = label === "stale" ? stale : live;
      const draft = model("site", current, { ...live, cutoffDate: 19 });
      await assert.rejects(draft.beforeUpdate({ transaction: { id: label } }), expected, label);
      assert.ok(calls.some((call) => call.method === "Site.fetchDoc" && call.transaction?.id === label));
    } finally {
      FireModel.setAdapter(null); FireModel.setConfig(previousConfig);
    }
  }
});
