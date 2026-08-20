import assert from "node:assert/strict";
import test from "node:test";
import FireModel from "../../functions/node_modules/@shisyamo4131/air-firebase-v2/index.js";
import ServerAdapter from "../../functions/node_modules/@shisyamo4131/air-firebase-v2-server-adapter/index.js";
import { createUserEmailReservationId } from "../../functions/modules/auth/createTemporaryUser.js";
import {
  CREATE_ADMIN_ACCOUNT_ERROR_CODES,
  CreateAdminAccountError,
  createAdminAccount,
} from "../../functions/modules/auth/createAdminAccount.js";
import { InitialAdminAccountPolicyError } from "../../functions/modules/auth/initialAdminAccountPolicy.js";

const UID = "auth-a";
const EMAIL = "admin@example.com";
const COMPANY_ID = "company-new";
const RESERVATION_PATH =
  `UserEmailReservations/${createUserEmailReservationId(EMAIL)}`;
const COMPANY_PATH = `Companies/${COMPANY_ID}`;
const USER_PATH = `${COMPANY_PATH}/Users/${UID}`;
const INPUT = {
  companyName: "警備会社",
  companyNameKana: "ケイビガイシャ",
  displayName: "管理者",
};

function adminUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    email: EMAIL,
    isAdmin: true,
    isTemporary: false,
    disabled: false,
    ...overrides,
  };
}

function authUser(claims = {}) {
  return {
    uid: UID,
    email: EMAIL,
    emailVerified: true,
    disabled: false,
    customClaims: claims,
  };
}

function snapshot(data) {
  return { exists: data !== null, data: () => data };
}

function dependencies({
  reservation = null,
  existingUser = null,
  existingCompany = null,
  candidateCompanyExists = false,
  candidateUserExists = false,
  attempts = 1,
  firstAuthUser = authUser(),
  latestAuthUser = firstAuthUser,
  claimsError = null,
  claimsFailures = 0,
  persistWrites = false,
  transactionError = null,
} = {}) {
  const calls = [];
  let authReads = 0;
  let autoIdAllocations = 0;
  let remainingClaimsFailures = claimsFailures;
  let currentReservation = reservation;
  let currentExistingUser = existingUser;
  let currentExistingCompany = existingCompany;
  function ref(path) {
    return { path, id: path.split("/").at(-1) };
  }
  const firestore = {
    doc(path) {
      calls.push({ method: "firestore.doc", path });
      return ref(path);
    },
    collection(path) {
      const collection = {
        path,
        doc(id) {
          const resolvedId =
            id ??
            (autoIdAllocations++ === 0
              ? COMPANY_ID
              : `${COMPANY_ID}-${autoIdAllocations}`);
          calls.push({
            method: "collection.doc",
            path,
            id,
            resolvedId,
          });
          return ref(`${path}/${resolvedId}`);
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
          async get(reference) {
            calls.push({ method: "transaction.get", path: reference.path, attempt });
            if (reference.path === RESERVATION_PATH) return snapshot(currentReservation);
            if (reference.path === COMPANY_PATH) {
              return snapshot(
                currentReservation
                  ? currentExistingCompany
                  : candidateCompanyExists
                    ? {}
                    : null,
              );
            }
            if (reference.path === USER_PATH) {
              return snapshot(
                currentReservation
                  ? currentExistingUser
                  : candidateUserExists
                    ? {}
                    : null,
              );
            }
            throw new Error(`Unexpected read: ${reference.path}`);
          },
          set(reference, data) {
            calls.push({ method: "transaction.set", path: reference.path, data, attempt });
            writes.push({ method: "set", path: reference.path, data });
          },
          create(reference, data) {
            calls.push({ method: "transaction.create", path: reference.path, data, attempt });
            writes.push({ method: "create", path: reference.path, data });
          },
        };
        result = await callback(transaction);
        if (persistWrites && attempt === attempts) {
          for (const write of writes) {
            if (write.method === "set" && write.path === COMPANY_PATH) {
              currentExistingCompany = { ...write.data };
            } else if (write.method === "set" && write.path === USER_PATH) {
              currentExistingUser = { ...write.data };
            } else if (
              write.method === "create" &&
              write.path === RESERVATION_PATH
            ) {
              currentReservation = { ...write.data };
            }
          }
        }
      }
      return result;
    },
  };
  const auth = {
    async getUser(uid) {
      calls.push({ method: "auth.getUser", uid });
      authReads += 1;
      return authReads === 1 ? firstAuthUser : latestAuthUser;
    },
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

function request(deps, overrides = {}) {
  return {
    auth: deps.auth,
    firestore: deps.firestore,
    tokenUid: UID,
    tokenEmail: "Admin@Example.COM",
    tokenEmailVerified: true,
    input: INPUT,
    ...overrides,
  };
}

test("new initial administrator creates Company, User, and reservation atomically", async () => {
  const deps = dependencies();
  assert.deepEqual(await createAdminAccount(request(deps)), {
    success: true,
    companyId: COMPANY_ID,
    userId: UID,
  });
  assert.deepEqual(
    deps.calls.filter((call) => call.method === "transaction.get").map((call) => call.path),
    [RESERVATION_PATH, COMPANY_PATH, USER_PATH],
  );
  assert.deepEqual(
    deps.calls.filter((call) => call.method === "transaction.set").map((call) => call.path),
    [COMPANY_PATH, USER_PATH],
  );
  assert.deepEqual(
    deps.calls.find((call) => call.method === "transaction.create"),
    {
      method: "transaction.create",
      path: RESERVATION_PATH,
      data: { companyId: COMPANY_ID, userId: UID },
      attempt: 1,
    },
  );
  assert.deepEqual(
    deps.calls.find((call) => call.method === "auth.setCustomUserClaims").claims,
    { companyId: COMPANY_ID, isSuperUser: false },
  );
});

test("Firestore retries keep one preallocated Company ID", async () => {
  const deps = dependencies({ attempts: 2 });
  await createAdminAccount(request(deps));
  assert.deepEqual(
    new Set(
      deps.calls
        .filter((call) => call.method === "transaction.set")
        .map((call) => call.path),
    ),
    new Set([COMPANY_PATH, USER_PATH]),
  );
  assert.equal(deps.calls.filter((call) => call.method === "auth.getUser").length, 2);
  assert.equal(
    deps.calls.filter(
      (call) => call.method === "collection.doc" && call.id === undefined,
    ).length,
    1,
  );
});

test("matching reservation resumes claims without Firestore writes", async () => {
  const deps = dependencies({
    reservation: { companyId: COMPANY_ID, userId: UID },
    existingUser: adminUser(),
    existingCompany: { companyName: "警備会社", companyNameKana: "ケイビ" },
    firstAuthUser: authUser({ companyId: COMPANY_ID }),
  });
  await createAdminAccount(request(deps));
  assert.equal(
    deps.calls.some((call) => ["transaction.set", "transaction.create"].includes(call.method)),
    false,
  );
});

test("conflicts and malformed retry state fail before writes and claims", async () => {
  for (const options of [
    { reservation: { companyId: COMPANY_ID, userId: "other" } },
    {
      reservation: { companyId: COMPANY_ID, userId: UID },
      existingUser: adminUser({ disabled: true }),
      existingCompany: { companyName: "警備会社", companyNameKana: "ケイビ" },
    },
    { candidateCompanyExists: true },
  ]) {
    const deps = dependencies(options);
    await assert.rejects(
      () => createAdminAccount(request(deps)),
      (error) =>
        error instanceof InitialAdminAccountPolicyError ||
        (error instanceof CreateAdminAccountError &&
          error.code === CREATE_ADMIN_ACCOUNT_ERROR_CODES.CANDIDATE_CONFLICT),
    );
    assert.equal(
      deps.calls.some((call) => ["transaction.set", "transaction.create", "auth.setCustomUserClaims"].includes(call.method)),
      false,
    );
  }
});

test("transaction failure never sets claims and post-commit Auth conflict fails closed", async () => {
  const transactionError = new Error("synthetic transaction failure");
  const failed = dependencies({ transactionError });
  await assert.rejects(() => createAdminAccount(request(failed)), transactionError);
  assert.equal(failed.calls.some((call) => call.method === "auth.setCustomUserClaims"), false);

  const changed = dependencies({
    latestAuthUser: authUser({ companyId: "other-company" }),
  });
  await assert.rejects(
    () => createAdminAccount(request(changed)),
    InitialAdminAccountPolicyError,
  );
  assert.equal(changed.calls.some((call) => call.method === "auth.setCustomUserClaims"), false);
});

test("claims failure resumes from the committed reservation without new writes", async () => {
  const deps = dependencies({ claimsFailures: 1, persistWrites: true });
  await assert.rejects(
    () => createAdminAccount(request(deps)),
    /synthetic claims failure/,
  );
  const firstWrites = deps.calls.filter((call) =>
    ["transaction.set", "transaction.create"].includes(call.method),
  ).length;

  const result = await createAdminAccount(request(deps));
  assert.equal(result.companyId, COMPANY_ID);
  assert.equal(
    deps.calls.filter((call) =>
      ["transaction.set", "transaction.create"].includes(call.method),
    ).length,
    firstWrites,
  );
  assert.equal(
    deps.calls.filter((call) => call.method === "auth.setCustomUserClaims").length,
    2,
  );
});

test("a response-loss retry reuses the committed reservation without new writes", async () => {
  const deps = dependencies({ persistWrites: true });
  const first = await createAdminAccount(request(deps));
  const firstWrites = deps.calls.filter((call) =>
    ["transaction.set", "transaction.create"].includes(call.method),
  ).length;
  const second = await createAdminAccount(request(deps));
  assert.deepEqual(second, first);
  assert.equal(
    deps.calls.filter((call) =>
      ["transaction.set", "transaction.create"].includes(call.method),
    ).length,
    firstWrites,
  );
});
