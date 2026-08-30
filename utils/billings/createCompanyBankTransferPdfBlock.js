import { parseUpdateCompanyBillingInputV1 } from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

const BANK_FIELDS = Object.freeze([
  "bankName",
  "branchName",
  "accountType",
  "accountNumber",
  "accountHolder",
]);

/**
 * 完全かつ有効なCompany振込先だけをpdfmake blockへ変換します。
 * 不完全・不正・未登録の振込先は印字しません。
 */
export function createCompanyBankTransferPdfBlock(company = {}) {
  let billing;
  try {
    billing = parseUpdateCompanyBillingInputV1({
      expectedRevision: 1,
      value: {
        invoiceNumber: null,
        ...Object.fromEntries(
          BANK_FIELDS.map((field) => [field, company[field] ?? null]),
        ),
      },
    }).value;
  } catch {
    return null;
  }

  if (BANK_FIELDS.every((field) => billing[field] === null)) return null;

  return {
    stack: [
      {
        text: `振込先: ${billing.bankName} ${billing.branchName}`,
        noWrap: false,
      },
      { text: `${billing.accountType} ${billing.accountNumber}`, noWrap: false },
      { text: `口座名義: ${billing.accountHolder}`, noWrap: false },
    ],
    width: 205,
    fontSize: 8,
    alignment: "right",
    margin: [0, 2, 0, 0],
  };
}
