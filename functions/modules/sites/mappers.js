import { mapCallableAuthIdentityError } from "../auth/mappers/mapCallableAuthIdentityError.js";
import { SITE_LIFECYCLE_ERROR_CODES, SiteLifecycleError } from "./lifecycle.js";

export function mapSiteLifecycleError(error) {
  const identity = mapCallableAuthIdentityError(error);
  if (identity) return identity;
  if (!(error instanceof SiteLifecycleError)) return { code: "internal", message: "現場の状態を変更できませんでした。" };
  switch (error.code) {
    case SITE_LIFECYCLE_ERROR_CODES.INVALID_INPUT:
      return { code: "invalid-argument", message: "入力内容を確認してください。" };
    case SITE_LIFECYCLE_ERROR_CODES.ACTOR_NOT_ALLOWED:
      return { code: "permission-denied", message: "現場の状態を変更する権限がありません。" };
    case SITE_LIFECYCLE_ERROR_CODES.SITE_NOT_FOUND:
      return { code: "not-found", message: "現場が見つかりません。" };
    case SITE_LIFECYCLE_ERROR_CODES.INVALID_STATE:
    case SITE_LIFECYCLE_ERROR_CODES.SCHEDULES_EXIST:
      return { code: "failed-precondition", message: "現場の状態または稼働予定を確認してください。" };
    default:
      return { code: "internal", message: "現場の状態を変更できませんでした。" };
  }
}
