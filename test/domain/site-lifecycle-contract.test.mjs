import assert from "node:assert/strict";
import test from "node:test";

// SITE-04 public contract seam. These names intentionally describe business
// inputs and JST calendar behavior without coupling tests to Firebase transport.
import {
  SITE_LIFECYCLE_ERROR_CODES,
  SITE_STATUS_SOURCE,
  isAutoTerminationDue,
  parseReactivateSiteInput,
  parseTerminateSiteInput,
} from "../../functions/modules/sites/lifecycle.js";

test("Site lifecycle input accepts only exact manual termination fields", () => {
  assert.deepEqual(
    parseTerminateSiteInput({
      siteId: "site-a",
      reason: "通常利用を終了",
    }),
    { siteId: "site-a", reason: "通常利用を終了" },
  );
  for (const input of [
    { siteId: "site-a", reason: "終了", companyId: "spoofed" },
    { siteId: "site-a", reason: "終了", actorUid: "spoofed" },
    { siteId: "site-a", reason: "終了", source: SITE_STATUS_SOURCE.MANUAL },
    { siteId: "site-a", reason: "終了", unexpected: true },
    { siteId: "", reason: "終了" },
    { siteId: "parent/child", reason: "終了" },
    { siteId: "site-a", reason: "" },
    { siteId: "site-a", reason: "x".repeat(201) },
  ]) {
    assert.throws(
      () => parseTerminateSiteInput(input),
      { name: "SiteLifecycleError", code: SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT },
    );
  }
});

test("Site reactivation requires exact reason and strict ordered construction dates", () => {
  assert.deepEqual(
    parseReactivateSiteInput({
      siteId: "site-a",
      reason: "継続工事の再開",
      constructionPeriodStartDate: "2028-02-29",
      constructionPeriodEndDate: "2028-03-31",
    }),
    {
      siteId: "site-a",
      reason: "継続工事の再開",
      constructionPeriodStartDate: "2028-02-29",
      constructionPeriodEndDate: "2028-03-31",
    },
  );
  for (const input of [
    { siteId: "site-a", reason: "再開", constructionPeriodStartDate: "2027-02-29", constructionPeriodEndDate: "2027-03-01" },
    { siteId: "site-a", reason: "再開", constructionPeriodStartDate: "2028-03-01", constructionPeriodEndDate: "2028-02-29" },
    { siteId: "site-a", reason: "再開", constructionPeriodStartDate: "2028-02-29" },
    { siteId: "site-a", reason: "再開", constructionPeriodEndDate: "2028-03-31" },
    { siteId: "site-a", reason: "再開", constructionPeriodStartDate: "2028/02/29", constructionPeriodEndDate: "2028-03-31" },
  ]) {
    assert.throws(
      () => parseReactivateSiteInput(input),
      { name: "SiteLifecycleError", code: SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT },
    );
  }
});

test("Site automatic termination uses JST calendar end-date plus exactly 90 days", () => {
  const siteEnding = (iso) => ({
    constructionPeriodEndAt: { toDate: () => new Date(iso) },
  });
  const monthEnd = siteEnding("2027-11-30T15:00:00.000Z"); // 2027-12-01 JST
  assert.equal(isAutoTerminationDue(monthEnd, new Date("2028-02-28T14:59:59.999Z")), false);
  assert.equal(isAutoTerminationDue(monthEnd, new Date("2028-02-28T15:00:00.000Z")), true);

  const leapDay = siteEnding("2028-02-28T15:00:00.000Z"); // 2028-02-29 JST
  assert.equal(isAutoTerminationDue(leapDay, new Date("2028-05-28T14:59:59.999Z")), false);
  assert.equal(isAutoTerminationDue(leapDay, new Date("2028-05-28T15:00:00.000Z")), true);

  const nonMidnight = siteEnding("2028-01-31T03:34:56.000Z"); // 2028-01-31 12:34:56 JST
  assert.equal(isAutoTerminationDue(nonMidnight, new Date("2028-04-29T14:59:59.999Z")), false);
  assert.equal(isAutoTerminationDue(nonMidnight, new Date("2028-04-29T15:00:00.000Z")), true);
});
