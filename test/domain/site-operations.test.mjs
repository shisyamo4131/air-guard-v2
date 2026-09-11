import assert from "node:assert/strict";
import test from "node:test";

import {
  SiteOperationError,
  cloneSiteValue,
  getSiteOperationErrorMessage,
} from "../../composables/domain/site/siteOperations.js";

test("Site value cloning keeps an Agreement draft independent from its live Site", () => {
  const original = {
    agreementsV2: [{ key: "agreement-a", rates: { weekday: 1000 } }],
    name: "現場A",
  };
  const draft = cloneSiteValue(original);
  draft.agreementsV2[0].rates.weekday = 1500;
  assert.equal(original.agreementsV2[0].rates.weekday, 1000);
});

test("Site operation errors expose safe messages and unknown errors use the fallback", () => {
  const expected = "現場を変更できません。";
  assert.equal(
    getSiteOperationErrorMessage(new SiteOperationError("invalid", expected), "fallback"),
    expected,
  );
  assert.equal(getSiteOperationErrorMessage(new Error("internal"), "fallback"), "fallback");
});
