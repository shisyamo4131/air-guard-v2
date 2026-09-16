import { OperationBilling as BaseOperationBilling } from "@shisyamo4131/air-guard-v2-schemas";
import Site from "./Site.js";

function normalized(value) {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (value?.toObject) return normalized(value.toObject());
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalized(value[key])]));
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}

export default class OperationBilling extends BaseOperationBilling {
  async _syncCustomerIdAndApplyAgreement(args = {}) {
    const transaction = args.transaction || this._operationBillingTransaction;
    return await super._syncCustomerIdAndApplyAgreement({ ...args, ...(transaction ? { transaction } : {}) });
  }

  async beforeUpdate(args = {}) {
    this._operationBillingTransaction = args.transaction || null;
    try {
      await super.beforeUpdate(args);
      const previous = this._beforeData || {};
      if (previous.siteId !== this.siteId || !sameValue(previous.agreement, this.agreement)) {
        const site = await new Site().fetchDoc({ docId: this.siteId, transaction: args.transaction });
        if (!site || !Array.isArray(site.agreementsV2)) {
          throw new Error("保存時点の現場取極めを確認できません。");
        }

        if (this.agreement == null) {
          this.agreement = null;
        } else {
          const agreementKey = this.agreement.key;
          const matches = site.agreementsV2.filter((agreement) => agreement?.key === agreementKey);
          if (typeof agreementKey !== "string" || matches.length !== 1) {
            throw new Error("現場の取極めが存在しないか重複しています。最新情報を確認してください。");
          }
          if (!sameValue(this.agreement, matches[0])) {
            throw new Error("取極めの内容が更新されています。最新の取極めを選び直してください。");
          }
          this.agreement = matches[0];
        }
      }
    } finally {
      delete this._operationBillingTransaction;
    }
  }
}
