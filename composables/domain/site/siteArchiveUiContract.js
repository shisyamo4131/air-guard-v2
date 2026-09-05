const SAFE_IDENTIFIER_PATTERN = /^[^/\u0000-\u001f\u007f]{1,128}$/u;

const ERROR_MESSAGES = Object.freeze({
  "functions/invalid-argument": "入力内容を確認してください。",
  "functions/permission-denied": "現場をアーカイブする権限がありません。",
  "functions/unauthenticated": "認証状態を確認してください。",
  "functions/not-found": "現場が見つかりません。",
  "functions/failed-precondition": "参照されている現場はアーカイブできません。",
  "functions/aborted": "現場のアーカイブ状態が競合しています。最新情報を確認してください。",
  "operation-in-progress": "別の現場操作を処理中です。完了後に再試行してください。",
});

export const SITE_ARCHIVE_UNCERTAIN_MESSAGE =
  "処理結果を確認できませんでした。同じ内容で再試行してください。";

export class SiteArchiveUiError extends Error {
  constructor({ code, message, outcomeUncertain }) {
    super(message);
    this.name = "SiteArchiveUiError";
    this.code = code;
    this.outcomeUncertain = outcomeUncertain;
  }
}

function invalidInput(message) {
  return new SiteArchiveUiError({
    code: "functions/invalid-argument", message, outcomeUncertain: false,
  });
}

export function normalizeSiteArchiveSiteId(value) {
  if (typeof value !== "string" || value.trim() !== value ||
      !SAFE_IDENTIFIER_PATTERN.test(value)) throw invalidInput("現場を確認してください。");
  return value;
}

export function normalizeSiteArchiveReason(value) {
  if (typeof value !== "string") throw invalidInput("理由を入力してください。");
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) {
    throw invalidInput("理由は1文字以上200文字以内で入力してください。");
  }
  return normalized;
}

export function normalizeSiteArchiveOperationId(value) {
  if (typeof value !== "string" || value.trim() !== value ||
      !SAFE_IDENTIFIER_PATTERN.test(value)) {
    throw invalidInput("アーカイブ操作を開始できませんでした。");
  }
  return value;
}

export function createSiteArchiveOperationId(
  randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
) {
  if (typeof randomUUID !== "function") throw invalidInput("アーカイブ操作を開始できませんでした。");
  return normalizeSiteArchiveOperationId(randomUUID());
}

export function createSiteArchiveRequest({ siteId, reason, operationId }) {
  return Object.freeze({
    siteId: normalizeSiteArchiveSiteId(siteId),
    reason: normalizeSiteArchiveReason(reason),
    operationId: normalizeSiteArchiveOperationId(operationId),
  });
}

export function isSiteArchiveSuccess(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === 2 && keys.includes("success") && keys.includes("archived") &&
    value.success === true && value.archived === true;
}

export function toSiteArchiveUiError(error) {
  if (error instanceof SiteArchiveUiError) return error;
  const code = typeof error?.code === "string" ? error.code : null;
  if (code && ERROR_MESSAGES[code]) {
    return new SiteArchiveUiError({ code, message: ERROR_MESSAGES[code], outcomeUncertain: false });
  }
  return new SiteArchiveUiError({
    code: "outcome-uncertain", message: SITE_ARCHIVE_UNCERTAIN_MESSAGE,
    outcomeUncertain: true,
  });
}

export function siteArchiveMalformedResponseError() {
  return new SiteArchiveUiError({
    code: "outcome-uncertain", message: SITE_ARCHIVE_UNCERTAIN_MESSAGE,
    outcomeUncertain: true,
  });
}
