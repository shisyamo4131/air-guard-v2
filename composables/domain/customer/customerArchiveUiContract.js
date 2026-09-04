const SAFE_IDENTIFIER_PATTERN = /^[^/\u0000-\u001f\u007f]{1,128}$/u;

const DEFINITE_ERROR_MESSAGES = Object.freeze({
  "functions/invalid-argument": "入力内容を確認してください。",
  "functions/permission-denied":
    "取引先をアーカイブする権限がありません。",
  "functions/unauthenticated": "認証状態を確認してください。",
  "functions/not-found": "取引先が見つかりません。",
  "functions/failed-precondition":
    "参照されている取引先はアーカイブできません。",
  "functions/aborted":
    "取引先のアーカイブ状態が競合しています。最新情報を確認してください。",
});

export const CUSTOMER_ARCHIVE_UNCERTAIN_MESSAGE =
  "処理結果を確認できませんでした。同じ内容で再試行してください。";

export class CustomerArchiveUiError extends Error {
  constructor({ code, message, outcomeUncertain }) {
    super(message);
    this.name = "CustomerArchiveUiError";
    this.code = code;
    this.outcomeUncertain = outcomeUncertain;
  }
}

function invalidInput(message) {
  return new CustomerArchiveUiError({
    code: "functions/invalid-argument",
    message,
    outcomeUncertain: false,
  });
}

export function normalizeCustomerArchiveCustomerId(value) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !SAFE_IDENTIFIER_PATTERN.test(value)
  ) {
    throw invalidInput("取引先を確認してください。");
  }
  return value;
}

export function normalizeCustomerArchiveReason(value) {
  if (typeof value !== "string") {
    throw invalidInput("理由を入力してください。");
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 200) {
    throw invalidInput("理由は1文字以上200文字以内で入力してください。");
  }
  return normalized;
}

export function normalizeCustomerArchiveOperationId(value) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !SAFE_IDENTIFIER_PATTERN.test(value)
  ) {
    throw invalidInput("アーカイブ操作を開始できませんでした。");
  }
  return value;
}

export function createCustomerArchiveOperationId(
  randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
) {
  if (typeof randomUUID !== "function") {
    throw invalidInput("アーカイブ操作を開始できませんでした。");
  }
  const operationId = randomUUID();
  return normalizeCustomerArchiveOperationId(operationId);
}

export function createCustomerArchiveRequest({
  customerId,
  reason,
  operationId,
}) {
  return Object.freeze({
    customerId: normalizeCustomerArchiveCustomerId(customerId),
    reason: normalizeCustomerArchiveReason(reason),
    operationId: normalizeCustomerArchiveOperationId(operationId),
  });
}

export function isCustomerArchiveSuccess(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === 2 &&
    keys.includes("success") &&
    keys.includes("archived") &&
    value.success === true &&
    value.archived === true
  );
}

export function toCustomerArchiveUiError(error) {
  if (error instanceof CustomerArchiveUiError) return error;
  const code = typeof error?.code === "string" ? error.code : null;
  const message = code ? DEFINITE_ERROR_MESSAGES[code] : null;
  if (message) {
    return new CustomerArchiveUiError({
      code,
      message,
      outcomeUncertain: false,
    });
  }
  return new CustomerArchiveUiError({
    code: "outcome-uncertain",
    message: CUSTOMER_ARCHIVE_UNCERTAIN_MESSAGE,
    outcomeUncertain: true,
  });
}

export function customerArchiveMalformedResponseError() {
  return new CustomerArchiveUiError({
    code: "outcome-uncertain",
    message: CUSTOMER_ARCHIVE_UNCERTAIN_MESSAGE,
    outcomeUncertain: true,
  });
}
