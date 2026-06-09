import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  Customer,
  Billing,
  DailyAttendance,
  OperationResult,
} from "../schemas/index.js";

/*****************************************************************************
 * OperationResult ドキュメントの作成・更新・削除トリガー
 *****************************************************************************/
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
      // OperationResult ドキュメントが削除された時の処理
      if (!after) {
        // 1. Billing ドキュメントへの反映
        await removeOperationResultFromBilling(companyId, before);
        // 2. Attendance ドキュメントへの反映
        await getFirestore().runTransaction(async (transaction) => {
          await syncOperationResultToDailyAttendances({
            companyId,
            beforeData: before,
            afterData: null,
            transaction,
          });
        });
      }
      // OperationResult ドキュメントが作成された時の処理
      else if (!before) {
        // 1. Billing ドキュメントへの反映
        await addOperationResultToBilling(companyId, after);
        // 2. Attendance ドキュメントへの反映
        await getFirestore().runTransaction(async (transaction) => {
          await syncOperationResultToDailyAttendances({
            companyId,
            beforeData: null,
            afterData: after,
            transaction,
          });
        });
      }
      // OperationResult ドキュメントが更新された時の処理
      else {
        // 1. Billing ドキュメントへの反映
        await syncOperationResultToBilling(companyId, before, after);
        // 2. Attendance ドキュメントへの反映
        await getFirestore().runTransaction(async (transaction) => {
          await syncOperationResultToDailyAttendances({
            companyId,
            beforeData: before,
            afterData: after,
            transaction,
          });
        });
      }
    } catch (error) {
      logger.error("Failed to process OperationResult change", {
        companyId,
        docId: after?.docId || before?.docId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
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
  return `${customerId}_${siteId}_${billingDate}`;
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
  { companyId, customerId, siteId, billingDateAt },
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
    billingDateAt.toDate(),
  );

  doc.initialize({
    customerId,
    siteId,
    billingDateAt,
    paymentDueDateAt,
    status: Billing.STATUS.DRAFT,
  });
}

/*****************************************************************************
 * OperationResult を Billing ドキュメントに追加します。
 * - OperationResult ドキュメントの `isBillable` が false の場合は処理がスキップされます。
 * - Billing ドキュメントが存在しない場合は新規に作成されます。
 * - Billing ドキュメントが存在する場合は、OperationResult を追加して保存します。
 * [データ不整合対応]
 * - 既存の Billing ドキュメントが既に同一の OperationResult を有している場合はこれを置換します。
 *   通常は発生しないはずですが、何らかの理由で同一の OperationResult が複数回追加されてしまうケースに対応するための処理です。
 * @param {string} companyId
 * @param {Object} operationResultDoc - OperationResult ドキュメント
 * @returns {Promise<void>}
 * @throws {Error} 取引先が存在しない場合
 *****************************************************************************/
async function addOperationResultToBilling(companyId, doc) {
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
 * @param {string} companyId
 * @param {Object} before - 変更前の OperationResult ドキュメント
 * @param {Object} after - 変更後の OperationResult ドキュメント
 * @returns {Promise<void>}
 * @throws {Error} 取引先が存在しない場合
 *****************************************************************************/
async function syncOperationResultToBilling(companyId, before, after) {
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
    return await removeOperationResultFromBilling(companyId, before);
  }

  // Case 3: 無効 → 有効（Billing に追加）
  if (!beforeIsBillable && afterIsBillable) {
    logger.info("OperationResult became billable, adding to Billing", {
      operationResultId: after.docId,
    });
    return await addOperationResultToBilling(companyId, after);
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
      await addOperationResultToBilling(companyId, after);
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

/*****************************************************************************
 * OperationResult を Billing ドキュメントから削除します。
 * - Billing ドキュメントが存在しない場合は警告を出力して処理を終了します。
 * @param {string} companyId
 * @param {Object} operationResultDoc - OperationResult ドキュメント
 * @returns {Promise<void>}
 *****************************************************************************/
async function removeOperationResultFromBilling(companyId, doc) {
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
    (result) => result.docId !== doc.docId,
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

/*****************************************************************************
 * 引数で指定された OperationResult に紐づく、DailyAttendance ドキュメントを取得し、
 * DailyAttendance インスタンスを instance プロパティ、ドキュメントの存在有無を
 * exists プロパティに格納したオブジェクトの配列を返します。
 * @param {Object} options
 * @param {string} options.companyId
 * @param {OperationResult} options.operationResult
 * @param {Object|null} options.transaction
 * @returns {Promise<Array<{
 *  instance: DailyAttendance,
 *  exists: boolean,
 * }>>}
 *****************************************************************************/
async function fetchDailyAttendances({
  companyId,
  operationResult,
  transaction = null,
} = {}) {
  // prefix を生成（companyId がない場合はエラー）
  if (!companyId) {
    throw new Error("companyId is required");
  }
  const prefix = `Companies/${companyId}/`;

  // operationResult が OperationResult インスタンスでない場合はエラー
  if (!operationResult || !(operationResult instanceof OperationResult)) {
    throw new Error("Invalid operationResult provided");
  }

  // OperationResult.employees を取得
  const { employees = [] } = operationResult;

  // OperationResult.employees の分、DailyAttendance ドキュメントを取得してインスタンス化し、配列に格納して返す
  const attendances = [];
  for (const employee of employees) {
    const attendanceInstance = new DailyAttendance();
    const attendanceDocId = `${employee.id}_${employee.attendanceDate}`; // 勤怠なので `attendanceDate` を使用

    // transaction を与えて `fetch` を呼び出す。
    // transaction === null の場合、`fetch` はトランザクション処理を行わないので
    // 当該メソッドで transaction の有無による処理分岐は不要。
    const attendanceExists = await attendanceInstance.fetch({
      docId: attendanceDocId,
      prefix,
      transaction,
    });
    if (!attendanceExists) {
      attendanceInstance.initialize({
        employeeId: employee.id,
        dateAt: employee.attendanceDateAt, // 勤怠なので `attendanceDateAt` を使用
        operationResults: [],
      });
    }
    attendances.push({
      instance: attendanceInstance,
      exists: attendanceExists,
    });
  }
  return attendances;
}

/*****************************************************************************
 * attendance 配列内の DailyAttendance インスタンスに対して、OperationResult ドキュメントを追加します。
 * - DailyAttendance インスタンスが保有する `employeeId` と `date` が、OperationResult.employees 内の
 *   従業員IDと勤怠日と一致する場合にのみ、当該 OperationResult インスタンスが operationResults 配列に追加されます。
 * @param {Object} options
 * @param {Array<{ instance: DailyAttendance, exists: boolean }>} options.attendances
 * @param {OperationResult} options.operationResult
 * @returns {void}
 * @throws {Error} operationResult が OperationResult インスタンスでない場合
 *****************************************************************************/
function addOperationResultToDailyAttendances({
  attendances = [],
  operationResult,
} = {}) {
  // operationResult が OperationResult インスタンスでない場合はエラー
  if (!operationResult || !(operationResult instanceof OperationResult)) {
    throw new Error("Invalid operationResult provided");
  }

  // OperationResult.employees を取得
  const employees = operationResult.employees ?? [];

  // DailyAttendance インスタンスの `employeeId` と `date` を受け取り、
  // OperationResult.employees 内に該当する従業員IDと勤怠日が存在するかを判定する関数
  const hasEmployeeAttendance = ({ employeeId, date }) => {
    return employees.some((employee) => {
      return employee.id === employeeId && employee.attendanceDate === date;
    });
  };

  // attendance 配列内の DailyAttendance インスタンスについて、OperationResult.employees 内に
  // 該当する従業員IDと勤怠日が存在する場合は、当該 OperationResult インスタンスを operationResults 配列に追加する。
  for (const { instance } of attendances) {
    if (hasEmployeeAttendance(instance)) {
      instance.operationResults = (instance.operationResults ?? []).filter(
        (result) => result.docId !== operationResult.docId,
      );
      instance.operationResults.push(operationResult);
    }
  }
}

/*****************************************************************************
 * attendance 配列内の DailyAttendance インスタンスから、OperationResult ドキュメントを取り除きます。
 * - OperationResult インスタンスの `docId` と一致するものを DailyAttendance.operationResults 配列から削除します。
 * @param {Object} options
 * @param {Array<{ instance: DailyAttendance, exists: boolean }>} options.attendances
 * @param {OperationResult} options.operationResult
 * @returns {void}
 * @throws {Error} operationResult が OperationResult インスタンスでない場合
 *****************************************************************************/
function removeOperationResultFromDailyAttendances({
  attendances = [],
  operationResult,
} = {}) {
  if (!operationResult || !(operationResult instanceof OperationResult)) {
    throw new Error("Invalid operationResult provided");
  }
  const operationResultDocId = operationResult.docId;
  for (const { instance } of attendances) {
    instance.operationResults = (instance.operationResults ?? []).filter(
      (result) => result.docId !== operationResultDocId,
    );
  }
}

/*****************************************************************************
 * attendance 配列内の DailyAttendance インスタンスを保存します。
 * - `exists` フラグに応じて、インスタンスの `create` または `update` メソッドを呼び出します。
 * - トランザクションが提供されている場合は、各 `create` / `update` 呼び出しにトランザクションを渡します。
 * @param {Object} options
 * @param {string} options.companyId
 * @param {Array<{ instance: DailyAttendance, exists: boolean }>} options.attendances
 * @param {Object} options.transaction
 * @returns {Promise<void>}
 *****************************************************************************/
async function saveDailyAttendances({
  companyId,
  attendances = [],
  transaction = null,
} = {}) {
  // prefix を生成（companyId がない場合はエラー）
  if (!companyId) {
    throw new Error("companyId is required");
  }
  const prefix = `Companies/${companyId}/`;

  for (const { instance, exists } of attendances) {
    // DailyAttendance ドキュメントが存在している場合
    // - `isAttended` が true の場合はドキュメントを更新。
    // - `isAttended` が false の場合はドキュメントを削除。
    if (exists) {
      instance.isAttended
        ? await instance.update({ prefix, transaction })
        : await instance.delete({ prefix, transaction });
      continue;
    }

    // DailyAttendance ドキュメントが存在しない場合
    // - `isAttended` が true の場合のみドキュメントを作成。
    if (instance.isAttended) {
      await instance.create({ prefix, transaction });
    }
  }
}

async function syncOperationResultToDailyAttendances({
  companyId,
  beforeData,
  afterData,
  transaction = null,
} = {}) {
  const isCreate = !beforeData && afterData;
  const isUpdate = beforeData && afterData;
  const isDelete = beforeData && !afterData;

  // OperationResult 作成時の処理
  if (isCreate) {
    const instance = new OperationResult(afterData);
    const attendances = await fetchDailyAttendances({
      companyId,
      operationResult: instance,
      transaction,
    });
    addOperationResultToDailyAttendances({
      attendances,
      operationResult: instance,
    });
    await saveDailyAttendances({ companyId, attendances, transaction });
    return;
  }

  // OperationResult 更新時の処理
  if (isUpdate) {
    // 変更前後の OperationResult に紐づく DailyAttendance を取得
    const beforeInstance = new OperationResult(beforeData);
    const afterInstance = new OperationResult(afterData);
    const beforeAttendances = await fetchDailyAttendances({
      companyId,
      operationResult: beforeInstance,
      transaction,
    });
    const afterAttendances = await fetchDailyAttendances({
      companyId,
      operationResult: afterInstance,
      transaction,
    });

    // 取得した DailyAttendance インスタンスについて重複を排除した Map を作成
    const attendancesMap = new Map();
    beforeAttendances.forEach(({ instance, exists }) => {
      attendancesMap.set(instance.docId, { instance, exists });
    });
    afterAttendances.forEach(({ instance, exists }) => {
      attendancesMap.set(instance.docId, { instance, exists });
    });

    const attendances = Array.from(attendancesMap.values());
    removeOperationResultFromDailyAttendances({
      attendances,
      operationResult: beforeInstance,
    });

    addOperationResultToDailyAttendances({
      attendances,
      operationResult: afterInstance,
    });

    await saveDailyAttendances({ companyId, attendances, transaction });
    return;
  }

  // OperationResult 削除時の処理
  if (isDelete) {
    const instance = new OperationResult(beforeData);
    const attendances = await fetchDailyAttendances({
      companyId,
      operationResult: instance,
      transaction,
    });
    removeOperationResultFromDailyAttendances({
      attendances,
      operationResult: instance,
    });
    await saveDailyAttendances({ companyId, attendances, transaction });
    return;
  }
}
