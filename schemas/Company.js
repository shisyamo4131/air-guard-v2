/**
 * @file ./schemas/Company.js
 * @description 会社情報クラス
 *  - GeocodableMixin により自動的にジオコーディング機能を提供します。
 *  - `delete` は許可されていません。
 */
import { Company as BaseClass } from "@shisyamo4131/air-guard-v2-schemas";
import {
  parseUpdateCompanyBillingInputV1,
  parseUpdateCompanyProfileInputV1,
} from "@shisyamo4131/air-guard-v2-schemas/company-configuration";

const PROFILE_FIELDS = Object.freeze([
  "companyName",
  "companyNameKana",
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
  "tel",
  "fax",
  "invoiceNumber",
]);

const BILLING_FIELDS = Object.freeze([
  "bankName",
  "branchName",
  "accountType",
  "accountNumber",
  "accountHolder",
]);

const BILLING_FIELD_LIMITS = Object.freeze({
  bankName: 100,
  branchName: 100,
  accountNumber: 7,
  accountHolder: 200,
});

const COMPLETE_BILLING_SAMPLE = Object.freeze({
  invoiceNumber: null,
  bankName: "銀行",
  branchName: "支店",
  accountType: "普通",
  accountNumber: "0000001",
  accountHolder: "口座名義",
});

const PROFILE_FIELD_LIMITS = Object.freeze({
  companyName: 100,
  companyNameKana: 200,
  city: 100,
  address: 200,
  building: 200,
  tel: 32,
  fax: 32,
  invoiceNumber: 13,
});

const PROFILE_VALID_SAMPLE = Object.freeze({
  companyName: "会社",
  companyNameKana: "カイシャ",
  zipcode: null,
  prefCode: null,
  city: null,
  address: null,
  building: null,
  tel: null,
  fax: null,
});

const BILLING_VALID_SAMPLE = Object.freeze({
  invoiceNumber: null,
  bankName: null,
  branchName: null,
  accountType: null,
  accountNumber: null,
  accountHolder: null,
});

function profileFieldRule(field, label) {
  return (value) => {
    try {
      if (field === "invoiceNumber") {
        parseUpdateCompanyBillingInputV1({
          expectedRevision: 1,
          value: { ...BILLING_VALID_SAMPLE, invoiceNumber: value },
        });
      } else {
        parseUpdateCompanyProfileInputV1({
          expectedRevision: 1,
          value: { ...PROFILE_VALID_SAMPLE, [field]: value },
        });
      }
      return true;
    } catch {
      return `${label}の入力内容を確認してください。`;
    }
  };
}

function billingFieldRule(field, label) {
  return (value) => {
    try {
      const empty =
        value === null || (typeof value === "string" && !value.trim());
      parseUpdateCompanyBillingInputV1({
        expectedRevision: 1,
        value: empty
          ? BILLING_VALID_SAMPLE
          : { ...COMPLETE_BILLING_SAMPLE, [field]: value },
      });
      return true;
    } catch {
      return `${label}の入力内容を確認してください。`;
    }
  };
}

export default class Company extends BaseClass {
  static profileFields = PROFILE_FIELDS;

  static billingFields = BILLING_FIELDS;

  static get profileSchema() {
    const schemaByKey = new Map(this.schema.map((field) => [field.key, field]));

    return PROFILE_FIELDS.map((key) => {
      const field = schemaByKey.get(key);
      const label = field?.label || key;
      const limit = PROFILE_FIELD_LIMITS[key];
      return {
        ...field,
        ...(limit ? { length: limit } : {}),
        component: {
          ...field?.component,
          attrs: {
            ...field?.component?.attrs,
            ...(limit ? { counter: limit } : {}),
            rules: [profileFieldRule(key, label)],
          },
        },
      };
    });
  }

  static getProfileValue(source = {}) {
    return Object.fromEntries(
      PROFILE_FIELDS.map((field) => [field, source[field] ?? null]),
    );
  }

  static get billingSchema() {
    const schemaByKey = new Map(this.schema.map((field) => [field.key, field]));

    return BILLING_FIELDS.map((key) => {
      const field = schemaByKey.get(key);
      const label = field?.label || key;
      const limit = BILLING_FIELD_LIMITS[key];
      return {
        ...field,
        ...(limit ? { length: limit } : {}),
        component: {
          ...field?.component,
          attrs: {
            ...field?.component?.attrs,
            ...(limit ? { counter: limit } : {}),
            rules: [billingFieldRule(key, label)],
          },
        },
      };
    });
  }

  static getBillingValue(source = {}) {
    return Object.fromEntries(
      BILLING_FIELDS.map((field) => [field, source[field] ?? null]),
    );
  }

  static isDefaultOnlyBilling(value = {}) {
    const billing = this.getBillingValue(value);
    return (
      billing.accountType === "普通" &&
      BILLING_FIELDS.filter((field) => field !== "accountType").every(
        (field) => billing[field] === null,
      )
    );
  }

  static getBillingDraftValue(source = {}) {
    if (this.isDefaultOnlyBilling(source)) {
      return Object.fromEntries(BILLING_FIELDS.map((field) => [field, null]));
    }
    return this.getBillingValue(source);
  }

  static normalizeBilling(value = {}) {
    const billing = parseUpdateCompanyBillingInputV1({
      expectedRevision: 1,
      value: {
        invoiceNumber: value.invoiceNumber ?? null,
        ...this.getBillingValue(value),
      },
    }).value;
    return this.getBillingValue(billing);
  }

  static normalizeProfile(value) {
    const source = this.getProfileValue(value);
    const profile = parseUpdateCompanyProfileInputV1({
      expectedRevision: 1,
      value: Object.fromEntries(
        Object.keys(PROFILE_VALID_SAMPLE).map((field) => [field, source[field]]),
      ),
    }).value;
    const billing = parseUpdateCompanyBillingInputV1({
      expectedRevision: 1,
      value: { ...BILLING_VALID_SAMPLE, invoiceNumber: source.invoiceNumber },
    }).value;
    return { ...profile, invoiceNumber: billing.invoiceNumber };
  }

  // 後日実装予定のカスタムカラー用プロパティ
  // static classProps = {
  //   ...BaseClass.classProps,
  //   colorDefinitions: {
  //     type: Object,
  //     default: () => {
  //       return {
  //         dayType: {
  //           WEEKDAY: "green",
  //           SATURDAY: "blue",
  //           SUNDAY: "red",
  //           HOLIDAY: "pink",
  //         },
  //         shiftType: {
  //           DAY: "deep-orange",
  //           NIGHT: "indigo",
  //         },
  //       };
  //     },
  //   },
  // };

  async delete() {
    throw new Error("Companyドキュメントの削除は許可されていません。");
  }
}
