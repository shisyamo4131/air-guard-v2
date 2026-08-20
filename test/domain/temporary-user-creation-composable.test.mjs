import assert from "node:assert/strict";
import test from "node:test";
import {
  createTemporaryUserCreationController,
  TemporaryUserCreationClientError,
} from "../../utils/auth/temporaryUserCreationController.js";

function context(overrides = {}) {
  return {
    companyId: "COMPANY_A",
    actorUser: {
      companyId: "COMPANY_A",
      isTemporary: false,
      disabled: false,
      isAdmin: false,
      roles: ["manager"],
      ...overrides,
    },
  };
}

function setup() {
  let current = context();
  const standalone = [];
  const linked = [];
  const controller = createTemporaryUserCreationController({
    getContext: () => current,
    requestStandalone: async (input) => {
      standalone.push(input);
      return { success: true };
    },
    requestEmployeeLinked: async (input) => {
      linked.push(input);
      return { success: true };
    },
  });
  return {
    controller,
    standalone,
    linked,
    setContext(value) {
      current = value;
    },
  };
}

test("standalone request contains only the server allowlist", async () => {
  const fixture = setup();
  await fixture.controller.createStandaloneTemporaryUser({
    email: "user@example.com",
    displayName: "利用者",
    roles: ["manager"],
    tagSize: "medium",
    receiveConfirmedArrangementNotification: false,
    receiveArrivedArrangementNotification: true,
    receiveLeavedArrangementNotification: false,
    companyId: "FORGED",
    isAdmin: true,
    isTemporary: false,
    disabled: true,
    docId: "FORGED",
    employeeId: "FORGED",
  });
  assert.deepEqual(fixture.standalone, [
    {
      email: "user@example.com",
      displayName: "利用者",
      roles: ["manager"],
      tagSize: "medium",
      receiveConfirmedArrangementNotification: false,
      receiveArrivedArrangementNotification: true,
      receiveLeavedArrangementNotification: false,
    },
  ]);
});

test("Employee-linked request contains only employeeId, email, and optional roles", async () => {
  const fixture = setup();
  await fixture.controller.createEmployeeLinkedTemporaryUser(
    {
      email: "employee@example.com",
      roles: [],
      displayName: "従業員",
      companyId: "FORGED",
      employmentStatus: "ACTIVE",
    },
    { employeeId: "EMPLOYEE_A" },
  );
  assert.deepEqual(fixture.linked, [
    { employeeId: "EMPLOYEE_A", email: "employee@example.com", roles: [] },
  ]);
});

test("authorization is re-evaluated immediately before transport", async () => {
  const fixture = setup();
  assert.equal(fixture.controller.canCreate(), true);
  fixture.setContext(context({ roles: ["controller"] }));
  await assert.rejects(
    () => fixture.controller.createStandaloneTemporaryUser({}),
    (error) => error instanceof TemporaryUserCreationClientError,
  );
  assert.deepEqual(fixture.standalone, []);
  assert.equal(fixture.controller.getCreateControl().disabled, true);
});
