import { Employee as BaseEmployee } from "@shisyamo4131/air-guard-v2-schemas";

const INSURANCE_KINDS = Object.freeze([
  "healthInsurance",
  "pensionInsurance",
  "employmentInsurance",
]);

function initialInsuranceOperationVersions() {
  return Object.fromEntries(INSURANCE_KINDS.map((kind) => [kind, 0]));
}

function isValidInsuranceOperationVersions(value) {
  if (value === undefined) return true;
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.keys(value).length !== INSURANCE_KINDS.length
  ) {
    return false;
  }
  return INSURANCE_KINDS.every(
    (kind) =>
      Object.hasOwn(value, kind) &&
      Number.isSafeInteger(value[kind]) &&
      value[kind] >= 0 &&
      value[kind] < Number.MAX_SAFE_INTEGER,
  );
}

/**
 * Employeeのアプリケーション所有fieldを補うローカルschema。
 *
 * 公開Schemas 3.0.0-dev.1にはinsuranceOperationVersionsがないため、
 * 通常のdocument全体保存で既存値を落とさないようにする。
 */
export default class Employee extends BaseEmployee {
  static classProps = {
    ...BaseEmployee.classProps,
    insuranceOperationVersions: {
      ...BaseEmployee.classProps.location,
      label: "保険操作世代",
      default: initialInsuranceOperationVersions,
      validator: isValidInsuranceOperationVersions,
      hidden: true,
    },
  };

  afterInitialize(item = {}) {
    super.afterInitialize(item);
    if (!Object.hasOwn(item, "insuranceOperationVersions")) {
      delete this.insuranceOperationVersions;
    }
  }

  async beforeCreate(args = {}) {
    if (!Object.hasOwn(this, "insuranceOperationVersions")) {
      this.insuranceOperationVersions = initialInsuranceOperationVersions();
    }
    await super.beforeCreate(args);
  }
}

export { INSURANCE_KINDS, initialInsuranceOperationVersions };
