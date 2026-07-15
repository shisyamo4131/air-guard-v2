/*****************************************************************************
 * @file ./functions/modules/siteEmployeeHistories/rebuildHistory.js
 * @description 現場・従業員の従事履歴を再構築する
 *****************************************************************************/
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import dayjs from "dayjs";
import { SiteEmployeeHistory } from "../../schemas/index.js";

const db = getFirestore();

/*****************************************************************************
 * 現場・従業員の従事履歴を再構築する
 *
 * @param {string} companyId
 * @param {string} siteId
 * @param {string} employeeId
 *****************************************************************************/
export async function rebuildHistory(companyId, siteId, employeeId) {
  const companyRef = db.collection("Companies").doc(companyId);

  const historyRef = companyRef
    .collection("SiteEmployeeHistories")
    .doc(`${siteId}_${employeeId}`);

  const operationResultsRef = companyRef.collection("OperationResults");

  const baseQuery = operationResultsRef
    .where("siteId", "==", siteId)
    .where("employeeIds", "array-contains", employeeId);

  const [firstSnapshot, lastSnapshot] = await Promise.all([
    baseQuery.orderBy("date").limit(1).get(),
    baseQuery.orderBy("date", "desc").limit(1).get(),
  ]);

  // 該当するOperationResultが存在しない場合は履歴を削除
  if (firstSnapshot.empty) {
    await historyRef.delete().catch(() => {});
    return;
  }

  const firstDoc = firstSnapshot.docs[0];
  const lastDoc = lastSnapshot.docs[0];

  // 履歴を作成（SiteEmployeeHistoryクラスを使用）
  const firstDateAt = Timestamp.fromDate(
    dayjs.tz(firstDoc.get("date"), "Asia/Tokyo").startOf("day").toDate(),
  );
  const lastDateAt = Timestamp.fromDate(
    dayjs.tz(lastDoc.get("date"), "Asia/Tokyo").startOf("day").toDate(),
  );
  const instance = new SiteEmployeeHistory({
    siteId,
    employeeId,
    firstDateAt,
    firstOperationResultId: firstDoc.id,
    lastDateAt,
    lastOperationResultId: lastDoc.id,
  });
  await instance.create({ prefix: `Companies/${companyId}` });
}
