import assert from "node:assert/strict";
import test from "node:test";
import { createUserEmailReservationId } from "../../functions/modules/auth/createTemporaryUser.js";
import {
  CHECK_EMAIL_AVAILABILITY_ERROR_CODES,
  CheckEmailAvailabilityError,
  checkEmailAvailability,
} from "../../functions/modules/auth/checkEmailAvailability.js";

const EMAIL = "admin@example.com";
const RESERVATION_PATH = `UserEmailReservations/${createUserEmailReservationId(EMAIL)}`;

function dependencies({ authExists = false, authError = null, reservationExists = false } = {}) {
  const calls = [];
  const auth = {
    async getUserByEmail(email) {
      calls.push({ method: "auth.getUserByEmail", email });
      if (authError) throw authError;
      if (authExists) return { uid: "existing" };
      throw { code: "auth/user-not-found" };
    },
  };
  const firestore = {
    doc(path) {
      calls.push({ method: "firestore.doc", path });
      return {
        async get() {
          calls.push({ method: "document.get", path });
          return { exists: reservationExists };
        },
      };
    },
  };
  return { auth, firestore, calls };
}

async function assertError(run, code) {
  await assert.rejects(run, (error) => {
    assert.ok(error instanceof CheckEmailAvailabilityError);
    assert.equal(error.code, code);
    return true;
  });
}

test("input canonicalization occurs before service access", async () => {
  const deps = dependencies();
  const result = await checkEmailAvailability({
      auth: deps.auth,
      firestore: deps.firestore,
      email: " Admin@Example.COM ",
    });
  assert.deepEqual(result, { available: true });
  assert.deepEqual(Object.keys(result), ["available"]);
  assert.deepEqual(deps.calls, [
    { method: "auth.getUserByEmail", email: EMAIL },
    { method: "firestore.doc", path: RESERVATION_PATH },
    { method: "document.get", path: RESERVATION_PATH },
  ]);

  for (const email of [undefined, null, "", "invalid", 1]) {
    const invalid = dependencies();
    await assertError(
      () => checkEmailAvailability({ auth: invalid.auth, firestore: invalid.firestore, email }),
      CHECK_EMAIL_AVAILABILITY_ERROR_CODES.INPUT_INVALID,
    );
    assert.deepEqual(invalid.calls, []);
  }
});

test("Auth and reservation existence use the same unavailable result", async () => {
  for (const options of [
    { authExists: true },
    { reservationExists: true },
  ]) {
    const deps = dependencies(options);
    await assertError(
      () => checkEmailAvailability({ auth: deps.auth, firestore: deps.firestore, email: EMAIL }),
      CHECK_EMAIL_AVAILABILITY_ERROR_CODES.EMAIL_EXISTS,
    );
    if (options.authExists) {
      assert.equal(deps.calls.some((call) => call.method === "firestore.doc"), false);
    }
  }
});

test("Auth errors other than user-not-found are not hidden", async () => {
  const invalid = dependencies({ authError: { code: "auth/invalid-email" } });
  await assertError(
    () => checkEmailAvailability({ auth: invalid.auth, firestore: invalid.firestore, email: EMAIL }),
    CHECK_EMAIL_AVAILABILITY_ERROR_CODES.INPUT_INVALID,
  );
  const unavailable = new Error("synthetic Auth outage");
  const failed = dependencies({ authError: unavailable });
  await assert.rejects(
    () => checkEmailAvailability({ auth: failed.auth, firestore: failed.firestore, email: EMAIL }),
    (error) => error === unavailable,
  );
  assert.equal(failed.calls.some((call) => call.method === "firestore.doc"), false);

  const nestedNotFound = dependencies({
    authError: { errorInfo: { code: "auth/user-not-found" } },
  });
  assert.deepEqual(
    await checkEmailAvailability({
      auth: nestedNotFound.auth,
      firestore: nestedNotFound.firestore,
      email: EMAIL,
    }),
    { available: true },
  );
});

test("invalid service dependencies fail closed", async () => {
  await assertError(
    () => checkEmailAvailability({ auth: {}, firestore: {}, email: EMAIL }),
    CHECK_EMAIL_AVAILABILITY_ERROR_CODES.AUTH_SERVICE_INVALID,
  );
  await assertError(
    () => checkEmailAvailability({ auth: dependencies().auth, firestore: {}, email: EMAIL }),
    CHECK_EMAIL_AVAILABILITY_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
  );
});
