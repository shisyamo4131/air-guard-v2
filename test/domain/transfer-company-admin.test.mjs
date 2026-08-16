import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPANY_ADMIN_TRANSFER_ERROR_CODES,
  CompanyAdminTransferError,
  transferCompanyAdmin,
} from "../../functions/modules/auth/transferCompanyAdmin.js";
import {
  COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES,
  CompanyAdminTransferPolicyError,
} from "../../functions/modules/auth/companyAdminTransferPolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/userAuthCompanyPolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "admin-a";
const TARGET_UID = "user-a";
const SOURCE_PATH = `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`;
const TARGET_PATH = `Companies/${COMPANY_ID}/Users/${TARGET_UID}`;
const USERS_PATH = `Companies/${COMPANY_ID}/Users`;

function createAuthUser(uid, overrides = {}) {
  return {
    uid,
    customClaims: { companyId: COMPANY_ID, isSuperUser: false },
    disabled: false,
    ...overrides,
  };
}

function createSourceUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    isAdmin: true,
    disabled: false,
    ...overrides,
  };
}

function createTargetUser(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    isAdmin: false,
    disabled: false,
    roles: ["existing-role"],
    ...overrides,
  };
}

function createDependencies({
  targetAuthUser = createAuthUser(TARGET_UID),
  sourceUser = createSourceUser(),
  targetUser = createTargetUser(),
  sourceExists = true,
  targetExists = true,
  currentAdminUids = [ACTOR_UID],
  authErrors = new Map(),
  transactionError,
} = {}) {
  const calls = [];

  const auth = {
    async getUser(uid) {
      calls.push({ method: "auth.getUser", uid });
      if (authErrors.has(uid)) {
        throw authErrors.get(uid);
      }
      if (uid === TARGET_UID) return targetAuthUser;
      throw new Error(`Unexpected Auth uid: ${uid}`);
    },
  };

  const firestore = {
    doc(path) {
      calls.push({ method: "firestore.doc", path });
      return { kind: "document", path };
    },
    collection(path) {
      calls.push({ method: "firestore.collection", path });
      return {
        where(field, operator, value) {
          calls.push({
            method: "query.where",
            path,
            field,
            operator,
            value,
          });
          return { kind: "query", path, field, operator, value };
        },
      };
    },
    async runTransaction(callback) {
      calls.push({ method: "firestore.runTransaction" });
      if (transactionError) {
        throw transactionError;
      }

      const transaction = {
        async get(reference) {
          calls.push({ method: "transaction.get", reference });

          if (reference.kind === "query") {
            return {
              docs: currentAdminUids.map((id) => ({ id })),
            };
          }

          if (reference.path === SOURCE_PATH) {
            return {
              exists: sourceExists,
              data: () => sourceUser,
            };
          }

          if (reference.path === TARGET_PATH) {
            return {
              exists: targetExists,
              data: () => targetUser,
            };
          }

          throw new Error(`Unexpected reference: ${reference.path}`);
        },
        update(reference, data) {
          calls.push({ method: "transaction.update", reference, data });
        },
      };

      return callback(transaction);
    },
  };

  return { auth, firestore, calls };
}

function createInput(dependencies, overrides = {}) {
  return {
    auth: dependencies.auth,
    firestore: dependencies.firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    fromUid: ACTOR_UID,
    toUid: TARGET_UID,
    ...overrides,
  };
}

async function assertTransferError(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CompanyAdminTransferError);
    assert.equal(error.name, "CompanyAdminTransferError");
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("company admin transfer error preserves its code and cause", () => {
  const cause = new Error("synthetic cause");
  const error = new CompanyAdminTransferError(
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.SOURCE_USER_NOT_FOUND,
    "synthetic message",
    { cause },
  );

  assert.equal(error.name, "CompanyAdminTransferError");
  assert.equal(
    error.code,
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.SOURCE_USER_NOT_FOUND,
  );
  assert.equal(error.cause, cause);
});

test("company admin transfer error codes are frozen", () => {
  assert.equal(Object.isFrozen(COMPANY_ADMIN_TRANSFER_ERROR_CODES), true);
});

test("active sole administrator transfers authority atomically", async () => {
  const dependencies = createDependencies();

  const result = await transferCompanyAdmin(createInput(dependencies));

  assert.deepEqual(result, {
    success: true,
    from: ACTOR_UID,
    to: TARGET_UID,
  });
  assert.deepEqual(
    dependencies.calls
      .filter((call) => call.method === "auth.getUser")
      .map((call) => call.uid),
    [TARGET_UID],
  );
  assert.deepEqual(
    dependencies.calls
      .filter((call) => call.method === "firestore.doc")
      .map((call) => call.path),
    [SOURCE_PATH, TARGET_PATH],
  );
  assert.deepEqual(
    dependencies.calls.find((call) => call.method === "query.where"),
    {
      method: "query.where",
      path: USERS_PATH,
      field: "isAdmin",
      operator: "==",
      value: true,
    },
  );
  assert.deepEqual(
    dependencies.calls
      .filter((call) => call.method === "transaction.update")
      .map((call) => ({ path: call.reference.path, data: call.data })),
    [
      { path: SOURCE_PATH, data: { isAdmin: false } },
      { path: TARGET_PATH, data: { isAdmin: true, roles: [] } },
    ],
  );
});

test("all required transfer inputs must be present", async () => {
  await assertTransferError(
    transferCompanyAdmin(),
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
});

test("Auth service must provide getUser", async () => {
  const dependencies = createDependencies();

  await assertTransferError(
    transferCompanyAdmin(createInput(dependencies, { auth: {} })),
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.AUTH_SERVICE_INVALID,
  );
});

test("Firestore service must provide required methods", async () => {
  const dependencies = createDependencies();

  await assertTransferError(
    transferCompanyAdmin(createInput(dependencies, { firestore: {} })),
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
  );
});

test("target Auth User from another company is rejected", async () => {
  const dependencies = createDependencies({
    targetAuthUser: createAuthUser(TARGET_UID, {
      customClaims: { companyId: "company-b", isSuperUser: false },
    }),
  });

  await assert.rejects(
    transferCompanyAdmin(createInput(dependencies)),
    (error) => {
      assert.ok(error instanceof UserAuthCompanyPolicyError);
      assert.equal(
        error.code,
        USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH,
      );
      return true;
    },
  );
});

test("target Auth User with an invalid disabled state is rejected", async () => {
  const targetAuthUser = createAuthUser(TARGET_UID);
  delete targetAuthUser.disabled;
  const dependencies = createDependencies({ targetAuthUser });

  await assertTransferError(
    transferCompanyAdmin(createInput(dependencies)),
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_AUTH_DISABLED_STATE_INVALID,
  );
});

test("disabled target Auth User is rejected", async () => {
  const dependencies = createDependencies({
    targetAuthUser: createAuthUser(TARGET_UID, { disabled: true }),
  });

  await assertTransferError(
    transferCompanyAdmin(createInput(dependencies)),
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_AUTH_NOT_ACTIVE,
  );
});

test("missing source User document is rejected before updates", async () => {
  const dependencies = createDependencies({ sourceExists: false });

  await assertTransferError(
    transferCompanyAdmin(createInput(dependencies)),
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.SOURCE_USER_NOT_FOUND,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("missing target User document is rejected before updates", async () => {
  const dependencies = createDependencies({ targetExists: false });

  await assertTransferError(
    transferCompanyAdmin(createInput(dependencies)),
    COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_USER_NOT_FOUND,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("multiple current administrators are rejected before updates", async () => {
  const dependencies = createDependencies({
    currentAdminUids: [ACTOR_UID, "admin-b"],
  });

  await assert.rejects(
    transferCompanyAdmin(createInput(dependencies)),
    (error) => {
      assert.ok(error instanceof CompanyAdminTransferPolicyError);
      assert.equal(
        error.code,
        COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.CURRENT_ADMIN_COUNT_INVALID,
      );
      return true;
    },
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("caller cannot transfer another administrator's authority", async () => {
  const dependencies = createDependencies();

  await assert.rejects(
    transferCompanyAdmin(
      createInput(dependencies, { actorUid: "user-b" }),
    ),
    (error) => {
      assert.ok(error instanceof CompanyAdminTransferPolicyError);
      assert.equal(
        error.code,
        COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_SOURCE_MISMATCH,
      );
      return true;
    },
  );
});

test("disabled source User document is rejected before updates", async () => {
  const dependencies = createDependencies({
    sourceUser: createSourceUser({ disabled: true }),
  });

  await assert.rejects(
    transferCompanyAdmin(createInput(dependencies)),
    (error) => {
      assert.ok(error instanceof CompanyAdminTransferPolicyError);
      assert.equal(
        error.code,
        COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ACTIVE,
      );
      return true;
    },
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("disabled target User document is rejected before updates", async () => {
  const dependencies = createDependencies({
    targetUser: createTargetUser({ disabled: true }),
  });

  await assert.rejects(
    transferCompanyAdmin(createInput(dependencies)),
    (error) => {
      assert.ok(error instanceof CompanyAdminTransferPolicyError);
      assert.equal(
        error.code,
        COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_NOT_ACTIVE,
      );
      return true;
    },
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("Auth lookup errors propagate without starting a transaction", async () => {
  const authError = Object.assign(new Error("synthetic Auth failure"), {
    code: "auth/user-not-found",
  });
  const dependencies = createDependencies({
    authErrors: new Map([[TARGET_UID, authError]]),
  });

  await assert.rejects(
    transferCompanyAdmin(createInput(dependencies)),
    (error) => error === authError,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "firestore.runTransaction"),
    false,
  );
});

test("Firestore transaction errors propagate without updates", async () => {
  const transactionError = new Error("synthetic transaction failure");
  const dependencies = createDependencies({ transactionError });

  await assert.rejects(
    transferCompanyAdmin(createInput(dependencies)),
    (error) => error === transactionError,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});
