import { mapCallableAuthIdentityError } from "../auth/mappers/mapCallableAuthIdentityError.js";
import { SITE_LIFECYCLE_ERROR_CODES, SiteLifecycleError } from "./lifecycle.js";
import { SITE_ARCHIVE_ERROR_CODES, SiteArchiveError } from "./archiveSite.js";

export function mapSiteArchiveError(error) {
  const identity = mapCallableAuthIdentityError(error);
  if (identity) return identity;
  if (!(error instanceof SiteArchiveError)) {
    return { code: "internal", message: "現場をアーカイブできませんでした。" };
  }
  switch (error.code) {
    case SITE_ARCHIVE_ERROR_CODES.INVALID_INPUT:
      return { code: "invalid-argument", message: "入力内容を確認してください。" };
    case SITE_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED:
      return { code: "permission-denied", message: "現場をアーカイブする権限がありません。" };
    case SITE_ARCHIVE_ERROR_CODES.SITE_NOT_FOUND:
      return { code: "not-found", message: "現場が見つかりません。" };
    case SITE_ARCHIVE_ERROR_CODES.REFERENCES_EXIST:
    case SITE_ARCHIVE_ERROR_CODES.SITE_INVALID:
    case SITE_ARCHIVE_ERROR_CODES.MAINTENANCE:
      return { code: "failed-precondition", message: "現場の状態または参照を確認してください。" };
    case SITE_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT:
    case SITE_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID:
      return { code: "aborted", message: "現場のアーカイブ状態が競合しています。" };
    default:
      return { code: "internal", message: "現場をアーカイブできませんでした。" };
  }
}

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
