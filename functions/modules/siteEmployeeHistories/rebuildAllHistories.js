/*****************************************************************************
 * @file ./functions/modules/siteEmployeeHistories/rebuildAllHistories.js
 * @description 現場・従業員の従事履歴を全件再構築する
 *****************************************************************************/

import { getFirestore } from "firebase-admin/firestore";
import { rebuildHistory } from "./rebuildHistory.js";

const db = getFirestore();

/*****************************************************************************
 * 現場・従業員の従事履歴を全件再構築する
 *
 * @param {string} companyId
 *****************************************************************************/
export async function rebuildAllHistories(companyId) {
  const companyRef = db.collection("Companies").doc(companyId);

  const snapshot = await companyRef
    .collection("OperationResults")
    .select("siteId", "employeeIds")
    .get();

  const pairs = new Set();

  snapshot.forEach((doc) => {
    const data = doc.data();

    const siteId = data.siteId;
    const employeeIds = data.employeeIds ?? [];

    for (const employeeId of employeeIds) {
      pairs.add(JSON.stringify([siteId, employeeId]));
    }
  });

  for (const pair of pairs) {
    const [siteId, employeeId] = JSON.parse(pair);
    await rebuildHistory(companyId, siteId, employeeId);
  }
}
