import assert from "node:assert/strict";
import test from "node:test";

import {
  syncUserAuthAccount,
  USER_AUTH_SYNC_RESULTS,
} from "../../functions/modules/auth/syncUserAuthAccount.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/policies/userAuthCompanyPolicy.js";

const COMPANY_ID = "company-a";
const USER_ID = "user-a";

function createBeforeData(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    displayName: "Before",
    disabled: false,
    ...overrides,
  };
}

function createAfterData(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    displayName: "After",
    disabled: false,
    ...overrides,
  };
}

function createAuthUser(overrides = {}) {
  return {
    uid: USER_ID,
    customClaims: {
      companyId: COMPANY_ID,
      isSuperUser: false,
    },
    ...overrides,
  };
}

function createAuthFake({ authUser, getError, updateError } = {}) {
  const calls = [];
  const resolvedAuthUser = authUser ?? createAuthUser();

  return {
    calls,
    auth: {
      async getUser(uid) {
        calls.push({ method: "getUser", uid });
        if (getError) throw getError;
        return resolvedAuthUser;
      },
      async updateUser(uid, properties) {
        calls.push({ method: "updateUser", uid, properties });
        if (updateError) throw updateError;
        return resolvedAuthUser;
      },
    },
  };
}

async function assertPolicyRejection(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UserAuthCompanyPolicyError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("sync result constants are frozen", () => {
  assert.equal(Object.isFrozen(USER_AUTH_SYNC_RESULTS), true);
});

test("unrelated User changes skip Auth access", async () => {
  const result = await syncUserAuthAccount({
    pathCompanyId: COMPANY_ID,
    docId: USER_ID,
    beforeData: createBeforeData({ tagSize: "small" }),
    afterData: createBeforeData({ tagSize: "large" }),
  });

  assert.deepEqual(result, {
    result: USER_AUTH_SYNC_RESULTS.SKIPPED_NO_RELEVANT_CHANGES,
  });
});

test("temporary User changes skip Auth access", async () => {
  const result = await syncUserAuthAccount({
    pathCompanyId: COMPANY_ID,
    docId: "temporary-document",
    beforeData: createBeforeData({
      isTemporary: true,
      displayName: "Before temporary",
    }),
    afterData: createAfterData({
      isTemporary: true,
      displayName: "After temporary",
    }),
  });

  assert.deepEqual(result, {
    result: USER_AUTH_SYNC_RESULTS.SKIPPED_TEMPORARY_USER,
  });
});

test("registered User changes update the matching Auth account", async () => {
  const { auth, calls } = createAuthFake();

  const result = await syncUserAuthAccount({
    auth,
    pathCompanyId: COMPANY_ID,
    docId: USER_ID,
    beforeData: createBeforeData(),
    afterData: createAfterData({ displayName: "Updated", disabled: true }),
  });

  assert.deepEqual(result, { result: USER_AUTH_SYNC_RESULTS.UPDATED });
  assert.deepEqual(calls, [
    { method: "getUser", uid: USER_ID },
    {
      method: "updateUser",
      uid: USER_ID,
      properties: {
        displayName: "Updated",
        disabled: true,
      },
    },
  ]);
});

test("User document from another company is rejected before Auth access", async () => {
  const { auth, calls } = createAuthFake();

  await assertPolicyRejection(
    syncUserAuthAccount({
      auth,
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      beforeData: createBeforeData(),
      afterData: createAfterData({ companyId: "company-b" }),
    }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
  );

  assert.deepEqual(calls, []);
});

test("missing registered state is rejected before Auth access", async () => {
  const { auth, calls } = createAuthFake();
  const afterData = createAfterData();
  delete afterData.isTemporary;

  await assertPolicyRejection(
    syncUserAuthAccount({
      auth,
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      beforeData: createBeforeData(),
      afterData,
    }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
  );

  assert.deepEqual(calls, []);
});

test("an invalid Auth dependency is rejected before account access", async () => {
  await assert.rejects(
    syncUserAuthAccount({
      auth: {},
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      beforeData: createBeforeData(),
      afterData: createAfterData(),
    }),
    TypeError,
  );
});

test("Auth account without a company claim is not updated", async () => {
  const { auth, calls } = createAuthFake({
    authUser: createAuthUser({ customClaims: undefined }),
  });

  await assertPolicyRejection(
    syncUserAuthAccount({
      auth,
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      beforeData: createBeforeData(),
      afterData: createAfterData(),
    }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISSING,
  );

  assert.deepEqual(calls, [{ method: "getUser", uid: USER_ID }]);
});

test("Auth account from another company is not updated", async () => {
  const { auth, calls } = createAuthFake({
    authUser: createAuthUser({
      customClaims: { companyId: "company-b", isSuperUser: false },
    }),
  });

  await assertPolicyRejection(
    syncUserAuthAccount({
      auth,
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      beforeData: createBeforeData(),
      afterData: createAfterData(),
    }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH,
  );

  assert.deepEqual(calls, [{ method: "getUser", uid: USER_ID }]);
});

test("Auth account with another UID is not updated", async () => {
  const { auth, calls } = createAuthFake({
    authUser: createAuthUser({ uid: "user-b" }),
  });

  await assertPolicyRejection(
    syncUserAuthAccount({
      auth,
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      beforeData: createBeforeData(),
      afterData: createAfterData(),
    }),
    USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_UID_MISMATCH,
  );

  assert.deepEqual(calls, [{ method: "getUser", uid: USER_ID }]);
});

test("Auth lookup failures are propagated without an update attempt", async () => {
  const getError = new Error("synthetic getUser failure");
  const { auth, calls } = createAuthFake({ getError });

  await assert.rejects(
    syncUserAuthAccount({
      auth,
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      beforeData: createBeforeData(),
      afterData: createAfterData(),
    }),
    (error) => error === getError,
  );

  assert.deepEqual(calls, [{ method: "getUser", uid: USER_ID }]);
});

test("Auth update failures are propagated after validation", async () => {
  const updateError = new Error("synthetic updateUser failure");
  const { auth, calls } = createAuthFake({ updateError });

  await assert.rejects(
    syncUserAuthAccount({
      auth,
      pathCompanyId: COMPANY_ID,
      docId: USER_ID,
      beforeData: createBeforeData(),
      afterData: createAfterData(),
    }),
    (error) => error === updateError,
  );

  assert.deepEqual(calls, [
    { method: "getUser", uid: USER_ID },
    {
      method: "updateUser",
      uid: USER_ID,
      properties: {
        displayName: "After",
        disabled: false,
      },
    },
  ]);
});
