const JST_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDate(value) {
  const date = value?.toDate?.() ?? value;
  if (date == null) return null;
  const result = date instanceof Date ? date : new Date(date);
  return Number.isNaN(result.getTime()) ? null : result;
}

function formatJst(value) {
  const date = toDate(value);
  return date ? JST_FORMATTER.format(date) : null;
}

export function getSiteStatusBadge(site) {
  if (site?.status === "TERMINATED") {
    return Object.freeze({ key: "status", label: "終了済み", color: "warning" });
  }
  if (site?.status === "ACTIVE") {
    return Object.freeze({ key: "status", label: "稼働中", color: "success" });
  }
  return Object.freeze({ key: "status", label: "状態不明", color: "grey" });
}

export function getSitePresentationBadges(site) {
  const badges = [getSiteStatusBadge(site)];
  if (site?.isTemporary === true || !site?.customerId) {
    badges.push(Object.freeze({ key: "temporary", label: "仮登録", color: "info" }));
  }
  return Object.freeze(badges);
}

export function getSiteCustomerLabel(site, liveCustomer = null) {
  const embedded = site?.customer;
  if (!site?.customerId) {
    return site?.customerName || embedded?.abbreviation || embedded?.name || "取引先未設定";
  }
  return liveCustomer?.abbreviation || liveCustomer?.name ||
    embedded?.abbreviation || embedded?.name || site?.customerName || "取引先情報なし";
}

export function formatSiteConstructionPeriod(site) {
  const start = formatJst(site?.constructionPeriodStartAt);
  const end = formatJst(site?.constructionPeriodEndAt);
  if (start && end) return `${start} 〜 ${end}`;
  if (start) return `${start} 〜`;
  if (end) return `〜 ${end}`;
  return "未設定";
}

export function sortSitesActiveFirst(left, right) {
  const rank = (site) => site?.status === "ACTIVE" ? 0 : site?.status === "TERMINATED" ? 1 : 2;
  const statusDifference = rank(left) - rank(right);
  return statusDifference || 0;
}
