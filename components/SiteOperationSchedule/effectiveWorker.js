/**
 * 通知と配置明細が共有するプロパティの実効値を解決します。
 * 通知側の `false` も明示値として保持し、通知がない場合だけ配置明細へフォールバックします。
 * @param {Object|null} worker 配置明細
 * @param {Object|null} notification 配置通知
 * @param {string} propertyName 共有プロパティ名
 * @param {*} fallback 両方に値がない場合の既定値
 * @returns {*} 解決済みの値
 */
export function resolveEffectiveWorkerProperty(
  worker,
  notification,
  propertyName,
  fallback,
) {
  return notification?.[propertyName] ?? worker?.[propertyName] ?? fallback;
}

/**
 * 配置人数に算入する実効人数を返します。
 * OJTは0人、従業員は1人、外注は安全な非負数のamountです。
 * 外注のamountがnull、undefined、空文字、空白文字または不正値の場合は1人とし、数値・文字列の0は保持します。
 * @param {Object|null} worker 配置明細
 * @param {Object|null} notification 配置通知
 * @returns {number} 配置人数に算入する人数
 */
export function getEffectiveWorkerPersonnelCount(worker, notification) {
  const isOjt = resolveEffectiveWorkerProperty(
    worker,
    notification,
    "isOjt",
    false,
  );
  if (isOjt) return 0;
  if (worker?.isEmployee) return 1;

  const rawAmount = worker?.amount;
  if (
    rawAmount === null ||
    rawAmount === undefined ||
    (typeof rawAmount === "string" && rawAmount.trim() === "")
  ) {
    return 1;
  }

  const amount = Number(rawAmount);
  return Number.isFinite(amount) && amount >= 0 ? amount : 1;
}

/**
 * 予定内の作業員について、通知優先の実効配置人数を合計します。
 * @param {Object|null} schedule 現場稼働予定
 * @param {Map<string, Object>} notificationById 通知docId索引
 * @returns {number} OJTを除いた実効配置人数
 */
export function getEffectiveAssignedPersonnelCount(
  schedule,
  notificationById = new Map(),
) {
  return (schedule?.workers || []).reduce((total, worker) => {
    const notification = notificationById.get(worker.notificationKey);
    return total + getEffectiveWorkerPersonnelCount(worker, notification);
  }, 0);
}
