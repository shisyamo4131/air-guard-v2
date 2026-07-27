import { HttpsError, onCall } from "firebase-functions/v2/https";
import { rebuildAllHistories as rebuildAllHistoriesCore } from "../modules/siteEmployeeHistories/rebuildAllHistories.js";
import { rebuildSecurityReportIndexes as rebuildSecurityReportIndexesCore } from "../modules/securityReport/index.js";

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

/*****************************************************************************
 * SecurityReportIndexes をStorageの現在状態から再構築します。
 *****************************************************************************/
export const rebuildSecurityReportIndexes = onCall(
  { timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required");
    }
    if (request.auth.token.isSuperUser !== true) {
      throw new HttpsError(
        "permission-denied",
        "Super user permission is required",
      );
    }

    const { companyId } = request.data ?? {};
    if (!companyId || typeof companyId !== "string") {
      throw new HttpsError("invalid-argument", "companyId is required");
    }

    try {
      const result = await rebuildSecurityReportIndexesCore(companyId);
      return {
        ...result,
        message:
          `警備日報インデックスを再構築しました。` +
          `（処理対象: ${result.processedCount}件、登録: ${result.indexedCount}件）`,
      };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }

      const message = err instanceof Error ? err.message : "Unexpected error";
      throw new HttpsError("internal", message);
    }
  },
);
