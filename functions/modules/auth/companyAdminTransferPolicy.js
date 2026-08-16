/*****************************************************************************
 * @file ./functions/modules/auth/companyAdminTransferPolicy.js
 * @description 会社管理者の移譲可否を検証するためのモジュールです。
 * @method assertCompanyAdminTransferPolicy 会社管理者の移譲可否を検証します。
 *****************************************************************************/
import { assertUserDocumentCompany } from "./userAuthCompanyPolicy.js";

export const COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES = Object.freeze({
  REQUIRED_FIELD_MISSING: "required-field-missing",
  ACTOR_SOURCE_MISMATCH: "actor-source-mismatch",
  SOURCE_TARGET_SAME: "source-target-same",
  CURRENT_ADMIN_COUNT_INVALID: "current-admin-count-invalid",
  ACTOR_NOT_CURRENT_ADMIN: "actor-not-current-admin",
  SOURCE_ADMIN_STATE_INVALID: "source-admin-state-invalid",
  SOURCE_NOT_ADMIN: "source-not-admin",
  SOURCE_DISABLED_STATE_INVALID: "source-disabled-state-invalid",
  SOURCE_NOT_ACTIVE: "source-not-active",
  TARGET_ADMIN_STATE_INVALID: "target-admin-state-invalid",
  TARGET_ALREADY_ADMIN: "target-already-admin",
  TARGET_DISABLED_STATE_INVALID: "target-disabled-state-invalid",
  TARGET_NOT_ACTIVE: "target-not-active",
});

/**
 * 会社管理者移譲ポリシーの検証エラーです。
 */
export class CompanyAdminTransferPolicyError extends Error {
  /**
   * @param {string} code - エラーコード
   * @param {string} message - エラーメッセージ
   * @param {{ cause?: unknown }} [options] - エラーの追加情報
   */
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "CompanyAdminTransferPolicyError";
    this.code = code;
  }
}

/**
 * 会社管理者を移譲できる状態であることを検証します。
 *
 * この関数はFirestoreやAuthenticationへアクセスしません。
 * 呼び出し側が取得したUserデータと現在の管理者UID一覧だけを検証します。
 *
 * @param {Object} param - 検証対象
 * @param {string} param.companyId - 会社ID
 * @param {string} param.actorUid - 操作を実行したUserのUID
 * @param {string} param.fromUid - 移譲元UserのUID
 * @param {Object} param.fromUser - 移譲元Userのデータ
 * @param {string} param.toUid - 移譲先UserのUID
 * @param {Object} param.toUser - 移譲先Userのデータ
 * @param {string[]} param.currentAdminUids - 現在の会社管理者UID一覧
 * @throws {CompanyAdminTransferPolicyError} ポリシーに違反した場合
 * @throws {UserAuthCompanyPolicyError} Userと会社の整合性がない場合
 */
export function assertCompanyAdminTransferPolicy({
  companyId,
  actorUid,
  fromUid,
  fromUser,
  toUid,
  toUser,
  currentAdminUids,
} = {}) {
  if (
    typeof companyId !== "string" ||
    !companyId ||
    typeof actorUid !== "string" ||
    !actorUid ||
    typeof fromUid !== "string" ||
    !fromUid ||
    typeof toUid !== "string" ||
    !toUid ||
    !fromUser ||
    typeof fromUser !== "object" ||
    !toUser ||
    typeof toUser !== "object" ||
    !Array.isArray(currentAdminUids)
  ) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
      "[assertCompanyAdminTransferPolicy] Required fields are missing",
    );
  }

  // 操作者本人だけが自身の管理者権限を移譲できる
  if (actorUid !== fromUid) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_SOURCE_MISMATCH,
      "[assertCompanyAdminTransferPolicy] Actor must match source user",
    );
  }

  // 同一Userへの移譲は許可しない
  if (fromUid === toUid) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_TARGET_SAME,
      "[assertCompanyAdminTransferPolicy] Source and target must be different",
    );
  }

  // 移譲元・移譲先が同じ会社の本登録Userであることを検証
  assertUserDocumentCompany({
    pathCompanyId: companyId,
    userData: fromUser,
  });

  assertUserDocumentCompany({
    pathCompanyId: companyId,
    userData: toUser,
  });

  // 会社管理者は常に1人だけでなければならない
  if (currentAdminUids.length !== 1) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.CURRENT_ADMIN_COUNT_INVALID,
      "[assertCompanyAdminTransferPolicy] Company must have exactly one admin",
    );
  }

  // 現在の唯一の会社管理者が操作者本人でなければならない
  if (currentAdminUids[0] !== actorUid) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_NOT_CURRENT_ADMIN,
      "[assertCompanyAdminTransferPolicy] Actor is not the current admin",
    );
  }

  // 移譲元の isAdmin が boolean でない場合は例外をスロー
  if (typeof fromUser.isAdmin !== "boolean") {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_ADMIN_STATE_INVALID,
      "[assertCompanyAdminTransferPolicy] Source admin state is invalid",
    );
  }

  // 移譲元が管理者でなければ例外をスロー
  if (fromUser.isAdmin !== true) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ADMIN,
      "[assertCompanyAdminTransferPolicy] Source user is not an admin",
    );
  }

  // 移譲元の disabled が boolean でない場合は例外をスロー
  if (typeof fromUser.disabled !== "boolean") {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_DISABLED_STATE_INVALID,
      "[assertCompanyAdminTransferPolicy] Source disabled state is invalid",
    );
  }

  // 移譲元が使用不可の状態であれば例外をスロー
  if (fromUser.disabled === true) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ACTIVE,
      "[assertCompanyAdminTransferPolicy] Source user is not active",
    );
  }

  // 移譲先の isAdmin が boolean でなければ例外をスロー
  if (typeof toUser.isAdmin !== "boolean") {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
      "[assertCompanyAdminTransferPolicy] Target admin state is invalid",
    );
  }

  // 移譲先が管理者である場合は例外をスロー
  if (toUser.isAdmin === true) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_ALREADY_ADMIN,
      "[assertCompanyAdminTransferPolicy] Target user is already an admin",
    );
  }

  // 移譲先の disabled が boolean でない場合は例外をスロー
  if (typeof toUser.disabled !== "boolean") {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_DISABLED_STATE_INVALID,
      "[assertCompanyAdminTransferPolicy] Target disabled state is invalid",
    );
  }

  // 移譲先が使用不可であれば例外をスロー
  if (toUser.disabled === true) {
    throw new CompanyAdminTransferPolicyError(
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_NOT_ACTIVE,
      "[assertCompanyAdminTransferPolicy] Target user is not active",
    );
  }
}
