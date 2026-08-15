/*****************************************************************************
 * @file ./functions/apis/rebuildSecurityReportIndexes.js
 * @description Storageの現在状態からSecurityReportIndexesを再構築するCallable APIです。
 * @method rebuildSecurityReportIndexes SecurityReportIndexesを全件再構築します。
 *****************************************************************************/
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { rebuildSecurityReportIndexes as rebuildSecurityReportIndexesCore } from "../modules/securityReport/index.js";
import { authorizeCompanyRebuild } from "./authorizeCompanyRebuild.js";

/**
 * SecurityReportIndexesをStorageの現在状態から再構築します。
 */
export const rebuildSecurityReportIndexes = onCall(
  { timeoutSeconds: 540 },
  async (request) => {
    const companyId = await authorizeCompanyRebuild(request);

    try {
      const result = await rebuildSecurityReportIndexesCore(companyId);
      return {
        ...result,
        message:
          `警備日報インデックスを再構築しました。` +
          `（処理対象: ${result.processedCount}件、登録: ${result.indexedCount}件）`,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : "Unexpected error";
      throw new HttpsError("internal", message);
    }
  },
);
