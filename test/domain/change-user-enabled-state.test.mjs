import assert from "node:assert/strict";
import test from "node:test";

import {
  changeUserEnabledState,
  USER_ENABLED_STATE_CHANGE_ERROR_CODES,
  UserEnabledStateChangeError,
} from "../../functions/modules/auth/changeUserEnabledState.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/userAuthCompanyPolicy.js";
import {
  USER_ENABLED_STATE_POLICY_ERROR_CODES,
  UserEnabledStatePolicyError,
} from "../../functions/modules/auth/userEnabledStatePolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "admin-a";
const TARGET_UID = "user-a";
const ACTOR_PATH = `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`;
const TARGET_PATH = `Companies/${COMPANY_ID}/Users/${TARGET_UID}`;

function createActorUser(overrides = {}) {
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
    ...overrides,
  };
}

function createAuthUser(overrides = {}) {
  return {
    uid: TARGET_UID,
    customClaims: {
      companyId: COMPANY_ID,
      isSuperUser: false,
    },
    ...overrides,
  };
}

function createSnapshot(data, exists = true) {
  return {
    exists,
    data() {
      return data;
    },
  };
}

function createDependencies({
  actorUser = createActorUser(),
  targetUser = createTargetUser(),
  authUser = createAuthUser(),
  actorExists = true,
  targetExists = true,
  authError,
  transactionError,
  updateError,
  attempts = 1,
} = {}) {
  const calls = [];

  const auth = {
    async getUser(uid) {
      calls.push({ method: "auth.getUser", uid });
      if (authError) throw authError;
      return authUser;
    },
  };

  const firestore = {
    doc(path) {
      calls.push({ method: "firestore.doc", path });
      return { path };
    },
    async runTransaction(callback) {
      calls.push({ method: "firestore.runTransaction" });
      if (transactionError) throw transactionError;

      let result;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const transaction = {
          async get(reference) {
            calls.push({
              method: "transaction.get",
              path: reference.path,
              attempt,
            });

            if (reference.path === ACTOR_PATH) {
              return createSnapshot(actorUser, actorExists);
            }
            if (reference.path === TARGET_PATH) {
              return createSnapshot(targetUser, targetExists);
            }
            throw new Error(`Unexpected document path: ${reference.path}`);
          },
          update(reference, properties) {
            calls.push({
              method: "transaction.update",
              path: reference.path,
              properties,
              attempt,
            });
            if (updateError) throw updateError;
          },
        };

        result = await callback(transaction);
      }

      return result;
    },
  };

  return { auth, firestore, calls };
}

function createInput({ auth, firestore }, overrides = {}) {
  return {
    auth,
    firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    targetUid: TARGET_UID,
    enabled: false,
    ...overrides,
  };
}

async function assertChangeError(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UserEnabledStateChangeError);
    assert.equal(error.name, "UserEnabledStateChangeError");
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("enabled state change error preserves its code and cause", () => {
  const cause = new Error("synthetic cause");
  const error = new UserEnabledStateChangeError(
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
    "synthetic message",
    { cause },
  );

  assert.equal(error.name, "UserEnabledStateChangeError");
  assert.equal(
    error.code,
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
  );
  assert.equal(error.cause, cause);
});

test("enabled state change error codes are frozen", () => {
  assert.equal(Object.isFrozen(USER_ENABLED_STATE_CHANGE_ERROR_CODES), true);
});

test("disabling a regular User writes disabled true in the transaction", async () => {
  const dependencies = createDependencies();

  const result = await changeUserEnabledState(
    createInput(dependencies, { enabled: false }),
  );

  assert.deepEqual(result, { success: true, uid: TARGET_UID });
  assert.deepEqual(dependencies.calls, [
    { method: "firestore.doc", path: ACTOR_PATH },
    { method: "firestore.doc", path: TARGET_PATH },
    { method: "firestore.runTransaction" },
    { method: "transaction.get", path: ACTOR_PATH, attempt: 1 },
    { method: "transaction.get", path: TARGET_PATH, attempt: 1 },
    { method: "auth.getUser", uid: TARGET_UID },
    {
      method: "transaction.update",
      path: TARGET_PATH,
      properties: { disabled: true },
      attempt: 1,
    },
  ]);
});

test("enabling a regular User writes disabled false in the transaction", async () => {
  const dependencies = createDependencies({
    targetUser: createTargetUser({ disabled: true }),
  });

  const result = await changeUserEnabledState(
    createInput(dependencies, { enabled: true }),
  );

  assert.deepEqual(result, { success: true, uid: TARGET_UID });
  assert.deepEqual(
    dependencies.calls.at(-1),
    {
      method: "transaction.update",
      path: TARGET_PATH,
      properties: { disabled: false },
      attempt: 1,
    },
  );
});

test("company and User identifiers are required non-empty strings", async () => {
  const dependencies = createDependencies();

  await assertChangeError(
    changeUserEnabledState(
      createInput(dependencies, { companyId: "" }),
    ),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  await assertChangeError(
    changeUserEnabledState(
      createInput(dependencies, { actorUid: undefined }),
    ),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );
  await assertChangeError(
    changeUserEnabledState(
      createInput(dependencies, { targetUid: 123 }),
    ),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.REQUIRED_FIELD_MISSING,
  );

  assert.deepEqual(dependencies.calls, []);
});

test("enabled state must be boolean", async () => {
  const dependencies = createDependencies();

  await assertChangeError(
    changeUserEnabledState(
      createInput(dependencies, { enabled: undefined }),
    ),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.ENABLED_STATE_INVALID,
  );

  assert.deepEqual(dependencies.calls, []);
});

test("invalid Auth dependency is rejected", async () => {
  const dependencies = createDependencies();

  await assertChangeError(
    changeUserEnabledState(
      createInput(dependencies, { auth: null }),
    ),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.AUTH_SERVICE_INVALID,
  );
  await assertChangeError(
    changeUserEnabledState(
      createInput(dependencies, { auth: {} }),
    ),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.AUTH_SERVICE_INVALID,
  );

  assert.deepEqual(dependencies.calls, []);
});

test("invalid Firestore dependency is rejected", async () => {
  const dependencies = createDependencies();

  await assertChangeError(
    changeUserEnabledState(
      createInput(dependencies, { firestore: null }),
    ),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
  );
  await assertChangeError(
    changeUserEnabledState(
      createInput(dependencies, { firestore: { doc() {} } }),
    ),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
  );

  assert.deepEqual(dependencies.calls, []);
});

test("missing actor User aborts before target or Auth access", async () => {
  const dependencies = createDependencies({ actorExists: false });

  await assertChangeError(
    changeUserEnabledState(createInput(dependencies)),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.ACTOR_USER_NOT_FOUND,
  );

  assert.equal(
    dependencies.calls.some((call) => call.method === "auth.getUser"),
    false,
  );
  assert.equal(
    dependencies.calls.some(
      (call) =>
        call.method === "transaction.get" && call.path === TARGET_PATH,
    ),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("missing target User aborts before Auth access or update", async () => {
  const dependencies = createDependencies({ targetExists: false });

  await assertChangeError(
    changeUserEnabledState(createInput(dependencies)),
    USER_ENABLED_STATE_CHANGE_ERROR_CODES.TARGET_USER_NOT_FOUND,
  );

  assert.equal(
    dependencies.calls.some((call) => call.method === "auth.getUser"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("policy rejection aborts before Auth access or update", async () => {
  const dependencies = createDependencies({
    actorUser: createActorUser({ isAdmin: false }),
  });

  await assert.rejects(
    changeUserEnabledState(createInput(dependencies)),
    (error) => {
      assert.ok(error instanceof UserEnabledStatePolicyError);
      assert.equal(
        error.code,
        USER_ENABLED_STATE_POLICY_ERROR_CODES.ACTOR_NOT_ADMIN,
      );
      return true;
    },
  );

  assert.equal(
    dependencies.calls.some((call) => call.method === "auth.getUser"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("Auth account from another company aborts before update", async () => {
  const dependencies = createDependencies({
    authUser: createAuthUser({
      customClaims: { companyId: "company-b", isSuperUser: false },
    }),
  });

  await assert.rejects(
    changeUserEnabledState(createInput(dependencies)),
    (error) => {
      assert.ok(error instanceof UserAuthCompanyPolicyError);
      assert.equal(
        error.code,
        USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH,
      );
      return true;
    },
  );

  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("Auth account with another UID aborts before update", async () => {
  const dependencies = createDependencies({
    authUser: createAuthUser({ uid: "user-b" }),
  });

  await assert.rejects(
    changeUserEnabledState(createInput(dependencies)),
    (error) => {
      assert.ok(error instanceof UserAuthCompanyPolicyError);
      assert.equal(
        error.code,
        USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_UID_MISMATCH,
      );
      return true;
    },
  );

  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("Auth lookup failure is propagated without update", async () => {
  const authError = new Error("synthetic Auth lookup failure");
  const dependencies = createDependencies({ authError });

  await assert.rejects(
    changeUserEnabledState(createInput(dependencies)),
    (error) => error === authError,
  );

  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("transaction start failure is propagated without document or Auth access", async () => {
  const transactionError = new Error("synthetic transaction failure");
  const dependencies = createDependencies({ transactionError });

  await assert.rejects(
    changeUserEnabledState(createInput(dependencies)),
    (error) => error === transactionError,
  );

  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.get"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "auth.getUser"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.update"),
    false,
  );
});

test("transaction update failure is propagated", async () => {
  const updateError = new Error("synthetic transaction update failure");
  const dependencies = createDependencies({ updateError });

  await assert.rejects(
    changeUserEnabledState(createInput(dependencies)),
    (error) => error === updateError,
  );

  assert.equal(
    dependencies.calls.filter(
      (call) => call.method === "transaction.update",
    ).length,
    1,
  );
});

test("transaction retry repeats only reads, validation, and scheduled update", async () => {
  const dependencies = createDependencies({ attempts: 2 });

  const result = await changeUserEnabledState(createInput(dependencies));

  assert.deepEqual(result, { success: true, uid: TARGET_UID });
  assert.equal(
    dependencies.calls.filter((call) => call.method === "auth.getUser").length,
    2,
  );
  assert.equal(
    dependencies.calls.filter(
      (call) => call.method === "transaction.update",
    ).length,
    2,
  );
});
