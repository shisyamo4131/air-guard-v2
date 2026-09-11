import assert from "node:assert/strict";
import test from "node:test";

import {
  SITE_AGREEMENT_DAY_TYPES,
  SITE_AGREEMENT_FIELDS,
  SITE_AGREEMENT_RATE_FIELDS,
  SiteAgreementContractError,
  normalizeSiteAgreements,
  siteAgreementWorkIntervalMinutes,
  siteAgreementsHaveZeroPrice,
} from "../../composables/domain/site/siteAgreementContract.js";

function rates(value = 1_000) {
  return Object.fromEntries(SITE_AGREEMENT_DAY_TYPES.map((day) => [
    day,
    Object.fromEntries(SITE_AGREEMENT_RATE_FIELDS.map((field) => [field, value])),
  ]));
}

function agreement(overrides = {}) {
  return {
    date: "2026-09-05",
    shiftType: "DAY",
    startTime: "08:00",
    isStartNextDay: false,
    endTime: "17:00",
    breakMinutes: 60,
    regulationWorkMinutes: 480,
    rates: rates(),
    billingUnitType: "PER_DAY",
    includeBreakInBilling: false,
    cutoffDate: 0,
    ...overrides,
  };
}

test("Site Agreement validation preserves all fields and accepts bounded integer prices including zero", () => {
  const zero = agreement({ rates: rates(0) });
  const maximum = agreement({ rates: rates(10_000_000) });
  assert.equal(siteAgreementsHaveZeroPrice([zero]), true);
  assert.equal(siteAgreementsHaveZeroPrice([agreement()]), false);
  for (const candidate of [zero, maximum]) {
    const [normalized] = normalizeSiteAgreements([candidate]);
    assert.deepEqual(Object.keys(normalized), SITE_AGREEMENT_FIELDS);
    for (const day of SITE_AGREEMENT_DAY_TYPES) {
      assert.deepEqual(Object.keys(normalized.rates[day]), SITE_AGREEMENT_RATE_FIELDS);
    }
  }

  for (const invalid of [-1, 0.5, 10_000_001, "1000", Number.NaN]) {
    for (const day of SITE_AGREEMENT_DAY_TYPES) {
      for (const field of SITE_AGREEMENT_RATE_FIELDS) {
        const invalidRates = rates();
        invalidRates[day][field] = invalid;
        assert.throws(
          () => normalizeSiteAgreements([agreement({ rates: invalidRates })]),
          SiteAgreementContractError,
          `${day}.${field}=${String(invalid)}`,
        );
      }
    }
  }
});

test("Site Agreement time, cutoff, and duplicate validation covers overnight and equal-time 24h", () => {
  assert.equal(siteAgreementWorkIntervalMinutes("08:00", "17:00"), 540);
  assert.equal(siteAgreementWorkIntervalMinutes("22:00", "05:00"), 420);
  assert.equal(siteAgreementWorkIntervalMinutes("08:00", "08:00"), 1440);
  for (const cutoffDate of [0, 5, 10, 15, 20, 25]) {
    assert.doesNotThrow(() => normalizeSiteAgreements([agreement({ cutoffDate })]));
  }
  for (const [field, accepted] of [["breakMinutes", [0, 540]], ["regulationWorkMinutes", [0, 1440]]]) {
    for (const value of accepted) {
      assert.doesNotThrow(() => normalizeSiteAgreements([agreement({ [field]: value })]));
    }
    for (const value of [-1, 0.5, 1441, "1"]) {
      assert.throws(
        () => normalizeSiteAgreements([agreement({ [field]: value })]),
        SiteAgreementContractError,
      );
    }
  }
  assert.doesNotThrow(() => normalizeSiteAgreements([
    agreement({ startTime: "22:00", endTime: "05:00", breakMinutes: 420 }),
  ]));
  assert.doesNotThrow(() => normalizeSiteAgreements([
    agreement({ startTime: "08:00", endTime: "08:00", breakMinutes: 1440 }),
  ]));
  assert.throws(
    () => normalizeSiteAgreements([agreement({ breakMinutes: 541 })]),
    SiteAgreementContractError,
  );
  for (const cutoffDate of [1, 30, "0", 0.5]) {
    assert.throws(
      () => normalizeSiteAgreements([agreement({ cutoffDate })]),
      SiteAgreementContractError,
    );
  }
  assert.throws(
    () => normalizeSiteAgreements([agreement(), agreement()]),
    SiteAgreementContractError,
  );
});
