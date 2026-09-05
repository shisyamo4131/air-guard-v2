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

  const siteRef = companyRef.collection("Sites").doc(siteId);
  await db.runTransaction(async (transaction) => {
    const [firstSnapshot, lastSnapshot, siteSnapshot] = await Promise.all([
      transaction.get(baseQuery.orderBy("date").limit(1)),
      transaction.get(baseQuery.orderBy("date", "desc").limit(1)),
      transaction.get(siteRef),
    ]);

    // 参照元がなくなった履歴の削除は、Site archive後にも収束できる。
    if (firstSnapshot.empty) {
      transaction.delete(historyRef);
      return;
    }
    if (!siteSnapshot.exists) {
      throw new Error(`Site not found: ${siteId}`);
    }

    const firstDoc = firstSnapshot.docs[0];
    const lastDoc = lastSnapshot.docs[0];
    const firstDateAt = Timestamp.fromDate(
      dayjs.tz(firstDoc.get("date")).startOf("day").toDate(),
    );
    const lastDateAt = Timestamp.fromDate(
      dayjs.tz(lastDoc.get("date")).startOf("day").toDate(),
    );
    const instance = new SiteEmployeeHistory({
      siteId,
      employeeId,
      firstDateAt,
      firstOperationResultId: firstDoc.id,
      lastDateAt,
      lastOperationResultId: lastDoc.id,
    });
    await instance.create({
      prefix: `Companies/${companyId}`,
      transaction,
    });
  });
}
