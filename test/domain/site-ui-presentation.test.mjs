import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSiteConstructionPeriod,
  getSiteCustomerLabel,
  getSitePresentationBadges,
  getSiteStatusBadge,
  sortSitesActiveFirst,
} from "../../composables/domain/site/siteUiPresentation.js";

test("Site badges distinguish ACTIVE, TERMINATED, temporary, and unknown states", () => {
  assert.deepEqual(getSiteStatusBadge({ status: "ACTIVE" }), {
    key: "status",
    label: "稼働中",
    color: "success",
  });
  assert.deepEqual(getSiteStatusBadge({ status: "TERMINATED" }), {
    key: "status",
    label: "終了済み",
    color: "warning",
  });
  assert.equal(getSiteStatusBadge({ status: "BROKEN" }).label, "状態不明");
  assert.deepEqual(
    getSitePresentationBadges({ status: "ACTIVE", customerId: null }).map(
      ({ key, label }) => ({ key, label }),
    ),
    [
      { key: "status", label: "稼働中" },
      { key: "temporary", label: "仮登録" },
    ],
  );
  assert.equal(
    getSitePresentationBadges({ status: "ACTIVE", customerId: "customer-a" }).length,
    1,
  );
});

test("Site Customer labels prefer live data and keep explicit temporary fallbacks", () => {
  const site = {
    customerId: "customer-a",
    customerName: "保存名",
    customer: { abbreviation: "埋込略称", name: "埋込名" },
  };
  assert.equal(
    getSiteCustomerLabel(site, { abbreviation: "現在略称", name: "現在名" }),
    "現在略称",
  );
  assert.equal(getSiteCustomerLabel(site), "埋込略称");
  assert.equal(
    getSiteCustomerLabel({ customerId: null, customerName: "仮取引先名" }),
    "仮取引先名",
  );
  assert.equal(getSiteCustomerLabel({ customerId: null }), "取引先未設定");
  assert.equal(getSiteCustomerLabel({ customerId: "missing" }), "取引先情報なし");
});

test("Site construction periods use JST and never render null for a missing endpoint", () => {
  const jstSeptember5 = new Date("2026-09-04T15:00:00.000Z");
  const jstSeptember6 = { toDate: () => new Date("2026-09-05T15:00:00.000Z") };

  assert.equal(
    formatSiteConstructionPeriod({
      constructionPeriodStartAt: jstSeptember5,
      constructionPeriodEndAt: jstSeptember6,
    }),
    "2026/09/05 〜 2026/09/06",
  );
  assert.equal(
    formatSiteConstructionPeriod({ constructionPeriodStartAt: jstSeptember5 }),
    "2026/09/05 〜",
  );
  assert.equal(
    formatSiteConstructionPeriod({ constructionPeriodEndAt: jstSeptember6 }),
    "〜 2026/09/06",
  );
  assert.equal(formatSiteConstructionPeriod({}), "未設定");
  assert.equal(
    formatSiteConstructionPeriod({ constructionPeriodStartAt: "not-a-date" }),
    "未設定",
  );
});

test("Autocomplete ordering moves ACTIVE before TERMINATED without disturbing relevance order", () => {
  const sourceOrder = [
    { docId: "terminated-first", status: "TERMINATED", code: "001" },
    { docId: "active-relevant", status: "ACTIVE", code: "999" },
    { docId: "active-next", status: "ACTIVE", code: "001" },
    { docId: "terminated-next", status: "TERMINATED", code: "999" },
  ];
  const sorted = [...sourceOrder].sort(sortSitesActiveFirst);
  assert.deepEqual(
    sorted.map(({ docId }) => docId),
    ["active-relevant", "active-next", "terminated-first", "terminated-next"],
  );
});
