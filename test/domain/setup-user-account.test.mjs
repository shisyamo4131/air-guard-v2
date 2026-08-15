import assert from "node:assert/strict";
import test from "node:test";

import FireModel from "../../functions/node_modules/@shisyamo4131/air-firebase-v2/index.js";
import ServerAdapter from "../../functions/node_modules/@shisyamo4131/air-firebase-v2-server-adapter/index.js";

import {
  setupUserAccount,
  USER_ACCOUNT_SETUP_ERROR_CODES,
  UserAccountSetupError,
} from "../../functions/modules/auth/setupUserAccount.js";
import {
  USER_ACCOUNT_SETUP_POLICY_ERROR_CODES,
  UserAccountSetupPolicyError,
} from "../../functions/modules/auth/userAccountSetupPolicy.js";

const AUTH_UID = "user-a";
const AUTH_EMAIL = "user@example.com";
const COMPANY_ID = "company-a";
const TEMPORARY_USER_ID = "temporary-user-a";
const TEMPORARY_USER_PATH = `Companies/${COMPANY_ID}/Users/${TEMPORARY_USER_ID}`;
const REGISTERED_USER_PATH = `Companies/${COMPANY_ID}/Users/${AUTH_UID}`;

function createTemporaryUserData(overrides = {}) {
  return {
    docId: TEMPORARY_USER_ID,
    uid: "admin-a",
    email: AUTH_EMAIL,
    displayName: "Test",
    roles: ["employee"],
    disabled: false,
    companyId: COMPANY_ID,
    isAdmin: false,
    isTemporary: true,
    tagSize: "MEDIUM",
    ...overrides,
  };
}

function createDocumentReference(path, calls) {
  const pathSegments = path.split("/");
  const collectionPath = pathSegments.slice(0, -1).join("/");

  return {
    id: pathSegments.at(-1),
    kind: "document",
    path,
    parent: {
      path: collectionPath,
      doc(id) {
        const childPath = `${collectionPath}/${id}`;
        calls.push({ method: "collection.doc", path: childPath });
        return createDocumentReference(childPath, calls);
      },
    },
  };
}

function createDocumentSnapshot({
  id = TEMPORARY_USER_ID,
  path = TEMPORARY_USER_PATH,
  data = createTemporaryUserData(),
  exists = true,
  calls,
}) {
  return {
    id,
    exists,
    ref: createDocumentReference(path, calls),
    data() {
      return data;
    },
  };
}

function createDependencies({
  temporaryUsers,
  registeredUserExists = false,
  transactionError,
  setError,
  deleteError,
  claimsError,
  attempts = 1,
} = {}) {
  const calls = [];
  const resolvedTemporaryUsers =
    temporaryUsers ?? [createDocumentSnapshot({ calls })];

  const auth = {
    async setCustomUserClaims(uid, claims) {
      calls.push({ method: "auth.setCustomUserClaims", uid, claims });
      if (claimsError) throw claimsError;
    },
  };

  const firestore = {
    collection(path) {
      calls.push({ method: "firestore.collection", path });

      const collectionReference = {
        path,
        withConverter(converter) {
          calls.push({ method: "collection.withConverter", path, converter });
          return collectionReference;
        },
        doc(id) {
          const documentPath = `${path}/${id}`;
          calls.push({ method: "collection.doc", path: documentPath });
          return createDocumentReference(documentPath, calls);
        },
      };

      return collectionReference;
    },
    collectionGroup(name) {
      calls.push({ method: "firestore.collectionGroup", name });

      const query = {
        kind: "query",
        name,
        filters: [],
        where(field, operator, value) {
          query.filters.push({ field, operator, value });
          calls.push({ method: "query.where", field, operator, value });
          return query;
        },
      };

      return query;
    },
    async runTransaction(callback) {
      calls.push({ method: "firestore.runTransaction" });
      if (transactionError) throw transactionError;

      let result;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const transaction = {
          async get(reference) {
            calls.push({ method: "transaction.get", reference, attempt });

            if (reference.kind === "query") {
              return { docs: resolvedTemporaryUsers };
            }

            if (reference.path === REGISTERED_USER_PATH) {
              return { exists: registeredUserExists };
            }

            throw new Error(`Unexpected reference: ${reference.path}`);
          },
          set(reference, data) {
            calls.push({
              method: "transaction.set",
              path: reference.path,
              data,
              attempt,
            });
            if (setError) throw setError;
          },
          delete(reference) {
            calls.push({
              method: "transaction.delete",
              path: reference.path,
              attempt,
            });
            if (deleteError) throw deleteError;
          },
        };

        result = await callback(transaction);
      }

      return result;
    },
  };

  FireModel.setAdapter(new ServerAdapter(firestore));

  return { auth, firestore, calls };
}

function createInput(dependencies, overrides = {}) {
  return {
    auth: dependencies.auth,
    firestore: dependencies.firestore,
    authUid: AUTH_UID,
    authEmail: AUTH_EMAIL,
    authEmailVerified: true,
    ...overrides,
  };
}

async function assertSetupError(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UserAccountSetupError);
    assert.equal(error.name, "UserAccountSetupError");
    assert.equal(error.code, expectedCode);
    return true;
  });
}

async function assertSetupPolicyError(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UserAccountSetupPolicyError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("setup error preserves its code and cause", () => {
  const cause = new Error("synthetic cause");
  const error = new UserAccountSetupError(
    USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_ALREADY_EXISTS,
    "synthetic message",
    { cause },
  );

  assert.equal(error.name, "UserAccountSetupError");
  assert.equal(
    error.code,
    USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_ALREADY_EXISTS,
  );
  assert.equal(error.cause, cause);
});

test("setup error codes are frozen", () => {
  assert.equal(Object.isFrozen(USER_ACCOUNT_SETUP_ERROR_CODES), true);
});

test("verified email completes the unique pre-registration", async () => {
  const dependencies = createDependencies();

  const result = await setupUserAccount(createInput(dependencies));

  assert.deepEqual(result, {
    success: true,
    companyId: COMPANY_ID,
    userId: AUTH_UID,
  });
  assert.deepEqual(
    dependencies.calls
      .filter((call) => call.method === "query.where")
      .map(({ field, operator, value }) => ({ field, operator, value })),
    [
      { field: "email", operator: "==", value: AUTH_EMAIL },
      { field: "isTemporary", operator: "==", value: true },
    ],
  );

  const createCall = dependencies.calls.find(
    (call) => call.method === "transaction.set",
  );
  const createdUser = createCall.data;
  assert.equal(createCall.path, REGISTERED_USER_PATH);
  assert.equal(createdUser.constructor.name, "User");
  assert.equal(createdUser.docId, AUTH_UID);
  assert.equal(createdUser.uid, "cloud functions");
  assert.equal(createdUser.companyId, COMPANY_ID);
  assert.equal(createdUser.isTemporary, false);
  assert.ok(createdUser.createdAt instanceof Date);
  assert.ok(createdUser.updatedAt instanceof Date);
  assert.match(createdUser.createdAt.toISOString(), /Z$/);
  assert.match(createdUser.updatedAt.toISOString(), /Z$/);

  assert.deepEqual(
    dependencies.calls.find((call) => call.method === "transaction.delete"),
    {
      method: "transaction.delete",
      path: TEMPORARY_USER_PATH,
      attempt: 1,
    },
  );
  assert.deepEqual(
    dependencies.calls.find(
      (call) => call.method === "auth.setCustomUserClaims",
    ),
    {
      method: "auth.setCustomUserClaims",
      uid: AUTH_UID,
      claims: { companyId: COMPANY_ID, isSuperUser: false },
    },
  );
});

test("required account identity fields must be present", async () => {
  const dependencies = createDependencies();

  await assertSetupError(
    setupUserAccount(createInput(dependencies, { authUid: "" })),
    USER_ACCOUNT_SETUP_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  assert.deepEqual(dependencies.calls, []);
});

test("Auth service must provide custom claim updates", async () => {
  const dependencies = createDependencies();

  await assertSetupError(
    setupUserAccount(createInput(dependencies, { auth: {} })),
    USER_ACCOUNT_SETUP_ERROR_CODES.AUTH_SERVICE_INVALID,
  );
  assert.deepEqual(dependencies.calls, []);
});

test("Firestore service must provide query and transaction methods", async () => {
  const dependencies = createDependencies();

  await assertSetupError(
    setupUserAccount(createInput(dependencies, { firestore: {} })),
    USER_ACCOUNT_SETUP_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
  );
  assert.deepEqual(dependencies.calls, []);
});

test("unverified email cannot complete pre-registration", async () => {
  const dependencies = createDependencies();

  await assertSetupPolicyError(
    setupUserAccount(
      createInput(dependencies, { authEmailVerified: false }),
    ),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.EMAIL_NOT_VERIFIED,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.set"),
    false,
  );
  assert.equal(
    dependencies.calls.some(
      (call) => call.method === "auth.setCustomUserClaims",
    ),
    false,
  );
});

test("missing pre-registration is rejected without writes", async () => {
  const dependencies = createDependencies({ temporaryUsers: [] });

  await assertSetupPolicyError(
    setupUserAccount(createInput(dependencies)),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_FOUND,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.set"),
    false,
  );
});

test("duplicate pre-registrations are rejected without writes", async () => {
  const calls = [];
  const dependencies = createDependencies({
    temporaryUsers: [
      createDocumentSnapshot({ calls }),
      createDocumentSnapshot({
        id: "temporary-user-b",
        path: "Companies/company-b/Users/temporary-user-b",
        data: createTemporaryUserData({
          docId: "temporary-user-b",
          companyId: "company-b",
        }),
        calls,
      }),
    ],
  });

  await assertSetupPolicyError(
    setupUserAccount(createInput(dependencies)),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_NOT_UNIQUE,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.set"),
    false,
  );
});

test("pre-registration outside the Companies User path is rejected", async () => {
  const calls = [];
  const dependencies = createDependencies({
    temporaryUsers: [
      createDocumentSnapshot({
        path: `Other/${COMPANY_ID}/Users/${TEMPORARY_USER_ID}`,
        calls,
      }),
    ],
  });

  await assertSetupPolicyError(
    setupUserAccount(createInput(dependencies)),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_STATE_INVALID,
  );
});

test("pre-registration company must match its document path", async () => {
  const calls = [];
  const dependencies = createDependencies({
    temporaryUsers: [
      createDocumentSnapshot({
        data: createTemporaryUserData({ companyId: "company-b" }),
        calls,
      }),
    ],
  });

  await assertSetupPolicyError(
    setupUserAccount(createInput(dependencies)),
    USER_ACCOUNT_SETUP_POLICY_ERROR_CODES.REGISTRATION_COMPANY_MISMATCH,
  );
});

test("existing registered User document is not overwritten", async () => {
  const dependencies = createDependencies({ registeredUserExists: true });

  await assertSetupError(
    setupUserAccount(createInput(dependencies)),
    USER_ACCOUNT_SETUP_ERROR_CODES.TARGET_USER_ALREADY_EXISTS,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.set"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.delete"),
    false,
  );
});

test("transaction failure is propagated without setting claims", async () => {
  const transactionError = new Error("synthetic transaction failure");
  const dependencies = createDependencies({ transactionError });

  await assert.rejects(
    setupUserAccount(createInput(dependencies)),
    (error) => error === transactionError,
  );
  assert.equal(
    dependencies.calls.some(
      (call) => call.method === "auth.setCustomUserClaims",
    ),
    false,
  );
});

test("document creation failure is propagated without setting claims", async () => {
  const setError = new Error("synthetic create failure");
  const dependencies = createDependencies({ setError });

  await assert.rejects(
    setupUserAccount(createInput(dependencies)),
    (error) => error === setError,
  );
  assert.equal(
    dependencies.calls.some(
      (call) => call.method === "auth.setCustomUserClaims",
    ),
    false,
  );
});

test("claim failure is propagated after the Firestore transaction", async () => {
  const claimsError = new Error("synthetic claims failure");
  const dependencies = createDependencies({ claimsError });

  await assert.rejects(
    setupUserAccount(createInput(dependencies)),
    (error) => error === claimsError,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.set"),
    true,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.delete"),
    true,
  );
});

test("transaction retry repeats Firestore work and sets claims once", async () => {
  const dependencies = createDependencies({ attempts: 2 });

  await setupUserAccount(createInput(dependencies));

  assert.equal(
    dependencies.calls.filter(
      (call) => call.method === "transaction.set",
    ).length,
    2,
  );
  assert.equal(
    dependencies.calls.filter(
      (call) => call.method === "transaction.delete",
    ).length,
    2,
  );
  assert.equal(
    dependencies.calls.filter(
      (call) => call.method === "auth.setCustomUserClaims",
    ).length,
    1,
  );
});
