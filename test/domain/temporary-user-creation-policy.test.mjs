import assert from "node:assert/strict";
import test from "node:test";
import { User } from "@shisyamo4131/air-guard-v2-schemas";
import { User as FunctionsUser } from "../../functions/node_modules/@shisyamo4131/air-guard-v2-schemas/index.js";

import {
  normalizeTemporaryUserEmail,
  resolveEmployeeLinkedTemporaryUserInput,
  resolveEmployeeLinkedTemporaryUserData,
  resolveStandaloneTemporaryUserData,
  TEMPORARY_USER_CREATION_POLICY_ERROR_CODES,
  TemporaryUserCreationPolicyError,
} from "../../functions/modules/auth/temporaryUserCreationPolicy.js";

const COMPANY_ID = "company-a";

function assertPolicyError(run, code) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof TemporaryUserCreationPolicyError);
    assert.equal(error.code, code);
    return true;
  });
}

test("email is trimmed and normalized to lowercase", () => {
  assert.equal(
    normalizeTemporaryUserEmail(" Tanaka@Example.COM "),
    "tanaka@example.com",
  );
});

test("standalone creation accepts known role presets and fixes protected fields", () => {
  const result = resolveStandaloneTemporaryUserData({
    companyId: COMPANY_ID,
    input: {
      email: "USER@EXAMPLE.COM",
      displayName: "利用者",
      roles: ["manager", "human-resource"],
      tagSize: "LARGE",
      receiveConfirmedArrangementNotification: true,
      receiveArrivedArrangementNotification: false,
      receiveLeavedArrangementNotification: true,
    },
  });

  assert.deepEqual(result, {
    email: "user@example.com",
    displayName: "利用者",
    roles: ["manager", "human-resource"],
    tagSize: "LARGE",
    receiveConfirmedArrangementNotification: true,
    receiveArrivedArrangementNotification: false,
    receiveLeavedArrangementNotification: true,
    companyId: COMPANY_ID,
    isTemporary: true,
    isAdmin: false,
    disabled: false,
  });
});

test("standalone creation applies safe defaults", () => {
  const result = resolveStandaloneTemporaryUserData({
    companyId: COMPANY_ID,
    input: {
      email: "user@example.com",
      displayName: "利用者",
    },
  });

  assert.deepEqual(result.roles, []);
  assert.equal(result.tagSize, "MEDIUM");
  assert.equal(result.receiveConfirmedArrangementNotification, false);
  assert.equal(result.receiveArrivedArrangementNotification, false);
  assert.equal(result.receiveLeavedArrangementNotification, false);
});

test("employee-linked creation derives display name and accepts known role presets", () => {
  const result = resolveEmployeeLinkedTemporaryUserData({
    companyId: COMPANY_ID,
    input: {
      employeeId: "employee-a",
      email: "Employee@Example.COM",
      roles: ["human-resource"],
    },
    employee: { displayName: "田中", employmentStatus: "ACTIVE" },
  });

  assert.deepEqual(result, {
    email: "employee@example.com",
    displayName: "田中",
    employeeId: "employee-a",
    roles: ["human-resource"],
    tagSize: "MEDIUM",
    receiveConfirmedArrangementNotification: false,
    receiveArrivedArrangementNotification: false,
    receiveLeavedArrangementNotification: false,
    companyId: COMPANY_ID,
    isTemporary: true,
    isAdmin: false,
    disabled: false,
  });
});

test("employee-linked input is canonicalized before external reads", () => {
  const result = resolveEmployeeLinkedTemporaryUserInput({
    employeeId: "employee-a",
    email: " Employee@Example.COM ",
    roles: ["manager"],
  });

  assert.deepEqual(result, {
    employeeId: "employee-a",
    email: "employee@example.com",
    roles: ["manager"],
  });
  assert.equal(Object.isFrozen(result), true);
});

test("protected and unrelated fields are rejected instead of ignored", () => {
  for (const field of [
    "companyId",
    "isTemporary",
    "isAdmin",
    "disabled",
    "employeeId",
    "createdAt",
  ]) {
    assertPolicyError(
      () =>
        resolveStandaloneTemporaryUserData({
          companyId: COMPANY_ID,
          input: {
            email: "user@example.com",
            displayName: "利用者",
            [field]: field === "employeeId" ? "employee-a" : false,
          },
        }),
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
    );
  }
});

test("employee-linked creation accepts only employeeId, email, and roles", () => {
  for (const field of [
    "displayName",
    "tagSize",
    "companyId",
    "isTemporary",
    "isAdmin",
    "disabled",
    "createdAt",
    "updatedAt",
    "uid",
    "receiveConfirmedArrangementNotification",
    "receiveArrivedArrangementNotification",
    "receiveLeavedArrangementNotification",
  ]) {
    assertPolicyError(
      () =>
        resolveEmployeeLinkedTemporaryUserData({
          companyId: COMPANY_ID,
          input: {
            employeeId: "employee-a",
            email: "employee@example.com",
            [field]: "value",
          },
          employee: { displayName: "田中", employmentStatus: "ACTIVE" },
        }),
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.UNEXPECTED_FIELD,
    );
  }
});

test("employee-linked creation rejects malformed and unauthorized roles", () => {
  const cases = [
    { roles: "manager", code: "roles-invalid" },
    { roles: ["unknown"], code: "role-invalid" },
    { roles: ["users:write"], code: "role-invalid" },
    { roles: ["manager", "manager"], code: "role-duplicated" },
    { roles: [1], code: "role-invalid" },
    { roles: null, code: "roles-invalid" },
  ];

  for (const { roles, code } of cases) {
    assertPolicyError(
      () =>
        resolveEmployeeLinkedTemporaryUserData({
          companyId: COMPANY_ID,
          input: {
            employeeId: "employee-a",
            email: "employee@example.com",
            roles,
          },
          employee: { displayName: "田中", employmentStatus: "ACTIVE" },
        }),
      code,
    );
  }
});

test("invalid emails and display names fail closed", () => {
  for (const email of [undefined, null, "", "user", "user @example.com", 1]) {
    assertPolicyError(
      () =>
        resolveStandaloneTemporaryUserData({
          companyId: COMPANY_ID,
          input: { email, displayName: "利用者" },
        }),
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMAIL_INVALID,
    );
  }

  for (const displayName of [undefined, null, "", " 利用者", "1234567", 1]) {
    assertPolicyError(
      () =>
        resolveStandaloneTemporaryUserData({
          companyId: COMPANY_ID,
          input: { email: "user@example.com", displayName },
        }),
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.DISPLAY_NAME_INVALID,
    );
  }
});

test("unknown, direct-permission, duplicate, and malformed roles are rejected", () => {
  const cases = [
    { roles: "manager", code: "roles-invalid" },
    { roles: ["unknown"], code: "role-invalid" },
    { roles: ["users:write"], code: "role-invalid" },
    { roles: ["manager", "manager"], code: "role-duplicated" },
    { roles: [1], code: "role-invalid" },
  ];

  for (const { roles, code } of cases) {
    assertPolicyError(
      () =>
        resolveStandaloneTemporaryUserData({
          companyId: COMPANY_ID,
          input: {
            email: "user@example.com",
            displayName: "利用者",
            roles,
          },
        }),
      code,
    );
  }
});

test("invalid tag sizes and notification flags are rejected", () => {
  for (const tagSize of ["medium", "UNKNOWN", 1, false, null]) {
    assertPolicyError(
      () =>
        resolveStandaloneTemporaryUserData({
          companyId: COMPANY_ID,
          input: {
            email: "user@example.com",
            displayName: "利用者",
            tagSize,
          },
        }),
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.TAG_SIZE_INVALID,
    );
  }

  for (const value of ["true", 1, null]) {
    assertPolicyError(
      () =>
        resolveStandaloneTemporaryUserData({
          companyId: COMPANY_ID,
          input: {
            email: "user@example.com",
            displayName: "利用者",
            receiveConfirmedArrangementNotification: value,
          },
        }),
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.NOTIFICATION_FLAG_INVALID,
    );
  }
});

test("required inputs, identifiers, and Employee state are validated", () => {
  assertPolicyError(
    () => resolveStandaloneTemporaryUserData(),
    TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assertPolicyError(
    () =>
      resolveStandaloneTemporaryUserData({
        companyId: "company/a",
        input: { email: "user@example.com", displayName: "利用者" },
      }),
    TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.IDENTIFIER_INVALID,
  );
  assertPolicyError(
    () =>
      resolveEmployeeLinkedTemporaryUserData({
        companyId: COMPANY_ID,
        input: { employeeId: "employee/a", email: "user@example.com" },
        employee: { displayName: "田中", employmentStatus: "ACTIVE" },
      }),
    TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.IDENTIFIER_INVALID,
  );
  assertPolicyError(
    () =>
      resolveEmployeeLinkedTemporaryUserData({
        companyId: COMPANY_ID,
        input: { employeeId: "employee-a", email: "user@example.com" },
        employee: [],
      }),
    TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMPLOYEE_INVALID,
  );
});

test("employee-linked creation defaults roles and rejects inactive Employees", () => {
  const activeResult = resolveEmployeeLinkedTemporaryUserData({
    companyId: COMPANY_ID,
    input: { employeeId: "employee-a", email: "user@example.com" },
    employee: { displayName: "田中", employmentStatus: "ACTIVE" },
  });
  assert.deepEqual(activeResult.roles, []);

  assertPolicyError(
    () =>
      resolveEmployeeLinkedTemporaryUserData({
        companyId: COMPANY_ID,
        input: { employeeId: "employee-a", email: "user@example.com" },
        employee: { displayName: "田中", employmentStatus: "RESIGNED" },
      }),
    TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMPLOYEE_NOT_ACTIVE,
  );

  for (const employmentStatus of [undefined, null, "UNKNOWN", 1]) {
    assertPolicyError(
      () =>
        resolveEmployeeLinkedTemporaryUserData({
          companyId: COMPANY_ID,
          input: { employeeId: "employee-a", email: "user@example.com" },
          employee: { displayName: "田中", employmentStatus },
        }),
      TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMPLOYEE_INVALID,
    );
  }
});

test("policy string limits stay in parity with the User schema", () => {
  const emailLimit = User.classProps.email.length;
  const displayNameLimit = User.classProps.displayName.length;
  assert.equal(emailLimit, 50);
  assert.equal(displayNameLimit, 6);
  assert.equal(FunctionsUser.classProps.email.length, emailLimit);
  assert.equal(FunctionsUser.classProps.displayName.length, displayNameLimit);

  assert.doesNotThrow(() =>
    resolveStandaloneTemporaryUserData({
      companyId: COMPANY_ID,
      input: {
        email: `${"a".repeat(emailLimit - "@example.com".length)}@example.com`,
        displayName: "a".repeat(displayNameLimit),
      },
    }),
  );

  assertPolicyError(
    () =>
      resolveStandaloneTemporaryUserData({
        companyId: COMPANY_ID,
        input: {
          email: `${"a".repeat(emailLimit + 1 - "@example.com".length)}@example.com`,
          displayName: "利用者",
        },
      }),
    TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.EMAIL_INVALID,
  );
  assertPolicyError(
    () =>
      resolveStandaloneTemporaryUserData({
        companyId: COMPANY_ID,
        input: {
          email: "user@example.com",
          displayName: "a".repeat(displayNameLimit + 1),
        },
      }),
    TEMPORARY_USER_CREATION_POLICY_ERROR_CODES.DISPLAY_NAME_INVALID,
  );
});
