/*****************************************************************************
 * @file ./functions/triggers/lifecycleReconciler.js
 * @description UWB-07 retryable operationのscheduled reconcilerです。
 *****************************************************************************/
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/scheduler";
import { cleanupUserFcmTokens } from "../modules/auth/lifecycle/cleanupUserFcmTokens.js";
import { reconcileLifecycleOperations } from "../modules/auth/lifecycle/reconcileLifecycleOperations.js";

export const reconcileUserLifecycleOperations = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Tokyo",
  },
  async () => {
    const result = await reconcileLifecycleOperations({
      firestore: getFirestore(),
      auth: getAuth(),
      cleanupFcm: cleanupUserFcmTokens,
      onFailure: (failure) => {
        logger.error("User lifecycle reconciliation failed", failure);
      },
    });
    logger.info("User lifecycle reconciliation finished", result);
  },
);
