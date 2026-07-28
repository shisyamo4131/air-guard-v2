/**
 * サブスクリプション情報から顧客タイプを判定します。
 *
 * @param {*} subscription
 * @param {number} [now=Date.now()] - 判定基準時刻（ミリ秒）
 * @returns {"free" | "paid" | "expired"}
 */
export function getCustomerType(subscription, now = Date.now()) {
  if (!subscription?.id) {
    return "free";
  }

  if (["canceled", "past_due", "unpaid"].includes(subscription.status)) {
    return "expired";
  }

  if (
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.toMillis() < now
  ) {
    return "expired";
  }

  if (["active", "trialing"].includes(subscription.status)) {
    return "paid";
  }

  return "free";
}
