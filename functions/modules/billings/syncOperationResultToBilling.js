import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { getBillingKey, initBillingDoc } from "./utils.js";
import { Billing } from "@shisyamo4131/air-guard-v2-schemas";
import { addOperationResultToBilling } from "./addOperationResultToBilling.js";
import { removeOperationResultFromBilling } from "./removeOperationResultFromBilling.js";

/*****************************************************************************
 * OperationResult の変更を Billing ドキュメントに反映します。
 * - `isBillable` の状態遷移に応じて処理内容が変わります。
 *   - 無効 → 無効：処理不要（スキップされます）
 *   - 有効 → 無効：`removeOperationResultFromBilling` を呼び出し、Billing ドキュメントから該当の OperationResult を削除します。
 *   - 無効 → 有効：`addOperationResultToBilling` を呼び出し、Billing ドキュメントに該当の OperationResult を追加します。
 *   - 有効 → 有効：Billing ドキュメントの docId（${customerId}-${siteId}-${billingDate}）が変更されている可能性があります。
 *                 [同一の場合]
 *                 billingDate の変更がない場合は同一の Billing ドキュメント内での更新となるため、トランザクションは使用せずに OperationResult を更新します。
 *                 [異なる場合]
 *                 billingDate の変更により docId が変わる場合は、トランザクションを使用して以下の処理を行います。
 *                 1. 変更前の Billing ドキュメントから該当の OperationResult を削除します。（`removeOperationResultFromBilling` を使用）
 *                 2. 変更後の Billing ドキュメントに該当の OperationResult を追加します。（`addOperationResultToBilling` を使用）
 * [データ不整合対応]
 * - 有効 → 有効 のケースで、既存の Billing ドキュメントが存在しなかった場合は `addOperationResultToBilling` を呼び出して新規作成します。
 * @param {Object} options
 * @param {string} options.companyId
 * @param {Object} options.before - 変更前の OperationResult ドキュメント
 * @param {Object} options.after - 変更後の OperationResult ドキュメント
 * @returns {Promise<void>}
 * @throws {Error} 取引先が存在しない場合
 *****************************************************************************/
export async function syncOperationResultToBilling({
  companyId,
  before,
  after,
} = {}) {
  logger.info("'syncOperationResultToBilling' is called", {
    companyId,
    operationResultId: {
      before: before ? before.docId : "not provided",
      after: after ? after.docId : "not provided",
    },
  });

  // prefix を生成（companyId がない場合はエラー）
  if (!companyId) throw new Error("companyId is required");
  const prefix = `Companies/${companyId}/`;

  const beforeDocId = getBillingKey(before);
  const afterDocId = getBillingKey(after);

  const beforeIsBillable = before.isBillable;
  const afterIsBillable = after.isBillable;

  logger.info("Handling OperationResult update", {
    operationResultId: after.docId,
    beforeBillingDocId: beforeDocId,
    beforeBillingDate: before.billingDate,
    beforeIsBillable,
    afterBillingDocId: afterDocId,
    afterBillingDate: after.billingDate,
    afterIsBillable,
  });

  // Case 1: 無効 → 無効（処理不要）
  if (!beforeIsBillable && !afterIsBillable) {
    logger.info("Skipping update because OperationResult is not billable", {
      operationResultId: after.docId,
    });
    return;
  }

  // Case 2: 有効 → 無効（Billing から削除）
  if (beforeIsBillable && !afterIsBillable) {
    logger.info("OperationResult became non-billable, removing from Billing", {
      operationResultId: after.docId,
      reason: "OperationResult became non-billable",
    });
    return await removeOperationResultFromBilling({
      companyId,
      operationResult: before,
    });
  }

  // Case 3: 無効 → 有効（Billing に追加）
  if (!beforeIsBillable && afterIsBillable) {
    logger.info("OperationResult became billable, adding to Billing", {
      operationResultId: after.docId,
    });
    return await addOperationResultToBilling({ companyId, doc: after });
  }

  // Case 4: 有効 → 有効（通常の更新処理）
  // `OperationBilling` ドキュメントの `docId` は `customerId_siteId_billingDate` 形式であるため、
  // `billingDate` の変更に伴い `docId` が変わる可能性がある。
  const isSameBillingDoc = beforeDocId === afterDocId;

  // 同じ Billing 内での更新（トランザクション不要）
  if (isSameBillingDoc) {
    const billingInstance = new Billing();
    const docExists = await billingInstance.fetch({
      docId: afterDocId,
      prefix,
    });

    if (!docExists) {
      // Billing が存在しない場合は新規作成（通常発生しないが念のため）
      logger.warn("Billing not found during update, recreating billing", {
        billingDocId: afterDocId,
        billingDate: after.billingDate,
      });
      await addOperationResultToBilling({ companyId, doc: after });
      return;
    }

    // 既存の OperationResult を更新
    const itemIndex = billingInstance.operationResults.findIndex(
      (result) => result.docId === before.docId,
    );

    if (itemIndex >= 0) {
      billingInstance.operationResults[itemIndex] = after;
    } else {
      // 見つからない場合は追加（データ不整合の修復）
      logger.warn("OperationResult not found in Billing, adding it", {
        billingDocId: afterDocId,
        billingDate: after.billingDate,
        operationResultId: after.docId,
      });
      billingInstance.operationResults.push(after);
    }

    await billingInstance.update({ prefix });

    logger.info("Updated OperationResult in Billing", {
      billingDocId: afterDocId,
      billingDate: after.billingDate,
      itemsCount: billingInstance.operationResults.length,
    });
    return;
  }

  // 異なる Billing への移動（トランザクション使用）
  const firestore = getFirestore();

  await firestore.runTransaction(async (transaction) => {
    const beforeBillingDoc = new Billing();
    const beforeDocExists = await beforeBillingDoc.fetch({
      docId: beforeDocId,
      prefix,
      transaction,
    });

    const afterBillingDoc = new Billing();
    const afterDocExists = await afterBillingDoc.fetch({
      docId: afterDocId,
      prefix,
      transaction,
    });

    // 移動元の Billing から削除
    if (beforeDocExists) {
      beforeBillingDoc.operationResults =
        beforeBillingDoc.operationResults.filter(
          (result) => result.docId !== before.docId,
        );

      if (beforeBillingDoc.operationResults.length === 0) {
        await beforeBillingDoc.delete({ prefix, transaction });
        logger.info("Deleted empty Billing", {
          docId: beforeDocId,
          billingDate: before.billingDate,
        });
      } else {
        await beforeBillingDoc.update({ prefix, transaction });
        logger.info("Removed OperationResult from Billing", {
          docId: beforeDocId,
          billingDate: before.billingDate,
          remainingItems: beforeBillingDoc.operationResults.length,
        });
      }
    }

    // 移動先の Billing に追加
    // `addOperationResultToBilling` と同様の処理だが、トランザクション内なので別途記述。
    // 将来的に `addOperationResultToBilling` にトランザクション対応させるのもあり。
    if (!afterDocExists) {
      await initBillingDoc(afterBillingDoc, {
        companyId,
        customerId: after.customerId,
        siteId: after.siteId,
        billingDateAt: after.billingDateAt,
      });
      afterBillingDoc.operationResults = [after];
      await afterBillingDoc.create({ docId: afterDocId, prefix, transaction });

      logger.info("Created new Billing for moved OperationResult", {
        docId: afterDocId,
        billingDate: after.billingDate,
      });
    } else {
      afterBillingDoc.operationResults =
        afterBillingDoc.operationResults.filter(
          (result) => result.docId !== after.docId,
        );
      afterBillingDoc.operationResults.push(after);
      await afterBillingDoc.update({ prefix, transaction });

      logger.info("Added OperationResult to existing Billing", {
        docId: afterDocId,
        billingDate: after.billingDate,
        itemsCount: afterBillingDoc.operationResults.length,
      });
    }
  });
}
