import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUserReservationMigrationPlan,
  assertCodexReservationMigrationTarget,
  parseReservationMigrationArgs,
  planUserReservationMigration,
  summarizeUserReservationPlan,
} from "../../scripts/migrate-user-reservations.mjs";
import { createUserEmailReservationId } from "../../functions/modules/auth/createTemporaryUser.js";

function user({
  companyId = "COMPANY_A",
  userId = "USER_A",
  email = "user-a@example.com",
  employeeId = null,
  overrides = {},
} = {}) {
  return {
    path: `Companies/${companyId}/Users/${userId}`,
    data: {
      docId: userId,
      companyId,
      email,
      isTemporary: true,
      isAdmin: false,
      disabled: false,
      ...(employeeId === null ? {} : { employeeId }),
      ...overrides,
    },
  };
}

function employee(companyId = "COMPANY_A", employeeId = "EMPLOYEE_A") {
  return {
    path: `Companies/${companyId}/Employees/${employeeId}`,
    data: { companyId },
  };
}

function emailReservation({
  email = "user-a@example.com",
  companyId = "COMPANY_A",
  userId = "USER_A",
  data,
} = {}) {
  return {
    path: `UserEmailReservations/${createUserEmailReservationId(email)}`,
    data: data ?? { companyId, userId },
  };
}

function employeeReservation({
  companyId = "COMPANY_A",
  employeeId = "EMPLOYEE_A",
  userId = "USER_A",
  data,
} = {}) {
  return {
    path: `Companies/${companyId}/EmployeeUserReservations/${employeeId}`,
    data: data ?? { userId },
  };
}

function state(overrides = {}) {
  return {
    users: [user()],
    employees: [],
    emailReservations: [emailReservation()],
    employeeReservations: [],
    ...overrides,
  };
}

test("clean standalone reservations produce a no-op plan", () => {
  const plan = planUserReservationMigration(state());
  assert.deepEqual(plan.findings, []);
  assert.equal(plan.operations.length, 1);
  assert.deepEqual(plan.operations[0].writes, []);
  assert.equal(summarizeUserReservationPlan(plan).status, "clean");
});

test("missing linked reservations are planned as one atomic operation", () => {
  const source = user({ employeeId: "EMPLOYEE_A" });
  const plan = planUserReservationMigration(
    state({
      users: [source],
      employees: [employee()],
      emailReservations: [],
      employeeReservations: [],
    }),
  );
  assert.deepEqual(plan.findings, []);
  assert.deepEqual(
    plan.operations[0].writes.map(({ kind, path }) => ({ kind, path })),
    [
      {
        kind: "create",
        path: `UserEmailReservations/${createUserEmailReservationId(source.data.email)}`,
      },
      {
        kind: "create",
        path: "Companies/COMPANY_A/EmployeeUserReservations/EMPLOYEE_A",
      },
    ],
  );
  assert.deepEqual(source.data, {
    docId: "USER_A",
    companyId: "COMPANY_A",
    email: "user-a@example.com",
    isTemporary: true,
    isAdmin: false,
    disabled: false,
    employeeId: "EMPLOYEE_A",
  });
});

test("stale exact pointers are updated only when the old User is absent", async () => {
  const plan = planUserReservationMigration(
    state({
      emailReservations: [emailReservation({ userId: "REMOVED_USER" })],
    }),
  );
  assert.deepEqual(plan.findings, []);
  assert.equal(plan.operations[0].writes[0].kind, "update");
  assert.deepEqual(plan.operations[0].writes[0].data, {
    companyId: "COMPANY_A",
    userId: "USER_A",
  });

  const conflict = planUserReservationMigration(
    state({
      users: [user(), user({ userId: "OTHER", email: "other@example.com" })],
      emailReservations: [emailReservation({ userId: "OTHER" })],
    }),
  );
  assert.equal(
    conflict.findings.some(({ code }) => code === "email-reservation-conflict"),
    true,
  );
  const fake = createApplyFake();
  await assert.rejects(
    () => applyUserReservationMigrationPlan(fake.firestore, conflict),
    /blocking findings/,
  );
  assert.deepEqual(fake.calls, []);
});

test("canonical email duplicates and same-company Employee duplicates block all writes", () => {
  const users = [
    user({ userId: "USER_A", employeeId: "EMPLOYEE_A" }),
    user({
      userId: "USER_B",
      email: "user-a@example.com",
      employeeId: "EMPLOYEE_A",
    }),
  ];
  const plan = planUserReservationMigration({
    users,
    employees: [employee()],
    emailReservations: [],
    employeeReservations: [],
  });
  assert.equal(
    plan.findings.filter(({ code }) => code === "canonical-email-duplicate").length,
    2,
  );
  assert.equal(
    plan.findings.filter(({ code }) => code === "company-employee-duplicate").length,
    2,
  );
  assert.equal(plan.operations.some(({ writes }) => writes.length > 0), false);
});

test("the same Employee ID in different companies is allowed", () => {
  const plan = planUserReservationMigration({
    users: [
      user({ employeeId: "EMPLOYEE_A" }),
      user({
        companyId: "COMPANY_B",
        userId: "USER_B",
        email: "user-b@example.com",
        employeeId: "EMPLOYEE_A",
      }),
    ],
    employees: [employee(), employee("COMPANY_B", "EMPLOYEE_A")],
    emailReservations: [],
    employeeReservations: [],
  });
  assert.deepEqual(plan.findings, []);
  assert.equal(plan.operations.length, 2);
});

test("malformed Users, dangling Employees, conflicts, and orphan reservations are findings", () => {
  const cases = [
    {
      expected: "user-company-mismatch",
      input: state({ users: [user({ overrides: { companyId: "COMPANY_B" } })] }),
    },
    {
      expected: "user-email-not-canonical",
      input: state({ users: [user({ email: " User-A@Example.com " })] }),
    },
    {
      expected: "user-state-invalid",
      input: state({ users: [user({ overrides: { disabled: "false" } })] }),
    },
    {
      expected: "user-state-invalid",
      input: state({ users: [user({ overrides: { isAdmin: true } })] }),
    },
    {
      expected: "user-state-invalid",
      input: state({ users: [user({ overrides: { disabled: true } })] }),
    },
    {
      expected: "user-state-invalid",
      input: state({
        users: [
          user({
            overrides: { isTemporary: false, isAdmin: true, disabled: true },
          }),
        ],
      }),
    },
    {
      expected: "employee-dangling",
      input: state({ users: [user({ employeeId: "MISSING" })] }),
    },
    {
      expected: "email-reservation-conflict",
      input: state({ emailReservations: [emailReservation({ data: { userId: "X" } })] }),
    },
    {
      expected: "email-reservation-orphan",
      input: state({
        emailReservations: [
          emailReservation(),
          emailReservation({ email: "orphan@example.com", userId: "ORPHAN" }),
        ],
      }),
    },
  ];
  for (const { expected, input } of cases) {
    const plan = planUserReservationMigration(input);
    assert.equal(
      plan.findings.some(({ code }) => code === expected),
      true,
      expected,
    );
  }
});

test("reports contain counts and opaque subjects but no source PII", () => {
  const email = "sensitive-person@example.com";
  const plan = planUserReservationMigration(
    state({ users: [user({ email })], emailReservations: [] }),
  );
  const serialized = JSON.stringify(summarizeUserReservationPlan(plan));
  assert.equal(serialized.includes(email), false);
  assert.equal(serialized.includes("COMPANY_A"), false);
  assert.equal(serialized.includes("USER_A"), false);
  assert.equal(serialized.includes("Companies/"), false);
});

test("plan digest is deterministic and changes with the plan", () => {
  const first = planUserReservationMigration(
    state({ emailReservations: [] }),
  ).planDigest;
  const second = planUserReservationMigration(
    state({ emailReservations: [] }),
  ).planDigest;
  const changed = planUserReservationMigration(state()).planDigest;
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("CLI parser defaults to dry-run and requires digest for apply", () => {
  assert.deepEqual(parseReservationMigrationArgs(["--target", "codex-local"]), {
    apply: false,
    planDigest: null,
    target: "codex-local",
  });
  assert.throws(
    () => parseReservationMigrationArgs(["--target", "codex-local", "--apply"]),
    ({ exitCode }) => exitCode === 64,
  );
  const digest = "a".repeat(64);
  assert.deepEqual(
    parseReservationMigrationArgs([
      "--target",
      "codex-local",
      "--apply",
      "--plan-digest",
      digest,
    ]),
    { apply: true, planDigest: digest, target: "codex-local" },
  );
});

test("target guard rejects remote, wildcard, and non-demo projects", () => {
  assert.doesNotThrow(() =>
    assertCodexReservationMigrationTarget({
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080",
      GCLOUD_PROJECT: "demo-air-guard-v2-codex",
    }),
  );
  for (const env of [
    { FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080" },
    { FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com:443" },
    { FIRESTORE_EMULATOR_HOST: "0.0.0.0:18080" },
    {
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080",
      GCLOUD_PROJECT: "production-project",
    },
  ]) {
    assert.throws(
      () => assertCodexReservationMigrationTarget(env),
      ({ exitCode }) => exitCode === 78,
    );
  }
});

test("apply refuses a stale pointer update when the old User reappears", async () => {
  const source = user();
  const plan = planUserReservationMigration(
    state({
      users: [source],
      emailReservations: [emailReservation({ userId: "REMOVED_USER" })],
    }),
  );
  const reservationPath = plan.operations[0].writes[0].path;
  const fake = createApplyFake({
    [source.path]: structuredClone(source.data),
    "Companies/COMPANY_A/Users/REMOVED_USER": user({
      userId: "REMOVED_USER",
      email: "removed@example.com",
    }).data,
    [reservationPath]: { companyId: "COMPANY_A", userId: "REMOVED_USER" },
  });
  await assert.rejects(
    () => applyUserReservationMigrationPlan(fake.firestore, plan),
    /pointer User changed/,
  );
  assert.deepEqual(fake.documents.get(reservationPath), {
    companyId: "COMPANY_A",
    userId: "REMOVED_USER",
  });
});

test("apply refuses ownership changes and a deleted Employee before writing", async () => {
  const source = user({ employeeId: "EMPLOYEE_A" });
  const plan = planUserReservationMigration({
    users: [source],
    employees: [employee()],
    emailReservations: [],
    employeeReservations: [],
  });
  const cases = [
    {
      expected: /email ownership changed/,
      documents: {
        [source.path]: structuredClone(source.data),
        "Companies/COMPANY_A/Employees/EMPLOYEE_A": { companyId: "COMPANY_A" },
        "Companies/COMPANY_B/Users/USER_B": user({
          companyId: "COMPANY_B",
          userId: "USER_B",
          email: source.data.email,
        }).data,
      },
    },
    {
      expected: /Employee ownership changed/,
      documents: {
        [source.path]: structuredClone(source.data),
        "Companies/COMPANY_A/Employees/EMPLOYEE_A": { companyId: "COMPANY_A" },
        "Companies/COMPANY_A/Users/USER_B": user({
          userId: "USER_B",
          email: "user-b@example.com",
          employeeId: "EMPLOYEE_A",
        }).data,
      },
    },
    {
      expected: /Employee changed/,
      documents: { [source.path]: structuredClone(source.data) },
    },
  ];
  for (const { expected, documents } of cases) {
    const fake = createApplyFake(documents);
    await assert.rejects(
      () => applyUserReservationMigrationPlan(fake.firestore, plan),
      expected,
    );
    assert.equal(fake.calls.some(({ type }) => type !== "get"), false);
  }
});

function createApplyFake(initialDocuments = {}) {
  const documents = new Map(Object.entries(initialDocuments));
  const calls = [];
  function createQuery(scope, path) {
    return {
      kind: "query",
      scope,
      path,
      description: `${scope}:${path}`,
      where(field, operator, value) {
        assert.equal(operator, "==");
        this.field = field;
        this.value = value;
        return this;
      },
      limit(value) {
        this.limitValue = value;
        return this;
      },
    };
  }
  const firestore = {
    doc(path) {
      return { path };
    },
    collectionGroup(name) {
      return createQuery("collection-group", name);
    },
    collection(path) {
      return createQuery("collection", path);
    },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        async get(reference) {
          if (reference.kind === "query") {
            calls.push({ type: "get", path: reference.description });
            const docs = [];
            for (const [path, data] of documents) {
              const parts = path.split("/");
              const included =
                reference.scope === "collection-group"
                  ? parts.length >= 2 &&
                    parts[parts.length - 2] === reference.path
                  : path.startsWith(`${reference.path}/`) &&
                    parts.length === reference.path.split("/").length + 1;
              if (included && data?.[reference.field] === reference.value) {
                docs.push({ ref: { path }, data: () => data });
              }
            }
            return { docs: docs.slice(0, reference.limitValue) };
          }
          calls.push({ type: "get", path: reference.path });
          const data = documents.get(reference.path);
          return { exists: data !== undefined, data: () => data };
        },
        create(reference, data) {
          calls.push({ type: "create", path: reference.path });
          writes.push({ type: "create", path: reference.path, data });
        },
        update(reference, data) {
          calls.push({ type: "update", path: reference.path });
          writes.push({ type: "update", path: reference.path, data });
        },
      };
      await callback(transaction);
      for (const write of writes) documents.set(write.path, write.data);
    },
  };
  return { firestore, documents, calls };
}

test("apply reads source and all reservations before writes and never changes User", async () => {
  const source = user({ employeeId: "EMPLOYEE_A" });
  const plan = planUserReservationMigration({
    users: [source],
    employees: [employee()],
    emailReservations: [],
    employeeReservations: [],
  });
  const fake = createApplyFake({
    [source.path]: structuredClone(source.data),
    "Companies/COMPANY_A/Employees/EMPLOYEE_A": { companyId: "COMPANY_A" },
  });
  const before = structuredClone(fake.documents.get(source.path));
  assert.equal(await applyUserReservationMigrationPlan(fake.firestore, plan), 1);
  const firstWrite = fake.calls.findIndex(({ type }) => type !== "get");
  assert.equal(firstWrite, 6);
  assert.equal(
    fake.calls.slice(firstWrite).some(({ type }) => type === "get"),
    false,
  );
  assert.deepEqual(fake.documents.get(source.path), before);
  assert.deepEqual(
    fake.documents.get("Companies/COMPANY_A/EmployeeUserReservations/EMPLOYEE_A"),
    { userId: "USER_A" },
  );
});

test("a partially applied plan is safe after a fresh re-plan", async () => {
  const source = user();
  const firstPlan = planUserReservationMigration(
    state({ users: [source], emailReservations: [] }),
  );
  const fake = createApplyFake({ [source.path]: structuredClone(source.data) });
  await applyUserReservationMigrationPlan(fake.firestore, firstPlan);
  const secondPlan = planUserReservationMigration(
    state({
      users: [source],
      emailReservations: [
        {
          path: firstPlan.operations[0].writes[0].path,
          data: firstPlan.operations[0].writes[0].data,
        },
      ],
    }),
  );
  assert.deepEqual(secondPlan.findings, []);
  assert.deepEqual(secondPlan.operations[0].writes, []);
  assert.equal(await applyUserReservationMigrationPlan(fake.firestore, secondPlan), 0);
});
