/*****************************************************************************
 * @file ./functions/apis/rebuildAllHistories.js
 * @description SiteEmployeeHistoriesを再構築するCallable APIです。
 * @method rebuildAllHistories SiteEmployeeHistoriesを全件再構築します。
 *****************************************************************************/
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { rebuildAllHistories as rebuildAllHistoriesCore } from "../modules/siteEmployeeHistories/rebuildAllHistories.js";
import { authorizeCompanyRebuild } from "./authorizeCompanyRebuild.js";

/**
 * SiteEmployeeHistoriesを全件再構築します。
 */
export const rebuildAllHistories = onCall(async (request) => {
  const companyId = await authorizeCompanyRebuild(request);

  try {
    await rebuildAllHistoriesCore(companyId);
    return { message: "Successfully rebuilt all histories." };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    throw new HttpsError("internal", message);
  }
});
