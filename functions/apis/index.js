import { HttpsError, onCall } from "firebase-functions/v2/https";
import { rebuildAllHistories as rebuildAllHistoriesCore } from "../modules/siteEmployeeHistories/rebuildAllHistories.js";

/*****************************************************************************
 * SiteEmployeeHistories を全件再構築します。
 *****************************************************************************/
export const rebuildAllHistories = onCall(async (request) => {
  const { companyId } = request.data;

  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required");
  }

  try {
    await rebuildAllHistoriesCore(companyId);
    return { message: "Successfully rebuilt all histories." };
  } catch (err) {
    if (err instanceof HttpsError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : "Unexpected error";
    throw new HttpsError("internal", message);
  }
});
