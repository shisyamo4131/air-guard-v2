import { Billing, Customer } from "@shisyamo4131/air-guard-v2-schemas";
import { getFirestore } from "firebase-admin/firestore";
import { assertLiveSiteReference } from "../sites/liveSiteReference.js";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

export function assertPathSafeIdentifier(value, name) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    value.trim() !== value ||
    value.includes("/") ||
    CONTROL_CHARACTERS.test(value)
  ) {
    throw new Error(`${name} is invalid`);
  }
}

function assertTransaction(transaction) {
  if (!transaction || typeof transaction.get !== "function") {
    throw new Error("transaction is required");
  }
}

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
  assertPathSafeIdentifier(customerId, "customerId");
  assertPathSafeIdentifier(siteId, "siteId");
  assertPathSafeIdentifier(billingDate, "billingDate");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(billingDate)) {
    throw new Error("billingDate is invalid");
  }

  const key = `${customerId}_${siteId}_${billingDate}`;
  if (key.includes("/") || CONTROL_CHARACTERS.test(key)) {
    throw new Error("Billing key is invalid");
  }
  return key;
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
 * @param {Object} options.transaction - Billing保存と共有するFirestore transaction
 * @return {Promise<void>}
 * @throws {Error} transaction、companyId が提供されていない場合にエラーをスローします。
 * @throws {Error} 必要なフィールドが提供されていない場合にエラーをスローします。
 * @throws {Error} 取引先が存在しない場合にエラーをスローします。
 *****************************************************************************/
export async function initBillingDoc(
  doc,
  { companyId, customerId, siteId, billingDateAt, transaction },
) {
  assertTransaction(transaction);
  assertPathSafeIdentifier(companyId, "companyId");
  assertPathSafeIdentifier(customerId, "customerId");
  assertPathSafeIdentifier(siteId, "siteId");

  const prefix = `Companies/${companyId}/`;

  // 必要なフィールドが提供されているかバリデーション
  if (!customerId || !siteId || !billingDateAt) {
    throw new Error("Missing required fields to initialize billing document");
  }

  // Billing保存と同じtransactionで取引先を読み、存在する場合だけ初期化する。
  const customerInstance = new Customer();
  const customerExists = await customerInstance.fetch({
    docId: customerId,
    prefix,
    transaction,
  });
  if (!customerExists) {
    throw new Error(`Customer not found: ${customerId}`);
  }
  await assertLiveSiteReference({
    firestore: getFirestore(),
    transaction,
    companyId,
    siteId,
  });
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
