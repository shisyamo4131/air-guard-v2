import assert from "node:assert/strict";
import test from "node:test";

import {
  CALLABLE_AUTH_IDENTITY_ERROR_CODES,
  CallableAuthIdentityError,
  resolveCallableAuthIdentity,
} from "../../functions/modules/auth/resolveCallableAuthIdentity.js";

const UID = "user-a";
const EMAIL = "user-a@example.invalid";
const COMPANY_ID = "company-a";

function createAuthUser(overrides = {}) {
  return {
    uid: UID,
    email: EMAIL,
    emailVerified: true,
    disabled: false,
    customClaims: {
      companyId: COMPANY_ID,
      isSuperUser: false,
    },
    ...overrides,
  };
}

function createAuth({ authUser = createAuthUser(), error } = {}) {
  const calls = [];
  const auth = {
    async getUser(uid) {
      calls.push(uid);
      if (error) throw error;
      return authUser;
    },
  };

  return { auth, calls };
}

function createInput(auth, overrides = {}) {
  return {
    auth,
    tokenUid: UID,
    tokenEmail: EMAIL,
    tokenEmailVerified: true,
    tokenCompanyId: COMPANY_ID,
    tokenIsSuperUser: false,
    ...overrides,
  };
}

async function assertIdentityError(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CallableAuthIdentityError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("callable Auth identity error preserves its code and cause", () => {
  const cause = new Error("synthetic cause");
  const error = new CallableAuthIdentityError(
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND,
    "synthetic message",
    { cause },
  );

  assert.equal(error.name, "CallableAuthIdentityError");
  assert.equal(error.cause, cause);
  assert.equal(
    error.code,
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND,
  );
});

test("callable Auth identity error codes are frozen", () => {
  assert.equal(Object.isFrozen(CALLABLE_AUTH_IDENTITY_ERROR_CODES), true);
});

test("matching established token and current Auth return a frozen identity", async () => {
  for (const isSuperUser of [false, true]) {
    const dependencies = createAuth({
      authUser: createAuthUser({
        customClaims: { companyId: COMPANY_ID, isSuperUser },
      }),
    });

    const identity = await resolveCallableAuthIdentity(
      createInput(dependencies.auth, { tokenIsSuperUser: isSuperUser }),
    );

    assert.deepEqual(identity, {
      uid: UID,
      email: EMAIL,
      companyId: COMPANY_ID,
      isSuperUser,
    });
    assert.equal(Object.isFrozen(identity), true);
    assert.deepEqual(dependencies.calls, [UID]);
  }
});

test("malformed or incomplete established token is rejected before Auth access", async () => {
  for (const overrides of [
    { tokenUid: "" },
    { tokenUid: "   " },
    { tokenEmail: undefined },
    { tokenEmail: "   " },
    { tokenEmailVerified: false },
    { tokenCompanyId: null },
    { tokenCompanyId: "   " },
    { tokenIsSuperUser: undefined },
    { tokenIsSuperUser: "false" },
  ]) {
    const dependencies = createAuth();

    await assertIdentityError(
      resolveCallableAuthIdentity(createInput(dependencies.auth, overrides)),
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.TOKEN_IDENTITY_INVALID,
    );

    assert.deepEqual(dependencies.calls, []);
  }
});

test("invalid Auth dependency is rejected", async () => {
  for (const auth of [undefined, null, {}]) {
    await assertIdentityError(
      resolveCallableAuthIdentity(createInput(auth)),
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_SERVICE_INVALID,
    );
  }
});

test("missing current Auth account is converted to a typed identity error", async () => {
  const authError = Object.assign(new Error("synthetic missing Auth account"), {
    code: "auth/user-not-found",
  });
  const dependencies = createAuth({ error: authError });

  await assert.rejects(
    resolveCallableAuthIdentity(createInput(dependencies.auth)),
    (error) => {
      assert.ok(error instanceof CallableAuthIdentityError);
      assert.equal(
        error.code,
        CALLABLE_AUTH_IDENTITY_ERROR_CODES.AUTH_USER_NOT_FOUND,
      );
      assert.equal(error.cause, authError);
      return true;
    },
  );
});

test("unexpected Auth lookup errors are propagated", async () => {
  const authError = new Error("synthetic Auth lookup failure");
  const dependencies = createAuth({ error: authError });

  await assert.rejects(
    resolveCallableAuthIdentity(createInput(dependencies.auth)),
    (error) => error === authError,
  );
});

test("current Auth identity must match every established token field", async () => {
  for (const authUser of [
    createAuthUser({ uid: "user-b" }),
    createAuthUser({ email: "another@example.invalid" }),
    createAuthUser({ emailVerified: false }),
    createAuthUser({ customClaims: undefined }),
    createAuthUser({
      customClaims: { companyId: "company-b", isSuperUser: false },
    }),
    createAuthUser({
      customClaims: { companyId: COMPANY_ID, isSuperUser: undefined },
    }),
    createAuthUser({
      customClaims: { companyId: COMPANY_ID, isSuperUser: true },
    }),
  ]) {
    const dependencies = createAuth({ authUser });

    await assertIdentityError(
      resolveCallableAuthIdentity(createInput(dependencies.auth)),
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_IDENTITY_INVALID,
    );

    assert.deepEqual(dependencies.calls, [UID]);
  }
});

test("malformed current Auth disabled state fails closed", async () => {
  for (const disabled of [undefined, null, 0, "false"]) {
    const dependencies = createAuth({
      authUser: createAuthUser({ disabled }),
    });

    await assertIdentityError(
      resolveCallableAuthIdentity(createInput(dependencies.auth)),
      CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_STATE_INVALID,
    );
  }
});

test("disabled current Auth account is rejected", async () => {
  const dependencies = createAuth({
    authUser: createAuthUser({ disabled: true }),
  });

  await assertIdentityError(
    resolveCallableAuthIdentity(createInput(dependencies.auth)),
    CALLABLE_AUTH_IDENTITY_ERROR_CODES.CURRENT_AUTH_NOT_ACTIVE,
  );
});
