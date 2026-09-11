import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_AGREEMENT_FIELDS,
  SITE_OPERATION,
  SiteOperationError,
  cloneSiteValue,
  conflictingSiteFields,
  getSiteOperationErrorMessage,
  siteOperationFields,
  siteSnapshot,
} from "../../composables/domain/site/siteOperations.js";

test("Site operation helper is limited to the exceptional Agreement operation", () => {
  assert.deepEqual(
    siteOperationFields(SITE_OPERATION.UPDATE_AGREEMENTS),
    SITE_AGREEMENT_FIELDS,
  );
  assert.deepEqual(SITE_AGREEMENT_FIELDS, ["agreementsV2"]);
  assert.throws(
    () => siteOperationFields("UPDATE_BASIC"),
    (error) => error instanceof SiteOperationError && error.code === "invalid-operation",
  );
});

test("Site Agreement snapshots are cloned and detect only Agreement conflicts", () => {
  const original = {
    agreementsV2: [{ key: "agreement-a", rates: { weekday: 1000 } }],
    name: "現場A",
  };
  const baseline = siteSnapshot(original, SITE_OPERATION.UPDATE_AGREEMENTS);
  original.agreementsV2[0].rates.weekday = 2000;
  assert.equal(baseline.agreementsV2[0].rates.weekday, 1000);

  const draft = cloneSiteValue(baseline);
  draft.agreementsV2[0].rates.weekday = 1500;
  assert.deepEqual(
    conflictingSiteFields({
      operation: SITE_OPERATION.UPDATE_AGREEMENTS,
      baseline,
      latest: original,
      draft,
    }),
    ["agreementsV2"],
  );
});

test("Site operation errors expose safe messages and unknown errors use the fallback", () => {
  const expected = "入力内容を確認してください。";
  assert.equal(
    getSiteOperationErrorMessage(new SiteOperationError("invalid", expected), "fallback"),
    expected,
  );
  assert.equal(getSiteOperationErrorMessage(new Error("internal"), "fallback"), "fallback");
});
