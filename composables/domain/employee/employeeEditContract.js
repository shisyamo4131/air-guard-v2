import {
  Employee,
  Certification,
} from "@shisyamo4131/air-guard-v2-schemas";
import {
  plain,
  identifier,
  equal,
  expectedFields,
  dateInput,
  parseDate,
  rawForClass,
} from "../shared/valueContract.js";

// Client-only draft and request projection. Functions repeat authoritative
// actor, latest-state, schema, and save validation before every write.

export const BASIC_FIELDS = Object.freeze([
  "code", "lastName", "firstName", "lastNameKana", "firstNameKana",
  "displayName", "displayNameKana", "gender", "dateOfBirth", "dateOfHire",
  "title", "zipcode", "prefCode", "city", "address", "building", "mobile",
  "email", "remarks",
]);
const CREATE_FIELDS = Object.freeze(
  BASIC_FIELDS.filter((field) => field !== "remarks"),
);
export const NATIONALITY_FIELDS = Object.freeze([
  "isForeigner", "foreignName", "nationality", "residenceStatus",
  "hasPeriodOfStayLimit", "periodOfStay", "hasWorkRestrictions",
]);
export const SECURITY_FIELDS = Object.freeze([
  "hasSecurityGuardRegistration", "dateOfSecurityGuardRegistration",
  "bloodType", "emergencyContactName", "emergencyContactRelation",
  "emergencyContactRelationDetail", "emergencyContactAddress",
  "emergencyContactPhone", "domicile",
]);
export const CERTIFICATION_FIELDS = Object.freeze([
  "name", "type", "issuedBy", "issueDateAt", "expirationDateAt",
  "serialNumber",
]);
export const DATE_FIELDS = Object.freeze([
  "dateOfBirth", "dateOfHire", "periodOfStay",
  "dateOfSecurityGuardRegistration", "issueDateAt", "expirationDateAt",
]);
const ADDRESS_FIELDS = Object.freeze(["prefCode", "city", "address"]);
const CLEARED_SECURITY = Object.freeze({
  hasSecurityGuardRegistration: false,
  dateOfSecurityGuardRegistration: null,
  bloodType: "A",
  emergencyContactName: null,
  emergencyContactRelation: null,
  emergencyContactRelationDetail: null,
  emergencyContactAddress: null,
  emergencyContactPhone: null,
  domicile: null,
});

class EmployeeClientContractError extends Error {
  constructor(code) {
    super("invalid employee draft");
    this.name = "EmployeeClientContractError";
    this.code = code;
  }
}

const fail = (code = "invalid-argument") => {
  throw new EmployeeClientContractError(code);
};

export function operationFields(operation) {
  const fields = {
    create: CREATE_FIELDS,
    basic: BASIC_FIELDS,
    nationality: NATIONALITY_FIELDS,
    security: SECURITY_FIELDS,
    certifications: CERTIFICATION_FIELDS,
  }[operation];
  if (!fields) fail();
  return fields;
}

export function operationSchema(operation) {
  return operationFields(operation).map((field) => ({
    key: field,
    ...Employee.classProps[field],
  }));
}

export function parseEmployeeInput(operation, input) {
  const allowed = operation === "certifications"
    ? ["employeeId", "changes", "expected", "action", "position"]
    : ["employeeId", "changes", "expected"];
  if (
    !plain(input) ||
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    !identifier(input.employeeId) ||
    !plain(input.changes) ||
    !plain(input.expected)
  ) {
    fail();
  }
  if (
    operation === "certifications" &&
    (!(["add", "update", "remove"].includes(input.action)) ||
      (input.action === "add"
        ? input.position !== null
        : !Number.isSafeInteger(input.position) || input.position < 0) ||
      (input.action === "remove" && Object.keys(input.changes).length))
  ) {
    fail();
  }
  const fields = operationFields(operation);
  const changes = {};
  for (const [key, value] of Object.entries(input.changes)) {
    if (!fields.includes(key)) fail();
    if (DATE_FIELDS.includes(key)) changes[key] = parseDate(value);
    else if (
      [
        "isForeigner", "hasPeriodOfStayLimit", "hasWorkRestrictions",
        "hasSecurityGuardRegistration",
      ].includes(key)
    ) {
      if (typeof value !== "boolean") fail();
      changes[key] = value;
    } else {
      if (value !== null && typeof value !== "string") fail();
      if (
        operation === "certifications" &&
        key === "type" &&
        value !== null &&
        !Certification.classProps.type.component.attrs.items.some(
          (entry) => entry.value === value,
        )
      ) {
        fail();
      }
      changes[key] = value;
    }
  }
  return {
    employeeId: input.employeeId,
    changes,
    expected: input.expected,
    ...(operation === "certifications"
      ? { action: input.action, position: input.position }
      : {}),
  };
}

export function buildEmployeePatch(raw, changes, operation, options = {}) {
  if (operation === "certifications") {
    return buildCertificationPatch(raw, changes, options);
  }
  const model = new Employee(rawForClass(raw));
  const patch = {};
  for (const [field, value] of Object.entries(changes)) {
    if (!equal(raw[field], value)) patch[field] = value;
  }
  for (const [field, value] of Object.entries(patch)) {
    if (field !== "displayName") model[field] = value;
  }
  if (Object.hasOwn(changes, "displayName")) {
    model.displayName = changes.displayName;
  }
  if (operation === "nationality" && changes.isForeigner === false) {
    const defaults = new Employee();
    for (const field of NATIONALITY_FIELDS) {
      model[field] = defaults[field];
      if (!equal(raw[field], defaults[field])) patch[field] = defaults[field];
      else delete patch[field];
    }
  } else if (
    operation === "nationality" &&
    changes.hasPeriodOfStayLimit === false
  ) {
    model.periodOfStay = null;
    if (!equal(raw.periodOfStay, null)) patch.periodOfStay = null;
    else delete patch.periodOfStay;
  }
  if (
    operation === "create" ||
    (operation === "security" &&
      changes.hasSecurityGuardRegistration === false)
  ) {
    for (const field of SECURITY_FIELDS) {
      model[field] = CLEARED_SECURITY[field];
      if (!equal(raw[field], CLEARED_SECURITY[field])) {
        patch[field] = CLEARED_SECURITY[field];
      } else delete patch[field];
    }
  }
  try {
    model.validate();
  } catch {
    fail();
  }
  if (["lastName", "firstName"].some((field) => Object.hasOwn(patch, field))) {
    patch.fullName = model.fullName;
    patch.displayName = model.displayName;
  }
  if (
    ["lastNameKana", "firstNameKana"].some((field) =>
      Object.hasOwn(patch, field))
  ) {
    patch.fullNameKana = model.fullNameKana;
  }
  if (Employee.tokenFields.some((field) => Object.hasOwn(patch, field))) {
    patch.tokenMap = model.tokenMap;
  }
  if (ADDRESS_FIELDS.some((field) => Object.hasOwn(patch, field))) {
    patch.prefecture = model.prefecture;
    patch.fullAddress = model.fullAddress;
  }
  return { patch, model };
}

export function buildCertificationPatch(raw, changes, { action, position }) {
  const list = raw.securityCertifications === undefined
    ? []
    : raw.securityCertifications;
  if (
    !Array.isArray(list) ||
    (action !== "add" &&
      (position >= list.length || !plain(list[position])))
  ) {
    fail("failed-precondition");
  }
  const result = [...list];
  if (action === "remove") result.splice(position, 1);
  else {
    const previous = action === "add"
      ? new Certification().toObject()
      : list[position];
    const candidate = new Certification(rawForClass({ ...previous, ...changes }));
    try {
      candidate.validate();
    } catch {
      fail();
    }
    if (action === "add") result.push(candidate.toObject());
    else {
      const update = Object.fromEntries(
        Object.entries(changes).filter(
          ([field, value]) => !equal(previous[field], value),
        ),
      );
      if (Object.hasOwn(update, "name")) update.key = candidate.key;
      result[position] = { ...previous, ...update };
    }
  }
  const model = new Employee(
    rawForClass({ ...raw, securityCertifications: result }),
  );
  try {
    model.validate();
  } catch {
    fail();
  }
  return {
    patch: equal(raw.securityCertifications, result)
      ? {}
      : { securityCertifications: result },
    model,
  };
}

export { equal, expectedFields, dateInput, rawForClass };
