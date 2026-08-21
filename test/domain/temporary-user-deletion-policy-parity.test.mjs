import assert from "node:assert/strict";
import test from "node:test";

import { evaluateClientTemporaryUserDeletion } from "../../utils/auth/policies/temporaryUserDeletionPolicy.js";
import { assertTemporaryUserCanBeDeleted } from "../../functions/modules/auth/temporaryUserDeletionPolicy.js";
import { assertActorCanManageTemporaryUsers } from "../../functions/modules/auth/temporaryUserManagementPolicy.js";

function createActor(overrides = {}) {
  return {
    companyId: "company-1",
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    roles: ["manager"],
    ...overrides,
  };
}

function createTarget(overrides = {}) {
  return {
    docId: "temporary-user-1",
    companyId: "company-1",
    isTemporary: true,
    isAdmin: false,
    disabled: false,
    employeeId: null,
    ...overrides,
  };
}

function serverAllows({ companyId, actorUser, targetUser }) {
  try {
    assertActorCanManageTemporaryUsers({ companyId, actorUser });
    assertTemporaryUserCanBeDeleted({ companyId, targetUser });
    return true;
  } catch {
    return false;
  }
}

const scenarios = [
  {
    name: "company administrator",
    expected: true,
    actorUser: createActor({ isAdmin: true, roles: [] }),
  },
  {
    name: "manager preset",
    expected: true,
    actorUser: createActor({ roles: ["manager"] }),
  },
  {
    name: "human-resource preset",
    expected: true,
    actorUser: createActor({ roles: ["human-resource"] }),
  },
  {
    name: "actor without users provision",
    expected: false,
    actorUser: createActor({ roles: ["controller"] }),
  },
  {
    name: "actor with direct permission string",
    expected: false,
    actorUser: createActor({ roles: ["users:provision"] }),
  },
  {
    name: "actor with unknown role",
    expected: false,
    actorUser: createActor({ roles: ["unknown-role"] }),
  },
  {
    name: "temporary actor",
    expected: false,
    actorUser: createActor({ isTemporary: true }),
  },
  {
    name: "disabled actor",
    expected: false,
    actorUser: createActor({ disabled: true }),
  },
  {
    name: "another-company actor",
    expected: false,
    actorUser: createActor({ companyId: "company-2" }),
  },
  {
    name: "registered target",
    expected: false,
    targetUser: createTarget({ isTemporary: false }),
  },
  {
    name: "administrator target",
    expected: false,
    targetUser: createTarget({ isAdmin: true }),
  },
  {
    name: "disabled target",
    expected: false,
    targetUser: createTarget({ disabled: true }),
  },
  {
    name: "another-company target",
    expected: false,
    targetUser: createTarget({ companyId: "company-2" }),
  },
  {
    name: "malformed Employee link",
    expected: false,
    targetUser: createTarget({ employeeId: " employee-1" }),
  },
  {
    name: "Employee-linked temporary target",
    expected: true,
    targetUser: createTarget({ employeeId: "employee-1" }),
  },
];

for (const scenario of scenarios) {
  test(`client and server deletion policies agree: ${scenario.name}`, () => {
    const input = {
      companyId: "company-1",
      actorUser: scenario.actorUser ?? createActor(),
      targetUser: scenario.targetUser ?? createTarget(),
    };

    const clientAllowed = evaluateClientTemporaryUserDeletion(input).allowed;
    const serverAllowed = serverAllows(input);

    assert.equal(clientAllowed, scenario.expected);
    assert.equal(serverAllowed, scenario.expected);
    assert.equal(clientAllowed, serverAllowed);
  });
}
