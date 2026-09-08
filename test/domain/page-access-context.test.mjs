import assert from "node:assert/strict";
import test from "node:test";

import { buildPageAccessContext } from "../../utils/auth/pageAccessContext.js";

function authState(overrides = {}) {
  return {
    isReady: true,
    uid: "actor-a",
    companyId: "company-a",
    isEmailVerified: true,
    isSuperUser: false,
    isSuperUserClaimValid: true,
    isDeveloper: false,
    isDeveloperClaimValid: true,
    roles: ["manager"],
    user: {
      docId: "actor-a",
      companyId: "company-a",
      disabled: false,
      isTemporary: false,
      isAdmin: false,
      roles: ["manager"],
    },
    ...overrides,
  };
}

test("page access context accepts an active registered actor", () => {
  const context = buildPageAccessContext(authState());

  assert.equal(context.isAuthenticated, true);
  assert.equal(context.isActiveRegisteredActor, true);
  assert.equal(context.actorUid, "actor-a");
  assert.equal(context.companyId, "company-a");
  assert.deepEqual(context.presetRoles, ["manager"]);
});

test("page access context fails closed for invalid actor identity and lifecycle state", () => {
  const cases = [
    { isReady: false },
    { uid: "bad/id" },
    { companyId: " company-a" },
    { isEmailVerified: false },
    { isSuperUserClaimValid: false },
    { user: { ...authState().user, docId: "actor-b" } },
    { user: { ...authState().user, companyId: "company-b" } },
    { user: { ...authState().user, disabled: true } },
    { user: { ...authState().user, isTemporary: true } },
    { user: { ...authState().user, isAdmin: "true" } },
    { user: { ...authState().user, roles: null } },
    { user: { ...authState().user, roles: [""] } },
    { user: { ...authState().user, roles: [" manager"] } },
    { user: { ...authState().user, roles: [1] } },
    { user: { ...authState().user, roles: ["admin"] } },
    { user: { ...authState().user, roles: ["super-user"] } },
    { user: { ...authState().user, roles: ["developer"] } },
    { user: { ...authState().user, roles: ["*"] } },
    { sessionInitializationFailed: true },
  ];

  for (const overrides of cases) {
    assert.equal(
      buildPageAccessContext(authState(overrides)).isActiveRegisteredActor,
      false,
      JSON.stringify(overrides),
    );
  }
});

test("developer access requires an exact valid boolean claim", () => {
  const missingClaim = buildPageAccessContext(
    authState({ isDeveloper: false, isDeveloperClaimValid: true }),
  );
  assert.equal(missingClaim.isDeveloper, false);
  assert.equal(missingClaim.isDeveloperClaimValid, true);

  const malformedClaim = buildPageAccessContext(
    authState({ isDeveloper: "true", isDeveloperClaimValid: false }),
  );
  assert.equal(malformedClaim.isDeveloper, false);
  assert.equal(malformedClaim.isDeveloperClaimValid, false);
});
