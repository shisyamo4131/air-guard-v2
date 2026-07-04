/*****************************************************************************
 * @file ./functions/modules/siteEmployeeHistories/rebuildHistories.js
 * @description 現場・従業員の従事履歴を再構築する
 *****************************************************************************/
import { rebuildHistory } from "./rebuildHistory.js";

/*****************************************************************************
 * 現場・従業員の従事履歴を再構築する
 *
 * @param {string} companyId
 * @param {string} siteId
 * @param {string[]} employeeIds
 *****************************************************************************/
export async function rebuildHistories(companyId, siteId, employeeIds = []) {
  const uniqueEmployeeIds = new Set(employeeIds);
  for (const employeeId of uniqueEmployeeIds) {
    await rebuildHistory(companyId, siteId, employeeId);
  }
}
