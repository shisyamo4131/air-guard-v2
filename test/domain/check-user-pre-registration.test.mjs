import assert from "node:assert/strict";
import test from "node:test";

import { createUserEmailReservationId } from "../../functions/modules/auth/createTemporaryUser.js";
import {
  CHECK_USER_PRE_REGISTRATION_ERROR_CODES,
  CheckUserPreRegistrationError,
  checkUserPreRegistration,
} from "../../functions/modules/auth/checkUserPreRegistration.js";

const EMAIL = "user@example.com";
const COMPANY_ID = "company-a";
const USER_ID = "user-a";
const EMPLOYEE_ID = "employee-a";
const EMAIL_RESERVATION_PATH =
  `UserEmailReservations/${createUserEmailReservationId(EMAIL)}`;
const USER_PATH = `Companies/${COMPANY_ID}/Users/${USER_ID}`;
const EMPLOYEE_RESERVATION_PATH =
  `Companies/${COMPANY_ID}/EmployeeUserReservations/${EMPLOYEE_ID}`;

function eligibleUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    email: EMAIL,
    isTemporary: true,
    isAdmin: false,
    disabled: false,
    ...overrides,
  };
}

function snapshot(data) {
  return { exists: data !== null, data: () => data };
}

function createFirestore({
  reservation = { companyId: COMPANY_ID, userId: USER_ID },
  user = eligibleUser(),
  employeeReservation = { userId: USER_ID },
  transactionError = null,
} = {}) {
  const calls = [];
  const firestore = {
    doc(path) {
      calls.push({ method: "firestore.doc", path });
      return { path };
    },
    async runTransaction(callback) {
      calls.push({ method: "firestore.runTransaction" });
      if (transactionError) throw transactionError;
      return callback({
        async get(ref) {
          calls.push({ method: "transaction.get", path: ref.path });
          if (ref.path === EMAIL_RESERVATION_PATH) return snapshot(reservation);
          if (ref.path === USER_PATH) return snapshot(user);
          if (ref.path === EMPLOYEE_RESERVATION_PATH) {
            return snapshot(employeeReservation);
          }
          throw new Error(`Unexpected read: ${ref.path}`);
        },
      });
    },
  };
  return { firestore, calls };
}

async function assertInputError(email) {
  const dependencies = createFirestore();
  await assert.rejects(
    () =>
      checkUserPreRegistration({
        firestore: dependencies.firestore,
        email,
      }),
    (error) => {
      assert.ok(error instanceof CheckUserPreRegistrationError);
      assert.equal(
        error.code,
        CHECK_USER_PRE_REGISTRATION_ERROR_CODES.INPUT_INVALID,
      );
      return true;
    },
  );
  assert.equal(dependencies.calls.length, 0);
}

test("invalid email input is rejected before Firestore access", async () => {
  for (const email of [undefined, null, "", "invalid", 1]) {
    await assertInputError(email);
  }
});

test("Firestore dependency must provide doc and transaction methods", async () => {
  await assert.rejects(
    () => checkUserPreRegistration({ firestore: {}, email: EMAIL }),
    (error) => {
      assert.ok(error instanceof CheckUserPreRegistrationError);
      assert.equal(
        error.code,
        CHECK_USER_PRE_REGISTRATION_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
      );
      return true;
    },
  );
});

test("canonical input resolves the reservation and standalone User in one transaction", async () => {
  const dependencies = createFirestore();
  const result = await checkUserPreRegistration({
    firestore: dependencies.firestore,
    email: " User@Example.COM ",
  });
  assert.deepEqual(result, { isPreRegistered: true });
  assert.deepEqual(Object.keys(result), ["isPreRegistered"]);
  assert.deepEqual(
    dependencies.calls
      .filter((call) => call.method === "transaction.get")
      .map((call) => call.path),
    [EMAIL_RESERVATION_PATH, USER_PATH],
  );
});

test("missing or malformed email reservation returns false without a User read", async () => {
  for (const reservation of [
    null,
    [],
    { companyId: COMPANY_ID },
    { companyId: "", userId: USER_ID },
    { companyId: " company-a", userId: USER_ID },
    { companyId: 1, userId: USER_ID },
    { companyId: "company/a", userId: USER_ID },
    { companyId: COMPANY_ID, userId: "" },
    { companyId: COMPANY_ID, userId: " user-a" },
    { companyId: COMPANY_ID, userId: 1 },
    { companyId: COMPANY_ID, userId: USER_ID, extra: true },
  ]) {
    const dependencies = createFirestore({ reservation });
    assert.deepEqual(
      await checkUserPreRegistration({
        firestore: dependencies.firestore,
        email: EMAIL,
      }),
      { isPreRegistered: false },
    );
    assert.equal(
      dependencies.calls.filter((call) => call.method === "transaction.get")
        .length,
      1,
    );
  }
});

test("only a canonical active non-admin temporary User is eligible", async () => {
  for (const user of [
    null,
    eligibleUser({ companyId: "company-b" }),
    eligibleUser({ email: "other@example.com" }),
    eligibleUser({ email: "User@Example.COM" }),
    eligibleUser({ email: " user@example.com " }),
    eligibleUser({ isTemporary: false }),
    eligibleUser({ isTemporary: undefined }),
    eligibleUser({ isAdmin: true }),
    eligibleUser({ isAdmin: undefined }),
    eligibleUser({ disabled: true }),
    eligibleUser({ disabled: undefined }),
  ]) {
    const dependencies = createFirestore({ user });
    assert.deepEqual(
      await checkUserPreRegistration({
        firestore: dependencies.firestore,
        email: EMAIL,
      }),
      { isPreRegistered: false },
    );
  }
});

test("a registered reservation pointer is indistinguishable from no pre-registration", async () => {
  const dependencies = createFirestore({
    user: eligibleUser({ isTemporary: false }),
  });
  assert.deepEqual(
    await checkUserPreRegistration({
      firestore: dependencies.firestore,
      email: EMAIL,
    }),
    { isPreRegistered: false },
  );
});

test("Employee-linked User requires an exact Employee reservation pointer", async () => {
  const valid = createFirestore({
    user: eligibleUser({ employeeId: EMPLOYEE_ID }),
  });
  assert.deepEqual(
    await checkUserPreRegistration({ firestore: valid.firestore, email: EMAIL }),
    { isPreRegistered: true },
  );
  assert.deepEqual(
    valid.calls
      .filter((call) => call.method === "transaction.get")
      .map((call) => call.path),
    [EMAIL_RESERVATION_PATH, USER_PATH, EMPLOYEE_RESERVATION_PATH],
  );

  for (const options of [
    { user: eligibleUser({ employeeId: "" }) },
    { user: eligibleUser({ employeeId: "employee/a" }) },
    { user: eligibleUser({ employeeId: EMPLOYEE_ID }), employeeReservation: null },
    {
      user: eligibleUser({ employeeId: EMPLOYEE_ID }),
      employeeReservation: { userId: USER_ID, extra: true },
    },
    {
      user: eligibleUser({ employeeId: EMPLOYEE_ID }),
      employeeReservation: { userId: " user-a" },
    },
    {
      user: eligibleUser({ employeeId: EMPLOYEE_ID }),
      employeeReservation: { userId: "user/a" },
    },
    {
      user: eligibleUser({ employeeId: EMPLOYEE_ID }),
      employeeReservation: { userId: 1 },
    },
    {
      user: eligibleUser({ employeeId: EMPLOYEE_ID }),
      employeeReservation: { userId: "other-user" },
    },
  ]) {
    const dependencies = createFirestore(options);
    assert.deepEqual(
      await checkUserPreRegistration({
        firestore: dependencies.firestore,
        email: EMAIL,
      }),
      { isPreRegistered: false },
    );
  }
});

test("transaction failures are propagated instead of being reported as false", async () => {
  const transactionError = new Error("synthetic transaction failure");
  const dependencies = createFirestore({ transactionError });
  await assert.rejects(
    () =>
      checkUserPreRegistration({
        firestore: dependencies.firestore,
        email: EMAIL,
      }),
    (error) => error === transactionError,
  );
});
