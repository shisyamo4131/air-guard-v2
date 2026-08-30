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

export default class Company extends BaseClass {
  static profileFields = PROFILE_FIELDS;

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
