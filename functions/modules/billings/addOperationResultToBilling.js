import { logger } from "firebase-functions";
import { getBillingKey, initBillingDoc } from "./utils.js";
import { Billing } from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * OperationResult を Billing ドキュメントに追加します。
 * - OperationResult ドキュメントの `isBillable` が false の場合は処理がスキップされます。
 * - Billing ドキュメントが存在しない場合は新規に作成されます。
 * - Billing ドキュメントが存在する場合は、OperationResult を追加して保存します。
 * [データ不整合対応]
 * - 既存の Billing ドキュメントが既に同一の OperationResult を有している場合はこれを置換します。
 *   通常は発生しないはずですが、何らかの理由で同一の OperationResult が複数回追加されてしまうケースに対応するための処理です。
 * @param {Object} options
 * @param {string} options.companyId
 * @param {Object} options.doc - OperationResult ドキュメント
 * @returns {Promise<void>}
 * @throws {Error} 取引先が存在しない場合
 *****************************************************************************/
export async function addOperationResultToBilling({ companyId, doc } = {}) {
  logger.info("'addOperationResultToBilling' is called", {
    companyId,
    operationResultId: doc ? doc.docId : "not provided",
  });

  // `isBillable` が false の場合は処理しない
  // 取極めがない場合も実績としては確定できるため、稼働実績ドキュメントは作成される。
  // ただし、isBillable が false（取極めなし かつ useAdjusted = false）の場合は請求データを確定できないため、稼働請求ドキュメントは作成しない。
  if (!doc.isBillable) {
    logger.info(
      "Skipping creation of OperationBilling due to isBillable is false",
      {
        operationResultId: doc.docId,
        reason: "isBillable is false for this OperationResult",
      },
    );
    return;
  }

  const prefix = `Companies/${companyId}/`;
  const { customerId, siteId, billingDate, billingDateAt } = doc;
  const docId = getBillingKey(doc);

  logger.info("Handling OperationResult creation", {
    operationResultId: doc.docId,
    billingDocId: docId,
    billingDate,
  });

  const billingDoc = new Billing();
  const docExists = await billingDoc.fetch({ docId, prefix });

  if (!docExists) {
    await initBillingDoc(billingDoc, {
      companyId,
      customerId,
      siteId,
      billingDateAt,
    });
    billingDoc.operationResults = [doc];
    await billingDoc.create({ docId, prefix });

    logger.info("Created new Billing", {
      billingDocId: docId,
      billingDate,
      itemsCount: 1,
    });
  } else {
    // データ不整合対応：既に同一の OperationResult が存在する場合はこれを置換
    billingDoc.operationResults = billingDoc.operationResults.filter(
      (result) => result.docId !== doc.docId,
    );
    billingDoc.operationResults.push(doc);
    await billingDoc.update({ prefix });

    logger.info("Added OperationResult to existing Billing", {
      billingDocId: docId,
      billingDate,
      itemsCount: billingDoc.operationResults.length,
    });
  }
}
