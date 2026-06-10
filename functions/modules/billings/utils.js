import { Billing, Customer } from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * OperationResult ドキュメントから Billing ドキュメントのキー（ドキュメントID）を生成します。
 * @param {Object} doc - OperationResult ドキュメント
 * @param {string} doc.customerId - 取引先ID
 * @param {string} doc.siteId - 現場ID
 * @param {string} doc.billingDate - 請求締日 (YYYY-MM-DD)
 * @returns {string} Billing ドキュメントID
 * @throws {Error} customerId、siteId、billingDate のいずれかが提供されていない場合にエラーをスローします。
 *****************************************************************************/
export function getBillingKey({ customerId, siteId, billingDate }) {
  if (!customerId || !siteId || !billingDate) {
    throw new Error("Missing required fields to generate billing key");
  }
  return `${customerId}_${siteId}_${billingDate}`;
}

/*****************************************************************************
 * Billing ドキュメントを初期化します。
 * - 取引先の設定に基づいて支払期日を計算し、
 *   customerId、siteId、billingDateAt、paymentDueDateAt、status を設定します。
 * @param {*} doc - Billing ドキュメントのインスタンス
 * @param {*} options - 初期化オプション
 * @param {string} options.customerId - 取引先ID
 * @param {string} options.siteId - 現場ID
 * @param {Date} options.billingDateAt - 請求日 (Date オブジェクト)
 * @return {Promise<void>}
 * @throws {Error} companyId が提供されていない場合にエラーをスローします。
 * @throws {Error} 必要なフィールドが提供されていない場合にエラーをスローします。
 * @throws {Error} 取引先が存在しない場合にエラーをスローします。
 *****************************************************************************/
export async function initBillingDoc(
  doc,
  { companyId, customerId, siteId, billingDateAt },
) {
  // prefix を生成（companyId がない場合はエラー）
  if (!companyId) throw new Error("companyId is required");
  const prefix = `Companies/${companyId}/`;

  // 必要なフィールドが提供されているかバリデーション
  if (!customerId || !siteId || !billingDateAt) {
    throw new Error("Missing required fields to initialize billing document");
  }

  // 取引先情報を取得して支払期日を計算する
  // 取引先が存在しない場合はエラーをスロー
  const customerInstance = new Customer();
  const customerExists = await customerInstance.fetch({
    docId: customerId,
    prefix,
  });
  if (!customerExists) {
    throw new Error(`Customer not found: ${customerId}`);
  }
  const paymentDueDateAt = customerInstance.getPaymentDueDateAt(
    billingDateAt.toDate(),
  );

  // Billing ドキュメントを初期化
  doc.initialize({
    customerId,
    siteId,
    billingDateAt,
    paymentDueDateAt,
    status: Billing.STATUS.DRAFT,
  });
}
