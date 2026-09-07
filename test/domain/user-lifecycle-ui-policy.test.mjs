import assert from "node:assert/strict";
import test from "node:test";

import {
  canDeleteStandaloneRegisteredUser,
  canReinstateEmployee,
  canTerminateEmployee,
  canViewLifecycleOperationHistory,
} from "../../utils/auth/policies/userLifecycleUiPolicy.js";

const companyId = "company-a";
const actorUid = "actor-a";
const actor = (overrides = {}) => ({
  docId: actorUid,
  companyId,
  isTemporary: false,
  disabled: false,
  isAdmin: false,
  employeeId: "actor-employee",
  roles: ["human-resource"],
  ...overrides,
});
const employee = (overrides = {}) => ({
  docId: "employee-a",
  companyId,
  employmentStatus: "ACTIVE",
  ...overrides,
});
const user = (overrides = {}) => ({
  docId: "user-a",
  companyId,
  isTemporary: false,
  disabled: false,
  isAdmin: false,
  employeeId: null,
  ...overrides,
});

test("history UI is company-admin only and fails closed for stale identity", () => {
  const context = {
    companyId,
    actorUid,
    actorUser: actor({ isAdmin: true, roles: [] }),
    isSuperUser: false,
  };
  assert.equal(canViewLifecycleOperationHistory(context), true);

  for (const denied of [
    { actorUser: actor({ isAdmin: false, roles: ["manager"] }) },
    { actorUser: actor({ isAdmin: false, roles: ["human-resource"] }) },
    { actorUser: actor({ isAdmin: false, roles: ["users:write"] }) },
    { actorUser: actor({ isAdmin: true, roles: [], isTemporary: true }) },
    { actorUser: actor({ isAdmin: true, roles: [], disabled: true }) },
    { actorUser: actor({ isAdmin: true, roles: [], companyId: "company-b" }) },
    { actorUser: actor({ isAdmin: true, roles: [], docId: "stale-actor" }) },
    { isSuperUser: true },
    { isSuperUser: undefined },
    { actorUid: null },
    { actorUser: null },
  ]) {
    assert.equal(
      canViewLifecycleOperationHistory({ ...context, ...denied }),
      false,
      JSON.stringify(denied),
    );
  }
});

test("retirement UI follows strict employees:terminate and administrator policy", () => {
  const context = {
    companyId,
    actorUid,
    actorUser: actor(),
    isSuperUser: false,
    employee: employee(),
  };
  assert.equal(canTerminateEmployee(context), true);
  assert.equal(
    canTerminateEmployee({
      ...context,
      actorUser: actor({ roles: [], isAdmin: true }),
    }),
    true,
  );
  assert.equal(
    canTerminateEmployee({
      ...context,
      actorUser: actor({ roles: ["manager"] }),
    }),
    true,
  );
  assert.equal(
    canTerminateEmployee({
      ...context,
      actorUser: actor({ roles: ["manager", "employees:terminate"] }),
    }),
    false,
  );
  assert.equal(
    canTerminateEmployee({ ...context, actorUser: actor({ roles: ["labor"] }) }),
    false,
  );
  assert.equal(
    canTerminateEmployee({ ...context, employee: employee({ docId: "actor-employee" }) }),
    false,
  );
  assert.equal(
    canTerminateEmployee({ ...context, linkedUser: { isAdmin: true } }),
    false,
  );
  assert.equal(canTerminateEmployee({ ...context, isSuperUser: true }), false);
  assert.equal(
    canTerminateEmployee({ ...context, isSuperUser: undefined }),
    false,
  );
});

test("reinstatement UI is limited to company administrators and resigned Employees", () => {
  const context = {
    companyId,
    actorUid,
    actorUser: actor({ isAdmin: true, roles: [] }),
    isSuperUser: false,
    employee: employee({ employmentStatus: "RESIGNED" }),
  };
  assert.equal(canReinstateEmployee(context), true);
  assert.equal(
    canReinstateEmployee({ ...context, actorUser: actor({ isAdmin: false }) }),
    false,
  );
  assert.equal(
    canReinstateEmployee({ ...context, employee: employee() }),
    false,
  );
  assert.equal(canReinstateEmployee({ ...context, isSuperUser: true }), false);
  assert.equal(
    canReinstateEmployee({ ...context, isSuperUser: undefined }),
    false,
  );
});

test("registered User deletion UI hides every server-denied target class", () => {
  const context = {
    companyId,
    actorUid,
    actorUser: actor({ isAdmin: true, roles: [] }),
    isSuperUser: false,
    targetUser: user(),
  };
  assert.equal(canDeleteStandaloneRegisteredUser(context), true);
  for (const targetUser of [
    user({ docId: actorUid }),
    user({ isAdmin: true }),
    user({ isTemporary: true }),
    user({ employeeId: "employee-a" }),
    user({ companyId: "company-b" }),
  ]) {
    assert.equal(
      canDeleteStandaloneRegisteredUser({ ...context, targetUser }),
      false,
    );
  }
  assert.equal(
    canDeleteStandaloneRegisteredUser({ ...context, isSuperUser: true }),
    false,
  );
  assert.equal(
    canDeleteStandaloneRegisteredUser({
      ...context,
      isSuperUser: undefined,
    }),
    false,
  );
});
