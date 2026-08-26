/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/cleanupUserFcmTokens.js
 * @description UWB-07完了phaseから呼び出すFCM token cleanup adapterです。
 *****************************************************************************/
import { FcmToken } from "@shisyamo4131/air-guard-v2-schemas";

export async function cleanupUserFcmTokens({ targetUserUid } = {}) {
  if (
    typeof targetUserUid !== "string" ||
    !targetUserUid ||
    targetUserUid.trim() !== targetUserUid ||
    /\s/u.test(targetUserUid) ||
    targetUserUid.includes("/")
  ) {
    throw new TypeError("[cleanupUserFcmTokens] targetUserUid is invalid");
  }
  return FcmToken.deleteByUid(targetUserUid);
}
