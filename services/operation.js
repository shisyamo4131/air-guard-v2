/*****************************************************************************
 * @file ./services/operation.js
 * @description OperationResult, SiteOperationSchedule に対するドキュメントの追加前、
 *              更新前の処理を提供するサービス
 *****************************************************************************/
import { SECURITY_TYPE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { Site, OperationResult, SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * BEFORE CREATE
 *****************************************************************************/
export async function onBeforeCreate(item) {
  await initializeSecurityType(item);
}

/*****************************************************************************
 * BEFORE UPDATE
 *****************************************************************************/
export async function onBeforeUpdate(item) {
  await initializeSecurityType(item);
}

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * ドキュメントの securityType が UNSET の場合のみ、Site の securityType を既定値として設定します。
 * ユーザーが明示的に設定した securityType は変更しません。
 * @param {OperationResult|SiteOperationSchedule} item - OperationResult または SiteOperationSchedule インスタンス
 * @returns {Promise<void>}
 */
async function initializeSecurityType(item) {
  /** VALIDATION */
  const isValidInstance =
    item instanceof OperationResult || item instanceof SiteOperationSchedule;
  if (!isValidInstance) {
    const message = `Invalid item type: ${item.constructor.name}. Expected OperationResult or SiteOperationSchedule.`;
    throw new Error(message);
  }

  const { siteId, securityType } = item;
  if (!siteId) {
    throw new Error("siteId is required to initialize securityType.");
  }

  /** Return if securityType is already set */
  if (securityType !== SECURITY_TYPE_VALUES.UNSET.value) return;

  /** Fetch Site document and initialize securityType */
  const siteInstance = new Site();
  const siteIsExists = await siteInstance.fetch({ docId: siteId });
  if (!siteIsExists) {
    console.warn(
      `Site with ID ${siteId} does not exist. Skipping security type initialization.`,
    );
    return;
  }
  item.securityType = siteInstance.securityType;
}
