import assert from "node:assert/strict";
import test from "node:test";

import {
  canChangeUserEnabledState,
  canTransferCompanyAdmin,
} from "../../utils/auth/policies/userManagementUiPolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "admin-a";

function actor(overrides = {}) {
  return {
    docId: ACTOR_UID,
    companyId: COMPANY_ID,
    isTemporary: false,
    disabled: false,
    isAdmin: true,
    ...overrides,
  };
}

function target(overrides = {}) {
  return {
    docId: "user-a",
    companyId: COMPANY_ID,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    ...overrides,
  };
}

test("only an active registered company administrator sees enabled-state actions", () => {
  assert.equal(
    canChangeUserEnabledState({
      companyId: COMPANY_ID,
      actorUid: ACTOR_UID,
      actorUser: actor(),
      targetUser: target(),
    }),
    true,
  );

  for (const actorUser of [
    actor({ isAdmin: false }),
    actor({ docId: "other-admin" }),
    actor({ disabled: true }),
    actor({ isTemporary: true }),
    actor({ companyId: "company-b" }),
  ]) {
    assert.equal(
      canChangeUserEnabledState({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        actorUser,
        targetUser: target(),
      }),
      false,
    );
  }
});

test("self, administrator, temporary, malformed, and other-company targets are hidden", () => {
  for (const targetUser of [
    target({ docId: ACTOR_UID }),
    target({ isAdmin: true }),
    target({ isTemporary: true }),
    target({ disabled: "false" }),
    target({ companyId: "company-b" }),
    target({ docId: "nested/user" }),
  ]) {
    assert.equal(
      canChangeUserEnabledState({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        actorUser: actor(),
        targetUser,
      }),
      false,
    );
  }
});

test("admin transfer control requires the active current actor document", () => {
  assert.equal(
    canTransferCompanyAdmin({
      companyId: COMPANY_ID,
      actorUid: ACTOR_UID,
      actorUser: actor(),
    }),
    true,
  );
  for (const actorUser of [
    actor({ docId: "other-admin" }),
    actor({ isAdmin: false }),
    actor({ disabled: true }),
    actor({ isTemporary: true }),
  ]) {
    assert.equal(
      canTransferCompanyAdmin({
        companyId: COMPANY_ID,
        actorUid: ACTOR_UID,
        actorUser,
      }),
      false,
    );
  }
});
