import assert from "node:assert/strict";
import test from "node:test";
import {
  ROLE_PRESETS,
} from "@shisyamo4131/air-guard-v2-schemas/constants";
import {
  SITE_WRITE_OPERATION,
  SiteAuthorizationError,
  assertSiteWriteAllowed,
  getSiteArchiveDecision,
  getSiteWriteDecision,
} from "../../composables/domain/site/siteAuthorization.js";

function context(overrides = {}) {
  return {
    authenticationUid: "actor-a",
    uid: "actor-a",
    companyId: "company-a",
    isEmailVerified: true,
    isSuperUser: false,
    isSuperUserClaimValid: true,
    user: {
      docId: "actor-a",
      companyId: "company-a",
      isTemporary: false,
      disabled: false,
      isAdmin: false,
      roles: ["manager"],
    },
    ...overrides,
  };
}

const SITE_WRITE_PRESETS = Object.freeze(
  Object.entries(ROLE_PRESETS)
    .filter(([, preset]) => preset.permissions.includes("sites:write"))
    .map(([role]) => role)
    .sort(),
);
const NON_SITE_WRITE_PRESETS = Object.freeze(
  Object.keys(ROLE_PRESETS)
    .filter((role) => !SITE_WRITE_PRESETS.includes(role))
    .sort(),
);

test("Site write operations expose only the SITE-02 guarded mutation categories", () => {
  assert.deepEqual(SITE_WRITE_OPERATION, {
    CREATE: "create",
    UPDATE: "update",
    CUSTOMER: "customer",
    AGREEMENT: "agreement",
    TERMINATE: "terminate",
  });
});

test("Site write policy allows every active registered same-tenant actor regardless of role", () => {
  assert.deepEqual(SITE_WRITE_PRESETS, ["controller", "legal", "manager"]);
  for (const roles of [
    ...SITE_WRITE_PRESETS.map((role) => [role]),
    ...NON_SITE_WRITE_PRESETS.map((role) => [role]),
    [],
    ["sites:write"],
    ["unknown-role"],
  ]) {
    assert.deepEqual(
      getSiteWriteDecision(context({ user: { ...context().user, roles } })),
      { allowed: true, reason: null },
      JSON.stringify(roles),
    );
  }

  for (const isSuperUser of [false, true]) {
    assert.deepEqual(
      getSiteWriteDecision(
        context({
          isSuperUser,
          user: {
            ...context().user,
            isAdmin: false,
            roles: [],
          },
        }),
      ),
      { allowed: true, reason: null },
    );
  }
});

test("Site write policy rejects invalid actor state", () => {
  const baseUser = context().user;
  const denied = [
    context({ authenticationUid: "actor-b" }),
    context({ authenticationUid: "" }),
    context({ isEmailVerified: false }),
    context({ isSuperUserClaimValid: false }),
    context({ isSuperUser: "false" }),
    context({ uid: "" }),
    context({ companyId: "" }),
    context({ user: null }),
    context({ user: { ...baseUser, docId: "actor-b" } }),
    context({ user: { ...baseUser, companyId: "company-b" } }),
    context({ user: { ...baseUser, isTemporary: true } }),
    context({ user: { ...baseUser, disabled: true } }),
    context({ user: { ...baseUser, isAdmin: undefined } }),
  ];

  for (const input of denied) {
    assert.equal(getSiteWriteDecision(input).allowed, false);
  }
});

test("Site write assertion fails closed with a stable authorization error", () => {
  assert.doesNotThrow(() => assertSiteWriteAllowed(context()));
  assert.throws(
    () => assertSiteWriteAllowed(context({ isEmailVerified: false })),
    (error) =>
      error instanceof SiteAuthorizationError &&
      error.code === "permission-denied" &&
      error.message === "現場を変更する権限を確認できません。",
  );
});

test("Site archive policy preserves the strict sites:write actor matrix", () => {
  assert.equal(getSiteArchiveDecision(context()).allowed, true);
  assert.equal(getSiteArchiveDecision(context({ user: { ...context().user, roles: ["accountant"] } })).allowed, false);
  assert.equal(getSiteArchiveDecision(context({ user: { ...context().user, roles: [] } })).allowed, false);
  assert.equal(getSiteArchiveDecision(context({ isSuperUser: true })).allowed, false);
  assert.equal(getSiteArchiveDecision(context({
    isSuperUser: true,
    user: { ...context().user, isAdmin: true, roles: [] },
  })).allowed, true);
});
