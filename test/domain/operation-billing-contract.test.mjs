import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AgreementV2, OperationBilling as BaseOperationBilling } from "@shisyamo4131/air-guard-v2-schemas";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
async function loadBillingClass() {
  const code = (await source("schemas/OperationBilling.js")).replace(/import[\s\S]*?;\s*/gu, "").replace("export default class", "class");
  BaseOperationBilling.prototype.beforeUpdate = async function beforeUpdateHarness() {};
  const Site = class Site {
    static documents = new Map();
    async fetchDoc({ docId }) { return this.constructor.documents.get(docId) || null; }
  };
  const OperationBilling = new Function("BaseOperationBilling", "Site", `${code}; return OperationBilling;`)(BaseOperationBilling, Site);
  return { OperationBilling, Site };
}
function agreement(overrides = {}) {
  return new AgreementV2({
    dateAt: new Date("2020-01-01"), shiftType: "DAY", cutoffDate: 20, startTime: "08:00", endTime: "17:00", billingUnitType: "PER_DAY",
    rates: { WEEKDAY: { unitPriceBase: 100, unitPriceQualified: 120, overtimeUnitPriceBase: 10, overtimeUnitPriceQualified: 12 } }, ...overrides,
  }).toObject();
}
test("OperationBilling beforeUpdate canonicalizes one live Site agreement and permits null agreement", async () => {
  const { OperationBilling, Site } = await loadBillingClass();
  const live = agreement();
  Site.documents.set("site", { agreementsV2: [live] });
  const model = new OperationBilling({ docId: "billing", uid: "actor", siteId: "site", dateAt: new Date("2026-09-01"), shiftType: "DAY", agreement: { ...live } });
  model._beforeData = { siteId: "other", agreement: null };
  await assert.doesNotReject(() => model.beforeUpdate());
  assert.deepEqual(model.agreement.toObject(), live);
  model._beforeData = { siteId: "site", agreement: live };
  model.agreement = null;
  await assert.doesNotReject(() => model.beforeUpdate());
  assert.equal(model.agreement, null);
});

async function sourceFile() { return await source("schemas/OperationBilling.js"); }

test("OperationBilling source contract rejects missing, duplicate, and stale agreements while preserving superclass validation", async () => {
  const code = await sourceFile();
  assert.match(code, /new Site\(\)\.fetchDoc\(\{ docId: this\.siteId, transaction: args\.transaction \}\)/u);
  assert.match(code, /!site \|\| !Array\.isArray\(site\.agreementsV2\)/u);
  assert.match(code, /matches\.length !== 1/u);
  assert.match(code, /!sameValue\(this\.agreement, matches\[0\]\)/u);
  assert.match(code, /await super\.beforeUpdate\(args\)/u);
  const { OperationBilling, Site } = await loadBillingClass();
  const live = agreement();
  Site.documents.set("site", { agreementsV2: [live] });
  for (const scenario of [
    { label: "missing", docs: new Map(), expected: /保存時点の現場取極めを確認/u },
    { label: "duplicate", docs: new Map([["site", { agreementsV2: [live, live] }]]), expected: /存在しないか重複/u },
    { label: "stale", docs: new Map([["site", { agreementsV2: [{ ...live, cutoffDate: 21 }] }]]), expected: /内容が更新/u },
  ]) {
    Site.documents = scenario.docs;
    const model = new OperationBilling({ docId: scenario.label, uid: "actor", siteId: "site", dateAt: new Date("2026-09-01"), shiftType: "DAY", agreement: live });
    model._beforeData = { siteId: "other", agreement: null };
    await assert.rejects(model.beforeUpdate(), scenario.expected, scenario.label);
  }
  Site.documents = new Map([["site", { agreementsV2: [live] }]]);
  const valid = new OperationBilling({ docId: "valid", uid: "actor", siteId: "site", dateAt: new Date("2026-09-01"), shiftType: "DAY", agreement: live });
  valid._beforeData = { siteId: "other", agreement: null };
  await assert.doesNotReject(() => valid.beforeUpdate());
  assert.throws(() => new OperationBilling({ docId: "billing", uid: "actor", siteId: "site", dateAt: new Date("2026-09-01"), billingDateAt: "invalid" }), /TypeError|Invalid|date/i);
});
