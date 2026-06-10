import { logger } from "firebase-functions";
import { getBillingKey } from "./utils.js";
import { Billing } from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * OperationResult を Billing ドキュメントから削除して保存します。
 * - Billing ドキュメントが存在しない場合は警告を出力して処理を終了します。
 * - Billing ドキュメントの operationResults 配列から該当する OperationResult を削除します。
 * - 削除した結果、operationResults 配列が空になった場合は Billing ドキュメントを削除します。
 * - そうでなければ更新して保存します。
 * @param {Object} options
 * @param {string} options.companyId - 会社ID
 * @param {Object} options.operationResult - OperationResult ドキュメント
 * @returns {Promise<void>}
 * @throws {Error} companyId が提供されていない場合にエラーをスローします。
 * @throws {Error} operationResult が提供されていない、または operationResult.docId が存在しない場合にエラーをスローします。
 *****************************************************************************/
export async function removeOperationResultFromBilling({
  companyId,
  operationResult,
} = {}) {
  logger.info("'removeOperationResultFromBilling' is called", {
    companyId,
    operationResultId: operationResult ? operationResult.docId : "not provided",
  });

  // prefix を生成（companyId がない場合はエラー）
  if (!companyId) throw new Error("companyId is required");
  const prefix = `Companies/${companyId}/`;

  // operationResult のバリデーション
  if (
    !operationResult ||
    typeof operationResult !== "object" ||
    !operationResult.docId
  ) {
    throw new Error(
      "Invalid operationResult provided to removeOperationResultFromBilling",
    );
  }

  // Billing ドキュメントのキーを生成
  const docId = getBillingKey(operationResult);

  // Billing ドキュメントを取得
  const billingDoc = new Billing();
  const docExists = await billingDoc.fetch({ docId, prefix });

  // Billing ドキュメントが存在しなければ警告を出力して終了
  if (!docExists) {
    logger.warn("Billing not found during deletion", {
      billingDocId: docId,
      operationResultId: operationResult.docId,
    });
    return;
  }

  // Billing ドキュメントの operationResults 配列から該当する OperationResult を削除
  billingDoc.operationResults = billingDoc.operationResults.filter(
    (result) => result.docId !== operationResult.docId,
  );

  // operationResults 配列が空になった場合は Billing ドキュメントを削除
  if (billingDoc.operationResults.length === 0) {
    await billingDoc.delete({ prefix });
    logger.info("Deleted empty Billing", { docId });
  }

  // そうでなければ更新して保存
  else {
    await billingDoc.update({ prefix });
    logger.info("Removed OperationResult from Billing", {
      docId,
      remainingItems: billingDoc.operationResults.length,
    });
  }
}
