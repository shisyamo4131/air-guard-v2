import assert from "node:assert/strict";
import test from "node:test";

import {
  createRegisteredUserAuthGateway,
  RegisteredUserAuthGatewayError,
} from "../../functions/modules/auth/lifecycle/registeredUserAuthGateway.js";
import {
  LIFECYCLE_AUTH_DISPOSITIONS,
  LIFECYCLE_DOMAIN_ERROR_CODES,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationSchema.js";

const UID = "target-a";
const COMPANY_ID = "company-a";
const EMAIL = "target@example.test";

function authRecord(overrides = {}) {
  return {
    uid: UID,
    email: EMAIL,
    emailVerified: true,
    disabled: false,
    customClaims: { companyId: COMPANY_ID, isSuperUser: false },
    ...overrides,
  };
}

function createAuth(initial = authRecord()) {
  let current = initial ? structuredClone(initial) : null;
  const calls = [];
  const notFound = () => Object.assign(new Error("not found"), {
    code: "auth/user-not-found",
  });
  return {
    calls,
    auth: {
      async getUser(uid) {
        calls.push(["getUser", uid]);
        if (!current) throw notFound();
        return structuredClone(current);
      },
      async updateUser(uid, update) {
        calls.push(["updateUser", uid, structuredClone(update)]);
        if (!current) throw notFound();
        current = { ...current, ...update };
        return structuredClone(current);
      },
      async deleteUser(uid) {
        calls.push(["deleteUser", uid]);
        if (!current) throw notFound();
        current = null;
      },
    },
    get current() {
      return current && structuredClone(current);
    },
  };
}

function gateway(fake) {
  return createRegisteredUserAuthGateway({
    auth: fake.auth,
    companyId: COMPANY_ID,
    expectedUid: UID,
    expectedEmail: EMAIL.toUpperCase(),
  });
}

test("Auth gateway verifies, disables, revalidates, and deletes the exact target", async () => {
  const fake = createAuth();
  const instance = gateway(fake);
  await instance.verifyTarget();
  await instance.disableAndVerify({ targetUserUid: UID });
  assert.equal(fake.current.disabled, true);
  assert.equal(
    await instance.revalidateAndDelete({ targetUserUid: UID }),
    LIFECYCLE_AUTH_DISPOSITIONS.DELETED,
  );
  assert.equal(fake.current, null);
  assert.equal(
    fake.calls.filter(([method]) => method === "deleteUser").length,
    1,
  );
});

test("Auth gateway treats absence after durable intent as idempotent completion", async () => {
  const fake = createAuth(null);
  assert.equal(
    await gateway(fake).revalidateAndDelete({ targetUserUid: UID }),
    LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT,
  );
});

test("Auth gateway refuses deletion until the exact target is disabled", async () => {
  const fake = createAuth();
  await assert.rejects(
    gateway(fake).revalidateAndDelete({ targetUserUid: UID }),
    (error) =>
      error instanceof RegisteredUserAuthGatewayError &&
      error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
  );
  assert.equal(fake.current.uid, UID);
  assert.equal(
    fake.calls.some(([method]) => method === "deleteUser"),
    false,
  );
});

for (const [label, overrides] of [
  ["UID", { uid: "other" }],
  ["email", { email: "other@example.test" }],
  ["email verification", { emailVerified: false }],
  ["company claim", { customClaims: { companyId: "company-b", isSuperUser: false } }],
  ["super-user claim", { customClaims: { companyId: COMPANY_ID, isSuperUser: true } }],
  ["disabled type", { disabled: "false" }],
]) {
  test(`Auth gateway rejects ${label} mismatch without deleting`, async () => {
    const fake = createAuth(authRecord(overrides));
    await assert.rejects(
      gateway(fake).disableAndVerify({ targetUserUid: UID }),
      (error) => {
        assert.ok(error instanceof RegisteredUserAuthGatewayError);
        assert.equal(
          error.domainCode,
          LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
        );
        return true;
      },
    );
    assert.equal(
      fake.calls.some(([method]) => method === "deleteUser"),
      false,
    );
  });
}

test("Auth gateway rejects a mismatched operation target", async () => {
  const fake = createAuth(authRecord({ disabled: true }));
  await assert.rejects(
    gateway(fake).revalidateAndDelete({ targetUserUid: "other" }),
    (error) =>
      error instanceof RegisteredUserAuthGatewayError &&
      error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
  );
  assert.equal(fake.current.uid, UID);
});
