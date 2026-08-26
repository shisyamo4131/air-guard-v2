import assert from "node:assert/strict";
import test from "node:test";

import FireModel from "../../functions/node_modules/@shisyamo4131/air-firebase-v2/index.js";
import ServerAdapter from "../../functions/node_modules/@shisyamo4131/air-firebase-v2-server-adapter/index.js";
import { createUserEmailReservationId } from "../../functions/modules/auth/createTemporaryUser.js";
import {
  setupUserAccount,
  USER_ACCOUNT_SETUP_ERROR_CODES,
  UserAccountSetupError,
} from "../../functions/modules/auth/setupUserAccount.js";
import { UserAccountSetupPolicyError } from "../../functions/modules/auth/policies/userAccountSetupPolicy.js";

const AUTH_UID = "auth-a";
const AUTH_EMAIL = "user@example.com";
const COMPANY_ID = "company-a";
const TEMP_ID = "temp-a";
const EMPLOYEE_ID = "employee-a";
const EMAIL_RESERVATION_PATH =
  `UserEmailReservations/${createUserEmailReservationId(AUTH_EMAIL)}`;
const TEMP_PATH = `Companies/${COMPANY_ID}/Users/${TEMP_ID}`;
const AUTH_PATH = `Companies/${COMPANY_ID}/Users/${AUTH_UID}`;
const EMPLOYEE_RESERVATION_PATH =
  `Companies/${COMPANY_ID}/EmployeeUserReservations/${EMPLOYEE_ID}`;

function user(overrides = {}) {
  return {
    email: AUTH_EMAIL,
    displayName: "利用者",
    roles: ["manager"],
    disabled: false,
    companyId: COMPANY_ID,
    isAdmin: false,
    isTemporary: true,
    tagSize: "MEDIUM",
    receiveConfirmedArrangementNotification: false,
    receiveArrivedArrangementNotification: false,
    receiveLeavedArrangementNotification: false,
    ...overrides,
  };
}

function snapshot(data) {
  return { exists: data !== null, data: () => data };
}

function createDependencies({
  reservation = { companyId: COMPANY_ID, userId: TEMP_ID },
  sourceUser = user(),
  targetExists = false,
  employeeReservation = { userId: TEMP_ID },
  claimsError = null,
  claimsFailures = 0,
  persistWrites = false,
  transactionError = null,
  attempts = 1,
} = {}) {
  const calls = [];
  let currentReservation = reservation;
  let currentSourceUser = sourceUser;
  let currentTargetUser = targetExists
    ? user({ isTemporary: false })
    : null;
  let currentEmployeeReservation = employeeReservation;
  let remainingClaimsFailures = claimsFailures;

  function reference(path) {
    return { kind: "document", id: path.split("/").at(-1), path };
  }

  const firestore = {
    doc(path) {
      calls.push({ method: "firestore.doc", path });
      return reference(path);
    },
    collection(path) {
      const collection = {
        path,
        doc(id) {
          return reference(`${path}/${id}`);
        },
        withConverter() {
          return collection;
        },
      };
      return collection;
    },
    async runTransaction(callback) {
      calls.push({ method: "firestore.runTransaction" });
      if (transactionError) throw transactionError;
      let result;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const writes = [];
        const transaction = {
          async get(ref) {
            calls.push({ method: "transaction.get", path: ref.path, attempt });
            if (ref.path === EMAIL_RESERVATION_PATH) return snapshot(currentReservation);
            if (ref.path === TEMP_PATH) return snapshot(currentSourceUser);
            if (ref.path === AUTH_PATH) {
              if (currentReservation?.userId === AUTH_UID) {
                return snapshot(currentTargetUser ?? currentSourceUser);
              }
              return snapshot(currentTargetUser);
            }
            if (ref.path === EMPLOYEE_RESERVATION_PATH) {
              return snapshot(currentEmployeeReservation);
            }
            throw new Error(`Unexpected read: ${ref.path}`);
          },
          set(ref, data) {
            calls.push({ method: "transaction.set", path: ref.path, data, attempt });
            writes.push({ method: "set", path: ref.path, data });
          },
          delete(ref) {
            calls.push({ method: "transaction.delete", path: ref.path, attempt });
            writes.push({ method: "delete", path: ref.path });
          },
          update(ref, data) {
            calls.push({ method: "transaction.update", path: ref.path, data, attempt });
            writes.push({ method: "update", path: ref.path, data });
          },
        };
        result = await callback(transaction);
        if (persistWrites && attempt === attempts) {
          for (const write of writes) {
            if (write.method === "set" && write.path === AUTH_PATH) {
              currentTargetUser = { ...write.data };
            } else if (write.method === "delete" && write.path === TEMP_PATH) {
              currentSourceUser = null;
            } else if (
              write.method === "update" &&
              write.path === EMAIL_RESERVATION_PATH
            ) {
              currentReservation = { ...currentReservation, ...write.data };
            } else if (
              write.method === "update" &&
              write.path === EMPLOYEE_RESERVATION_PATH
            ) {
              currentEmployeeReservation = {
                ...currentEmployeeReservation,
                ...write.data,
              };
            }
          }
        }
      }
      return result;
    },
  };
  const auth = {
    async setCustomUserClaims(uid, claims) {
      calls.push({ method: "auth.setCustomUserClaims", uid, claims });
      if (remainingClaimsFailures > 0) {
        remainingClaimsFailures -= 1;
        throw claimsError ?? new Error("synthetic claims failure");
      }
      if (claimsError) throw claimsError;
    },
  };
  FireModel.setAdapter(new ServerAdapter(firestore));
  return { auth, firestore, calls };
}

function input(dependencies, overrides = {}) {
  return {
    auth: dependencies.auth,
    firestore: dependencies.firestore,
    authUid: AUTH_UID,
    authEmail: AUTH_EMAIL,
    authEmailVerified: true,
    ...overrides,
  };
}

async function assertSetupError(run, code) {
  await assert.rejects(run, (error) => {
    assert.ok(error instanceof UserAccountSetupError);
    assert.equal(error.code, code);
    return true;
  });
}

test("standalone temporary User converts and updates the email pointer atomically", async () => {
  const dependencies = createDependencies();
  const result = await setupUserAccount(input(dependencies));

  assert.deepEqual(result, {
    success: true,
    companyId: COMPANY_ID,
    userId: AUTH_UID,
  });
  assert.deepEqual(
    dependencies.calls.filter((call) => call.method === "transaction.get").map((call) => call.path),
    [EMAIL_RESERVATION_PATH, TEMP_PATH, AUTH_PATH],
  );
  assert.equal(
    dependencies.calls.find((call) => call.method === "transaction.set").path,
    AUTH_PATH,
  );
  const registeredUser = dependencies.calls.find(
    (call) => call.method === "transaction.set",
  ).data;
  assert.equal(registeredUser.email, AUTH_EMAIL);
  assert.equal(registeredUser.companyId, COMPANY_ID);
  assert.equal(registeredUser.isTemporary, false);
  assert.equal(registeredUser.isAdmin, false);
  assert.equal(registeredUser.disabled, false);
  assert.equal(
    dependencies.calls.find((call) => call.method === "transaction.delete").path,
    TEMP_PATH,
  );
  assert.deepEqual(
    dependencies.calls.find((call) => call.method === "transaction.update"),
    {
      method: "transaction.update",
      path: EMAIL_RESERVATION_PATH,
      data: { userId: AUTH_UID },
      attempt: 1,
    },
  );
  assert.equal(
    dependencies.calls.some(
      (call) =>
        call.method === "transaction.get" &&
        call.path === EMPLOYEE_RESERVATION_PATH,
    ),
    false,
  );
  assert.deepEqual(
    dependencies.calls.find((call) => call.method === "auth.setCustomUserClaims"),
    {
      method: "auth.setCustomUserClaims",
      uid: AUTH_UID,
      claims: { companyId: COMPANY_ID, isSuperUser: false },
    },
  );
});

test("Employee-linked conversion validates and updates both pointers", async () => {
  const dependencies = createDependencies({
    sourceUser: user({ employeeId: EMPLOYEE_ID }),
  });
  await setupUserAccount(input(dependencies));

  assert.equal(
    dependencies.calls.some(
      (call) => call.method === "transaction.get" && call.path === EMPLOYEE_RESERVATION_PATH,
    ),
    true,
  );
  assert.deepEqual(
    dependencies.calls.filter((call) => call.method === "transaction.update").map((call) => [call.path, call.data]),
    [
      [EMAIL_RESERVATION_PATH, { userId: AUTH_UID }],
      [EMPLOYEE_RESERVATION_PATH, { userId: AUTH_UID }],
    ],
  );
});

test("registered retry performs no Firestore writes and retries claims", async () => {
  const dependencies = createDependencies({
    reservation: { companyId: COMPANY_ID, userId: AUTH_UID },
    sourceUser: user({ isTemporary: false, employeeId: EMPLOYEE_ID }),
    employeeReservation: { userId: AUTH_UID },
  });
  await setupUserAccount(input(dependencies));

  assert.equal(
    dependencies.calls.some((call) =>
      ["transaction.set", "transaction.delete", "transaction.update"].includes(call.method),
    ),
    false,
  );
  assert.equal(
    dependencies.calls.filter((call) => call.method === "auth.setCustomUserClaims").length,
    1,
  );
});

test("a temporary User already using the Auth UID converts in place", async () => {
  const createdAt = new Date("2026-08-01T00:00:00.000Z");
  const dependencies = createDependencies({
    reservation: { companyId: COMPANY_ID, userId: AUTH_UID },
    sourceUser: user({ createdAt }),
  });
  await setupUserAccount(input(dependencies));

  assert.equal(
    dependencies.calls.filter((call) => call.method === "transaction.get").length,
    1 + 1,
  );
  assert.equal(
    dependencies.calls.find((call) => call.method === "transaction.set").path,
    AUTH_PATH,
  );
  const updatedUser = dependencies.calls.find(
    (call) => call.method === "transaction.set",
  ).data;
  assert.equal(updatedUser.isTemporary, false);
  assert.equal(updatedUser.createdAt.getTime(), createdAt.getTime());
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.delete"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("identity errors occur before Firestore reads", async () => {
  const dependencies = createDependencies();
  await assert.rejects(
    () => setupUserAccount(input(dependencies, { authEmailVerified: false })),
    UserAccountSetupPolicyError,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "firestore.runTransaction"),
    false,
  );
});

test("missing reservation and reserved User fail without writes", async () => {
  for (const [options, code] of [
    [{ reservation: null }, "email-reservation-not-found"],
    [{ sourceUser: null }, "target-user-not-found"],
  ]) {
    const dependencies = createDependencies(options);
    await assertSetupError(() => setupUserAccount(input(dependencies)), code);
    assert.equal(
      dependencies.calls.some((call) => call.method.startsWith("transaction.") && call.method !== "transaction.get"),
      false,
    );
  }
});

test("malformed reservation and User states fail closed", async () => {
  for (const options of [
    { reservation: { companyId: COMPANY_ID, userId: TEMP_ID, extra: true } },
    { reservation: { companyId: "company/a", userId: TEMP_ID } },
    { sourceUser: user({ companyId: "company-b" }) },
    { sourceUser: user({ email: "other@example.com" }) },
    { sourceUser: user({ email: "User@Example.COM" }) },
    { sourceUser: user({ email: " user@example.com " }) },
    { sourceUser: user({ isAdmin: true }) },
    { sourceUser: user({ employeeId: "" }) },
  ]) {
    const dependencies = createDependencies(options);
    await assert.rejects(
      () => setupUserAccount(input(dependencies)),
      UserAccountSetupPolicyError,
    );
    assert.equal(
      dependencies.calls.some((call) => call.method === "transaction.set"),
      false,
    );
  }
});

test("existing Auth UID target is never overwritten", async () => {
  const dependencies = createDependencies({ targetExists: true });
  await assertSetupError(
    () => setupUserAccount(input(dependencies)),
    USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_ALREADY_EXISTS,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.set"),
    false,
  );
});

test("Employee reservation must exist and point to the temporary User", async () => {
  for (const [employeeReservation, code] of [
    [null, "employee-reservation-not-found"],
    [{ userId: TEMP_ID, extra: true }, "employee-reservation-invalid"],
    [{ userId: " temp-a" }, "employee-reservation-invalid"],
    [{ userId: "temp/a" }, "employee-reservation-invalid"],
    [{ userId: "other" }, "employee-reservation-mismatch"],
  ]) {
    const dependencies = createDependencies({
      sourceUser: user({ employeeId: EMPLOYEE_ID }),
      employeeReservation,
    });
    await assertSetupError(() => setupUserAccount(input(dependencies)), code);
    assert.equal(
      dependencies.calls.some((call) => call.method === "transaction.set"),
      false,
    );
  }
});

test("registered retry also requires an exact Employee reservation pointer", async () => {
  for (const [employeeReservation, code] of [
    [null, "employee-reservation-not-found"],
    [{ userId: AUTH_UID, extra: true }, "employee-reservation-invalid"],
    [{ userId: TEMP_ID }, "employee-reservation-mismatch"],
  ]) {
    const dependencies = createDependencies({
      reservation: { companyId: COMPANY_ID, userId: AUTH_UID },
      sourceUser: user({
        isTemporary: false,
        employeeId: EMPLOYEE_ID,
      }),
      employeeReservation,
    });
    await assertSetupError(() => setupUserAccount(input(dependencies)), code);
    assert.equal(
      dependencies.calls.some((call) => call.method === "transaction.set"),
      false,
    );
  }
});

test("all Firestore reads precede writes", async () => {
  const dependencies = createDependencies({
    sourceUser: user({ employeeId: EMPLOYEE_ID }),
  });
  await setupUserAccount(input(dependencies));
  const transactionCalls = dependencies.calls.filter((call) => call.method.startsWith("transaction."));
  const firstWrite = transactionCalls.findIndex((call) => call.method !== "transaction.get");
  assert.equal(
    transactionCalls.slice(firstWrite + 1).some((call) => call.method === "transaction.get"),
    false,
  );
});

test("claims failure occurs after complete Firestore pointer conversion", async () => {
  const claimsError = new Error("synthetic claims failure");
  const dependencies = createDependencies({ claimsError });
  await assert.rejects(
    () => setupUserAccount(input(dependencies)),
    (error) => error === claimsError,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    true,
  );
});

test("claims failure is recoverable through a registered retry on the same state", async () => {
  const dependencies = createDependencies({
    sourceUser: user({ employeeId: EMPLOYEE_ID }),
    claimsFailures: 1,
    persistWrites: true,
  });

  await assert.rejects(
    () => setupUserAccount(input(dependencies)),
    /synthetic claims failure/,
  );
  const writesAfterFirstCall = dependencies.calls.filter((call) =>
    ["transaction.set", "transaction.delete", "transaction.update"].includes(
      call.method,
    ),
  ).length;

  await setupUserAccount(input(dependencies));

  assert.equal(
    dependencies.calls.filter((call) =>
      ["transaction.set", "transaction.delete", "transaction.update"].includes(
        call.method,
      ),
    ).length,
    writesAfterFirstCall,
  );
  assert.equal(
    dependencies.calls.filter(
      (call) => call.method === "auth.setCustomUserClaims",
    ).length,
    2,
  );
});

test("transaction failure never proceeds to custom claims", async () => {
  const transactionError = new Error("synthetic transaction failure");
  const dependencies = createDependencies({ transactionError });
  await assert.rejects(
    () => setupUserAccount(input(dependencies)),
    (error) => error === transactionError,
  );
  assert.equal(
    dependencies.calls.some(
      (call) => call.method === "auth.setCustomUserClaims",
    ),
    false,
  );
});

test("transaction retries repeat stable writes and set claims once", async () => {
  const dependencies = createDependencies({ attempts: 2 });
  await setupUserAccount(input(dependencies));
  assert.equal(
    dependencies.calls.filter((call) => call.method === "transaction.set").length,
    2,
  );
  assert.equal(
    dependencies.calls.filter((call) => call.method === "auth.setCustomUserClaims").length,
    1,
  );
});
