import { Customer, CutoffDate } from "../../../schemas/index.js";
import {
  ROLE_PRESETS,
  isRolePresetId,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

export const CUSTOMER_OPERATION = Object.freeze({
  CREATE: "CREATE",
  UPDATE_BASIC: "UPDATE_BASIC",
  UPDATE_PAYMENT: "UPDATE_PAYMENT",
});

export const CUSTOMER_BASIC_FIELDS = Object.freeze([
  "code",
  "name",
  "branchName",
  "abbreviation",
  "nameKana",
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
  "tel",
  "fax",
  "contractStatus",
  "remarks",
]);

export const CUSTOMER_PAYMENT_FIELDS = Object.freeze([
  "cutoffDate",
  "paymentMonth",
  "paymentDate",
]);

export const CUSTOMER_CREATE_FIELDS = Object.freeze([
  ...CUSTOMER_BASIC_FIELDS.filter((field) => field !== "contractStatus"),
  ...CUSTOMER_PAYMENT_FIELDS,
]);

export const CUSTOMER_ADDRESS_FIELDS = Object.freeze([
  "prefCode",
  "city",
  "address",
]);

export const CUSTOMER_NAME_FIELDS = Object.freeze(["name", "nameKana"]);

const PAYMENT_DATE_VALUES = Object.freeze(
  CutoffDate.OPTIONS.map(({ value }) => value),
);
const PAYMENT_MONTH_VALUES = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

const OPERATION_FIELDS = Object.freeze({
  [CUSTOMER_OPERATION.CREATE]: CUSTOMER_CREATE_FIELDS,
  [CUSTOMER_OPERATION.UPDATE_BASIC]: CUSTOMER_BASIC_FIELDS,
  [CUSTOMER_OPERATION.UPDATE_PAYMENT]: CUSTOMER_PAYMENT_FIELDS,
});

export class CustomerOperationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CustomerOperationError";
    this.code = code;
  }
}

function cloneValue(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  }
  return value;
}

export function customerOperationFields(operation) {
  const fields = OPERATION_FIELDS[operation];
  if (!fields) {
    throw new CustomerOperationError(
      "invalid-operation",
      "取引先の操作内容を確認してください。",
    );
  }
  return fields;
}

export function customerOperationSchema(operation) {
  const schemaByKey = new Map(
    Customer.schema.map((definition) => [definition.key, definition]),
  );
  return customerOperationFields(operation).map((field) => schemaByKey.get(field));
}

export function getCustomerWriteDecision({
  uid,
  companyId,
  isSuperUser,
  isSuperUserClaimValid,
  user,
} = {}) {
  if (
    typeof uid !== "string" ||
    !uid ||
    typeof companyId !== "string" ||
    !companyId ||
    isSuperUserClaimValid !== true ||
    typeof isSuperUser !== "boolean" ||
    !user ||
    user.companyId !== companyId ||
    user.isTemporary !== false ||
    user.disabled !== false
  ) {
    return {
      allowed: false,
      reason: "取引先を変更する権限を確認できません。",
    };
  }

  if (user.isAdmin === true) return { allowed: true, reason: null };
  if (isSuperUser !== false || !Array.isArray(user.roles)) {
    return {
      allowed: false,
      reason: "取引先を変更する権限がありません。",
    };
  }

  const knownPresets = user.roles.every(isRolePresetId);
  const hasWritePreset = user.roles.some((role) =>
    ROLE_PRESETS[role]?.permissions.includes("customers:write"),
  );
  return knownPresets && hasWritePreset
    ? { allowed: true, reason: null }
    : { allowed: false, reason: "取引先を変更する権限がありません。" };
}

function assertString(value, field, { required = false, max }) {
  if (value == null) {
    if (!required) return;
    throw new CustomerOperationError(
      "invalid-customer",
      `${field}を入力してください。`,
    );
  }
  if (
    typeof value !== "string" ||
    (required && value.length === 0) ||
    (typeof max === "number" && value.length > max)
  ) {
    throw new CustomerOperationError(
      "invalid-customer",
      `${field}の入力内容を確認してください。`,
    );
  }
}

function assertCustomerTypes(customer) {
  assertString(customer.code, "取引先コード", { max: 10 });
  assertString(customer.name, "取引先名", { required: true, max: 20 });
  assertString(customer.branchName, "支店名など", { max: 20 });
  assertString(customer.abbreviation, "略称", { required: true, max: 20 });
  assertString(customer.nameKana, "取引先名（カナ）", {
    required: true,
    max: 40,
  });
  assertString(customer.zipcode, "郵便番号", { required: true });
  assertString(customer.prefCode, "都道府県", { required: true, max: 2 });
  assertString(customer.city, "市区町村", { required: true, max: 20 });
  assertString(customer.address, "町域名・番地", {
    required: true,
    max: 30,
  });
  assertString(customer.building, "建物名・階数", { max: 30 });
  assertString(customer.tel, "電話番号", { max: 13 });
  assertString(customer.fax, "FAX番号", { max: 13 });
  assertString(customer.remarks, "備考", { max: 200 });

  if (customer.location !== null) {
    const location = customer.location;
    if (
      !location ||
      typeof location !== "object" ||
      typeof location.formattedAddress !== "string" ||
      location.formattedAddress.length === 0 ||
      location.formattedAddress.length > 200 ||
      !Number.isFinite(location.lat) ||
      location.lat < -90 ||
      location.lat > 90 ||
      !Number.isFinite(location.lng) ||
      location.lng < -180 ||
      location.lng > 180
    ) {
      throw new CustomerOperationError(
        "invalid-customer",
        "取引先の位置情報を確認してください。",
      );
    }
  }

  if (!/^(0[1-9]|[1-3][0-9]|4[0-7])$/u.test(customer.prefCode)) {
    throw new CustomerOperationError(
      "invalid-customer",
      "都道府県を確認してください。",
    );
  }

  if (![Customer.STATUS_ACTIVE, Customer.STATUS_TERMINATED].includes(customer.contractStatus)) {
    throw new CustomerOperationError(
      "invalid-customer",
      "取引先の状態を確認してください。",
    );
  }
  if (!PAYMENT_DATE_VALUES.includes(customer.cutoffDate)) {
    throw new CustomerOperationError(
      "invalid-customer",
      "締日を確認してください。",
    );
  }
  if (!PAYMENT_MONTH_VALUES.includes(customer.paymentMonth)) {
    throw new CustomerOperationError(
      "invalid-customer",
      "入金月を確認してください。",
    );
  }
  if (!PAYMENT_DATE_VALUES.includes(customer.paymentDate)) {
    throw new CustomerOperationError(
      "invalid-customer",
      "入金日を確認してください。",
    );
  }
}

export function validateCustomerCandidate(customer) {
  if (!(customer instanceof Customer)) {
    throw new CustomerOperationError(
      "invalid-customer",
      "取引先の入力内容を確認してください。",
    );
  }
  try {
    customer.validate();
  } catch (error) {
    const first = error?.validationErrors?.[0];
    throw new CustomerOperationError(
      "invalid-customer",
      first?.messages?.ja || "取引先の入力内容を確認してください。",
    );
  }
  assertCustomerTypes(customer);
  return customer;
}

export function getCustomerOperationErrorMessage(error, fallback) {
  return error instanceof CustomerOperationError ? error.message : fallback;
}

function createCustomerFromLatest(latest) {
  if (!(latest instanceof Customer) || !latest.docId) {
    throw new CustomerOperationError(
      "invalid-customer",
      "取引先の最新情報を確認できません。",
    );
  }
  return new Customer(latest.toObject());
}

export async function prepareCustomerCreate({ draft, docId, actorUid, now }) {
  const candidate = new Customer(draft?.toObject?.() ?? draft ?? {});
  candidate.docId = docId;
  candidate.uid = actorUid;
  candidate.createdAt = now;
  candidate.updatedAt = now;
  candidate.contractStatus = Customer.STATUS_ACTIVE;
  await candidate.beforeCreate();
  validateCustomerCandidate(candidate);
  return candidate;
}

export async function prepareCustomerUpdate({
  latest,
  draft,
  actorUid,
  now,
}) {
  if (!(draft instanceof Customer)) {
    throw new CustomerOperationError(
      "invalid-customer",
      "取引先の入力内容を確認してください。",
    );
  }

  const candidate = createCustomerFromLatest(latest);
  for (const { key } of Customer.schema) {
    candidate[key] = cloneValue(draft[key]);
  }
  candidate.docId = latest.docId;
  candidate.createdAt = cloneValue(latest.createdAt);
  candidate.uid = actorUid;
  candidate.updatedAt = now;
  await candidate.beforeUpdate();
  validateCustomerCandidate(candidate);
  return { candidate };
}
