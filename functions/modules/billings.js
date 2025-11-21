import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { Customer, Billing } from "@shisyamo4131/air-guard-v2-schemas";

export const onOperationResultChange = onDocumentWritten(
  "Companies/{companyId}/OperationResults/{docId}",
  async (event) => {
    const { companyId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    logger.info("OperationResult changed", {
      companyId,
      docId: after?.docId || before?.docId,
      operation: !before ? "created" : !after ? "deleted" : "updated",
      beforeBillingDate: before?.billingDate,
      afterBillingDate: after?.billingDate,
    });

    try {
      if (!after) return await handleDeleted(companyId, before);
      if (!before) return await handleCreated(companyId, after);
      return await handleUpdated(companyId, before, after);
    } catch (error) {
      logger.error("Failed to process OperationResult change", {
        companyId,
        docId: after?.docId || before?.docId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
);

/**
 * Billing ドキュメントのキー（ドキュメントID）を生成
 * @param {Object} doc - OperationResult ドキュメント
 * @param {string} doc.customerId - 取引先ID
 * @param {string} doc.siteId - 現場ID
 * @param {string} doc.billingDate - 請求締日 (YYYY-MM-DD)
 * @returns {string} Billing ドキュメントID
 */
function getBillingKey({ customerId, siteId, billingDate }) {
  return `${customerId}-${siteId}-${billingDate}`;
}

/**
 * Initialize a Billing document with given parameters.
 * - Calculates payment due date based on customer settings and
 *   set customerId, siteId, billingDateAt, paymentDueDateAt, and status.
 * @param {*} doc - Billing document instance
 * @param {*} options - Initialization options
 * @param {string} options.customerId - Customer ID
 * @param {string} options.siteId - Site ID
 * @param {Date} options.billingDateAt - Billing date as Date object
 * @return {Promise<void>}
 * @throws {Error} If the customer does not exist
 */
async function initBillingDoc(
  doc,
  { companyId, customerId, siteId, billingDateAt }
) {
  const prefix = `Companies/${companyId}/`;
  const customerInstance = new Customer();
  const customerExists = await customerInstance.fetch({
    docId: customerId,
    prefix,
  });
  if (!customerExists) {
    throw new Error(`Customer not found: ${customerId}`);
  }
  const paymentDueDateAt = customerInstance.getPaymentDueDateAt(
    billingDateAt.toDate()
  );

  doc.initialize({
    customerId,
    siteId,
    billingDateAt,
    paymentDueDateAt,
    status: Billing.STATUS.DRAFT,
  });
}

async function handleCreated(companyId, doc) {
  // isInvalid が設定されている場合は処理しない
  if (doc.isInvalid) {
    logger.info("Skipping invalid OperationResult", {
      operationResultId: doc.docId,
      reason: doc.isInvalid,
    });
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
    billingDoc.operationResults.push(doc);
    await billingDoc.update({ prefix });

    logger.info("Added OperationResult to existing Billing", {
      billingDocId: docId,
      billingDate,
      itemsCount: billingDoc.operationResults.length,
    });
  }
}

async function handleUpdated(companyId, before, after) {
  const prefix = `Companies/${companyId}/`;
  const beforeDocId = getBillingKey(before);
  const afterDocId = getBillingKey(after);

  const beforeIsInvalid = !!before.isInvalid;
  const afterIsInvalid = !!after.isInvalid;

  logger.info("Handling OperationResult update", {
    operationResultId: after.docId,
    beforeBillingDocId: beforeDocId,
    beforeBillingDate: before.billingDate,
    beforeIsInvalid,
    afterBillingDocId: afterDocId,
    afterBillingDate: after.billingDate,
    afterIsInvalid,
  });

  // Case 1: 無効 → 無効（処理不要）
  if (beforeIsInvalid && afterIsInvalid) {
    logger.info("Skipping invalid to invalid transition", {
      operationResultId: after.docId,
    });
    return;
  }

  // Case 2: 有効 → 無効（Billing から削除）
  if (!beforeIsInvalid && afterIsInvalid) {
    logger.info("OperationResult became invalid, removing from Billing", {
      operationResultId: after.docId,
      reason: after.isInvalid,
    });
    return await handleDeleted(companyId, before);
  }

  // Case 3: 無効 → 有効（Billing に追加）
  if (beforeIsInvalid && !afterIsInvalid) {
    logger.info("OperationResult became valid, adding to Billing", {
      operationResultId: after.docId,
    });
    return await handleCreated(companyId, after);
  }

  // Case 4: 有効 → 有効（通常の更新処理）
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
      logger.warn("Billing not found during update, creating new one", {
        billingDocId: afterDocId,
        billingDate: after.billingDate,
      });

      await initBillingDoc(billingInstance, {
        companyId,
        customerId: after.customerId,
        siteId: after.siteId,
        billingDateAt: after.billingDateAt,
      });
      billingInstance.operationResults = [after];
      await billingInstance.create({ docId: afterDocId, prefix });
      return;
    }

    // 既存の OperationResult を更新
    const itemIndex = billingInstance.operationResults.findIndex(
      (result) => result.docId === before.docId
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
          (result) => result.docId !== before.docId
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

async function handleDeleted(companyId, doc) {
  const prefix = `Companies/${companyId}/`;
  const { billingDate } = doc;
  const docId = getBillingKey(doc);

  logger.info("Handling OperationResult deletion", {
    operationResultId: doc.docId,
    billingDocId: docId,
    billingDate,
  });

  const billingDoc = new Billing();
  const docExists = await billingDoc.fetch({ docId, prefix });

  if (!docExists) {
    logger.warn("Billing not found during deletion", {
      billingDocId: docId,
      billingDate,
      operationResultId: doc.docId,
    });
    return;
  }

  billingDoc.operationResults = billingDoc.operationResults.filter(
    (result) => result.docId !== doc.docId
  );

  if (billingDoc.operationResults.length === 0) {
    await billingDoc.delete({ prefix });
    logger.info("Deleted empty Billing", {
      docId,
      billingDate,
    });
  } else {
    await billingDoc.update({ prefix });
    logger.info("Removed OperationResult from Billing", {
      docId,
      billingDate,
      remainingItems: billingDoc.operationResults.length,
    });
  }
}
