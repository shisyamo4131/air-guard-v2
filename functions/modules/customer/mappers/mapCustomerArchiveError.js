/*****************************************************************************
 * @file ./functions/modules/customer/mappers/mapCustomerArchiveError.js
 * @description Customer archive errorを安全なCallable応答へ変換します。
 *****************************************************************************/
import { mapCallableAuthIdentityError } from "../../auth/mappers/mapCallableAuthIdentityError.js";
import {
  CUSTOMER_ARCHIVE_ERROR_CODES,
  CustomerArchiveError,
} from "../archiveCustomer.js";

const RESPONSES = Object.freeze({
  invalidInput: Object.freeze({
    code: "invalid-argument",
    message: "入力内容を確認してください。",
  }),
  actorNotAllowed: Object.freeze({
    code: "permission-denied",
    message: "取引先をアーカイブする権限がありません。",
  }),
  customerNotFound: Object.freeze({
    code: "not-found",
    message: "取引先が見つかりません。",
  }),
  referencesExist: Object.freeze({
    code: "failed-precondition",
    message: "参照されている取引先はアーカイブできません。",
  }),
  archiveConflict: Object.freeze({
    code: "aborted",
    message: "取引先のアーカイブ状態が競合しています。",
  }),
  internal: Object.freeze({
    code: "internal",
    message: "取引先をアーカイブできませんでした。",
  }),
});

export function mapCustomerArchiveError(error) {
  const identityResponse = mapCallableAuthIdentityError(error);
  if (identityResponse) return identityResponse;

  if (!(error instanceof CustomerArchiveError)) return RESPONSES.internal;
  switch (error.code) {
    case CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_INPUT:
      return RESPONSES.invalidInput;
    case CUSTOMER_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED:
      return RESPONSES.actorNotAllowed;
    case CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_NOT_FOUND:
      return RESPONSES.customerNotFound;
    case CUSTOMER_ARCHIVE_ERROR_CODES.REFERENCES_EXIST:
      return RESPONSES.referencesExist;
    case CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT:
      return RESPONSES.archiveConflict;
    case CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY:
    case CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_INVALID:
    case CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID:
    default:
      return RESPONSES.internal;
  }
}
