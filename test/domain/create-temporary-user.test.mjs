import assert from "node:assert/strict";
import test from "node:test";

import FireModel from "../../functions/node_modules/@shisyamo4131/air-firebase-v2/index.js";
import ServerAdapter from "../../functions/node_modules/@shisyamo4131/air-firebase-v2-server-adapter/index.js";
import {
  createEmployeeLinkedTemporaryUser,
  createStandaloneTemporaryUser,
  createUserEmailReservationId,
  CREATE_TEMPORARY_USER_ERROR_CODES,
  CreateTemporaryUserError,
} from "../../functions/modules/auth/createTemporaryUser.js";
import { TemporaryUserCreationPolicyError } from "../../functions/modules/auth/temporaryUserCreationPolicy.js";
import { TemporaryUserManagementPolicyError } from "../../functions/modules/auth/temporaryUserManagementPolicy.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "actor-a";
const USER_ID = "temporary-new";
const EMPLOYEE_ID = "employee-a";
const ACTOR_PATH = `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`;
const USER_PATH = `Companies/${COMPANY_ID}/Users/${USER_ID}`;
const EMPLOYEE_PATH = `Companies/${COMPANY_ID}/Employees/${EMPLOYEE_ID}`;
const EMPLOYEE_RESERVATION_PATH =
  `Companies/${COMPANY_ID}/EmployeeUserReservations/${EMPLOYEE_ID}`;

function createActor(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    isTemporary: false,
    isAdmin: true,
    disabled: false,
    roles: [],
    ...overrides,
  };
}

function createSnapshot(data, exists = data !== null) {
  return {
    exists,
    data() {
      return data;
    },
  };
}

function createQuery(scope) {
  const query = {
    kind: "query",
    scope,
    filters: [],
    max: null,
    where(field, operator, value) {
      query.filters.push({ field, operator, value });
      return query;
    },
    limit(value) {
      query.max = value;
      return query;
    },
  };
  return query;
}

function createDependencies({
  preflightActor = createActor(),
  transactionActor = preflightActor,
  authExists = false,
  authError = null,
  emailReservationExists = false,
  emailUsersCount = 0,
  employee = { displayName: "田中", employmentStatus: "ACTIVE" },
  employeeReservationExists = false,
  employeeUsersCount = 0,
  attempts = 1,
} = {}) {
  const calls = [];
  let generatedIdCount = 0;

  function createReference(path) {
    const segments = path.split("/");
    return {
      kind: "document",
      id: segments.at(-1),
      path,
      async get() {
        calls.push({ method: "reference.get", path });
        if (path === ACTOR_PATH) return createSnapshot(preflightActor);
        throw new Error(`Unexpected preflight reference: ${path}`);
      },
    };
  }

  const firestore = {
    doc(path) {
      calls.push({ method: "firestore.doc", path });
      return createReference(path);
    },
    collection(path) {
      calls.push({ method: "firestore.collection", path });
      const collection = {
        kind: "collection",
        path,
        doc(id) {
          const resolvedId = id ?? USER_ID;
          if (id === undefined) generatedIdCount += 1;
          return createReference(`${path}/${resolvedId}`);
        },
        withConverter() {
          return collection;
        },
        where(field, operator, value) {
          return createQuery({ type: "collection", path }).where(
            field,
            operator,
            value,
          );
        },
      };
      return collection;
    },
    collectionGroup(name) {
      calls.push({ method: "firestore.collectionGroup", name });
      return createQuery({ type: "collection-group", name });
    },
    async runTransaction(callback) {
      calls.push({ method: "firestore.runTransaction" });
      let result;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const transaction = {
          async get(reference) {
            calls.push({
              method: "transaction.get",
              path: reference.path,
              scope: reference.scope,
              filters: reference.filters,
              max: reference.max,
              attempt,
            });
            if (reference.kind === "query") {
              const isEmailQuery =
                reference.scope.type === "collection-group";
              const count = isEmailQuery
                ? emailUsersCount
                : employeeUsersCount;
              return {
                empty: count === 0,
                docs: Array.from({ length: count }, () => ({})),
              };
            }
            if (reference.path === ACTOR_PATH) {
              return createSnapshot(transactionActor);
            }
            if (reference.path === EMPLOYEE_PATH) {
              return createSnapshot(employee);
            }
            if (reference.path === EMPLOYEE_RESERVATION_PATH) {
              return createSnapshot(
                employeeReservationExists ? { userId: "existing" } : null,
              );
            }
            if (reference.path.startsWith("UserEmailReservations/")) {
              return createSnapshot(
                emailReservationExists
                  ? { companyId: "existing", userId: "existing" }
                  : null,
              );
            }
            throw new Error(`Unexpected transaction reference: ${reference.path}`);
          },
          set(reference, data) {
            calls.push({
              method: "transaction.set",
              path: reference.path,
              data,
              attempt,
            });
          },
          create(reference, data) {
            calls.push({
              method: "transaction.create",
              path: reference.path,
              data,
              attempt,
            });
          },
        };
        result = await callback(transaction);
      }
      return result;
    },
  };

  const auth = {
    async getUserByEmail(email) {
      calls.push({ method: "auth.getUserByEmail", email });
      if (authError) throw authError;
      if (authExists) return { uid: "existing-auth" };
      const error = new Error("not found");
      error.code = "auth/user-not-found";
      throw error;
    },
  };

  FireModel.setAdapter(new ServerAdapter(firestore));
  return { auth, firestore, calls, get generatedIdCount() { return generatedIdCount; } };
}

function standaloneInput(dependencies, overrides = {}) {
  return {
    auth: dependencies.auth,
    firestore: dependencies.firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    input: {
      email: " User@Example.COM ",
      displayName: "利用者",
      roles: ["manager"],
    },
    ...overrides,
  };
}

function linkedInput(dependencies, inputOverrides = {}, overrides = {}) {
  return {
    auth: dependencies.auth,
    firestore: dependencies.firestore,
    companyId: COMPANY_ID,
    actorUid: ACTOR_UID,
    input: {
      employeeId: EMPLOYEE_ID,
      email: "employee@example.com",
      roles: ["human-resource"],
      ...inputOverrides,
    },
    ...overrides,
  };
}

async function assertCreateError(run, code) {
  await assert.rejects(run, (error) => {
    assert.ok(error instanceof CreateTemporaryUserError);
    assert.equal(error.code, code);
    return true;
  });
}

function assertReadsPrecedeWrites(calls) {
  const transactionCalls = calls.filter((call) =>
    call.method.startsWith("transaction."),
  );
  const firstWriteIndex = transactionCalls.findIndex((call) =>
    ["transaction.set", "transaction.create"].includes(call.method),
  );
  assert.notEqual(firstWriteIndex, -1);
  assert.equal(
    transactionCalls
      .slice(firstWriteIndex + 1)
      .some((call) => call.method === "transaction.get"),
    false,
  );
}

test("email reservation IDs use a stable SHA-256 digest", () => {
  assert.equal(
    createUserEmailReservationId("user@example.com"),
    "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514",
  );
  assert.equal(
    createUserEmailReservationId(" User@Example.COM "),
    createUserEmailReservationId("user@example.com"),
  );
  assert.throws(
    () => createUserEmailReservationId("invalid-email"),
    TemporaryUserCreationPolicyError,
  );
});

test("standalone creation writes one User and one email reservation", async () => {
  const dependencies = createDependencies();
  const result = await createStandaloneTemporaryUser(
    standaloneInput(dependencies),
  );

  assert.deepEqual(result, {
    success: true,
    userId: USER_ID,
    linkType: "standalone",
    employeeId: null,
  });
  assert.equal(dependencies.generatedIdCount, 1);
  assert.deepEqual(
    dependencies.calls.filter((call) => call.method === "auth.getUserByEmail"),
    [{ method: "auth.getUserByEmail", email: "user@example.com" }],
  );

  const userWrite = dependencies.calls.find(
    (call) => call.method === "transaction.set",
  );
  assert.equal(userWrite.path, USER_PATH);
  assert.equal(userWrite.data.email, "user@example.com");
  assert.equal(userWrite.data.companyId, COMPANY_ID);
  assert.equal(userWrite.data.isTemporary, true);
  assert.equal(userWrite.data.isAdmin, false);
  assert.equal(userWrite.data.disabled, false);
  assert.ok(userWrite.data.createdAt instanceof Date);

  const reservations = dependencies.calls.filter(
    (call) => call.method === "transaction.create",
  );
  assert.equal(reservations.length, 1);
  assert.deepEqual(reservations[0].data, {
    companyId: COMPANY_ID,
    userId: USER_ID,
  });
  assertReadsPrecedeWrites(dependencies.calls);
});

test("Employee-linked creation derives Employee data and writes both reservations", async () => {
  const dependencies = createDependencies();
  const result = await createEmployeeLinkedTemporaryUser(
    linkedInput(dependencies),
  );

  assert.deepEqual(result, {
    success: true,
    userId: USER_ID,
    linkType: "employee-linked",
    employeeId: EMPLOYEE_ID,
  });
  const userWrite = dependencies.calls.find(
    (call) => call.method === "transaction.set",
  );
  assert.equal(userWrite.data.displayName, "田中");
  assert.equal(userWrite.data.employeeId, EMPLOYEE_ID);
  assert.deepEqual(userWrite.data.roles, ["human-resource"]);

  const reservations = dependencies.calls.filter(
    (call) => call.method === "transaction.create",
  );
  assert.equal(reservations.length, 2);
  assert.equal(reservations[1].path, EMPLOYEE_RESERVATION_PATH);
  assert.deepEqual(reservations[1].data, { userId: USER_ID });
  assertReadsPrecedeWrites(dependencies.calls);

  const employeeQueryRead = dependencies.calls.find(
    (call) =>
      call.method === "transaction.get" &&
      call.scope?.type === "collection",
  );
  assert.equal(employeeQueryRead.scope.path, `Companies/${COMPANY_ID}/Users`);
  assert.deepEqual(employeeQueryRead.filters, [
    { field: "employeeId", operator: "==", value: EMPLOYEE_ID },
  ]);
  assert.equal(employeeQueryRead.max, 2);
});

test("invalid Employee input is rejected before actor, Auth, or transaction reads", async () => {
  const dependencies = createDependencies();
  await assert.rejects(
    () =>
      createEmployeeLinkedTemporaryUser(
        linkedInput(dependencies, { isAdmin: true }),
      ),
    TemporaryUserCreationPolicyError,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "reference.get"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "auth.getUserByEmail"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "firestore.runTransaction"),
    false,
  );
});

test("unauthorized actors cannot probe Authentication email existence", async () => {
  const dependencies = createDependencies({
    preflightActor: createActor({ isAdmin: false, roles: ["labor"] }),
  });
  await assert.rejects(
    () => createStandaloneTemporaryUser(standaloneInput(dependencies)),
    TemporaryUserManagementPolicyError,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "auth.getUserByEmail"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "firestore.runTransaction"),
    false,
  );
});

test("final transaction reauthorization blocks a revoked actor", async () => {
  const dependencies = createDependencies({
    transactionActor: createActor({ disabled: true }),
  });
  await assert.rejects(
    () => createStandaloneTemporaryUser(standaloneInput(dependencies)),
    TemporaryUserManagementPolicyError,
  );
  assert.equal(
    dependencies.calls.filter((call) => call.method === "auth.getUserByEmail")
      .length,
    1,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.set"),
    false,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "transaction.create"),
    false,
  );
});

test("existing Authentication email prevents a Firestore transaction", async () => {
  const dependencies = createDependencies({ authExists: true });
  await assertCreateError(
    () => createStandaloneTemporaryUser(standaloneInput(dependencies)),
    CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "firestore.runTransaction"),
    false,
  );
});

test("email reservation and legacy User duplicates fail without writes", async () => {
  for (const [options, code] of [
    [
      { emailReservationExists: true },
      CREATE_TEMPORARY_USER_ERROR_CODES.EMAIL_RESERVATION_EXISTS,
    ],
    [
      { emailUsersCount: 1 },
      CREATE_TEMPORARY_USER_ERROR_CODES.EMAIL_USER_EXISTS,
    ],
  ]) {
    const dependencies = createDependencies(options);
    await assertCreateError(
      () => createStandaloneTemporaryUser(standaloneInput(dependencies)),
      code,
    );
    assert.equal(
      dependencies.calls.some((call) => call.method === "transaction.set"),
      false,
    );
  }
});

test("Employee existence and uniqueness failures do not write", async () => {
  for (const [options, code] of [
    [
      { employee: null },
      CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_NOT_FOUND,
    ],
    [
      { employeeReservationExists: true },
      CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_RESERVATION_EXISTS,
    ],
    [
      { employeeUsersCount: 1 },
      CREATE_TEMPORARY_USER_ERROR_CODES.EMPLOYEE_USER_EXISTS,
    ],
  ]) {
    const dependencies = createDependencies(options);
    await assertCreateError(
      () => createEmployeeLinkedTemporaryUser(linkedInput(dependencies)),
      code,
    );
    assert.equal(
      dependencies.calls.some((call) => call.method === "transaction.set"),
      false,
    );
  }
});

test("transaction retries reuse one ID and perform Auth lookup once", async () => {
  const dependencies = createDependencies({ attempts: 2 });
  await createStandaloneTemporaryUser(standaloneInput(dependencies));

  assert.equal(dependencies.generatedIdCount, 1);
  assert.equal(
    dependencies.calls.filter((call) => call.method === "auth.getUserByEmail")
      .length,
    1,
  );
  assert.deepEqual(
    dependencies.calls
      .filter((call) => call.method === "transaction.set")
      .map((call) => call.path),
    [USER_PATH, USER_PATH],
  );
  const reservationWrites = dependencies.calls.filter(
    (call) => call.method === "transaction.create",
  );
  assert.equal(new Set(reservationWrites.map((call) => call.path)).size, 1);
  assert.deepEqual(
    reservationWrites.map((call) => call.data.userId),
    [USER_ID, USER_ID],
  );
});

test("missing actors fail at the earliest safe boundary", async () => {
  const preflightMissing = createDependencies({ preflightActor: null });
  await assertCreateError(
    () => createStandaloneTemporaryUser(standaloneInput(preflightMissing)),
    CREATE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND,
  );
  assert.equal(
    preflightMissing.calls.some(
      (call) => call.method === "auth.getUserByEmail",
    ),
    false,
  );

  const transactionMissing = createDependencies({ transactionActor: null });
  await assertCreateError(
    () => createStandaloneTemporaryUser(standaloneInput(transactionMissing)),
    CREATE_TEMPORARY_USER_ERROR_CODES.ACTOR_USER_NOT_FOUND,
  );
  assert.equal(
    transactionMissing.calls.filter(
      (call) => call.method === "auth.getUserByEmail",
    ).length,
    1,
  );
  assert.equal(
    transactionMissing.calls.some((call) => call.method === "transaction.set"),
    false,
  );
});

test("users:write actors may create and inactive Employees fail before writes", async () => {
  const delegated = createDependencies({
    preflightActor: createActor({ isAdmin: false, roles: ["manager"] }),
  });
  await createEmployeeLinkedTemporaryUser(linkedInput(delegated));
  assert.equal(
    delegated.calls.some((call) => call.method === "transaction.set"),
    true,
  );

  const resigned = createDependencies({
    employee: { displayName: "田中", employmentStatus: "RESIGNED" },
  });
  await assert.rejects(
    () => createEmployeeLinkedTemporaryUser(linkedInput(resigned)),
    TemporaryUserCreationPolicyError,
  );
  assert.equal(
    resigned.calls.some((call) => call.method === "transaction.set"),
    false,
  );
});

test("provision-only actors create roleless Users and cannot assign roles", async () => {
  const actor = createActor({
    isAdmin: false,
    roles: ["human-resource"],
  });
  const roleless = createDependencies({
    preflightActor: actor,
    transactionActor: actor,
  });
  await createEmployeeLinkedTemporaryUser(
    linkedInput(roleless, { roles: [] }),
  );
  const userWrite = roleless.calls.find(
    (call) => call.method === "transaction.set",
  );
  assert.deepEqual(userWrite.data.roles, []);

  const assigned = createDependencies({
    preflightActor: actor,
    transactionActor: actor,
  });
  await assert.rejects(
    () => createEmployeeLinkedTemporaryUser(linkedInput(assigned)),
    (error) =>
      error instanceof TemporaryUserManagementPolicyError &&
      error.code === "actor-role-assignment-denied",
  );
  assert.equal(
    assigned.calls.some((call) => call.method === "auth.getUserByEmail"),
    false,
  );
  assert.equal(
    assigned.calls.some((call) => call.method === "transaction.set"),
    false,
  );
});

test("required identities and services fail before external work", async () => {
  const dependencies = createDependencies();
  for (const [overrides, code] of [
    [{ companyId: "" }, CREATE_TEMPORARY_USER_ERROR_CODES.REQUIRED_FIELD_MISSING],
    [{ actorUid: "" }, CREATE_TEMPORARY_USER_ERROR_CODES.REQUIRED_FIELD_MISSING],
    [{ companyId: "company/a" }, CREATE_TEMPORARY_USER_ERROR_CODES.IDENTIFIER_INVALID],
    [{ actorUid: " actor-a" }, CREATE_TEMPORARY_USER_ERROR_CODES.IDENTIFIER_INVALID],
    [{ auth: {} }, CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_SERVICE_INVALID],
    [{ firestore: {} }, CREATE_TEMPORARY_USER_ERROR_CODES.FIRESTORE_SERVICE_INVALID],
  ]) {
    await assertCreateError(
      () =>
        createStandaloneTemporaryUser(
          standaloneInput(dependencies, overrides),
        ),
      code,
    );
  }
});

test("unexpected Auth errors are preserved for safe API mapping", async () => {
  const authError = Object.assign(new Error("synthetic auth failure"), {
    code: "auth/internal-error",
  });
  const dependencies = createDependencies({ authError });
  await assert.rejects(
    () => createStandaloneTemporaryUser(standaloneInput(dependencies)),
    (error) => error === authError,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "firestore.runTransaction"),
    false,
  );
});

test("Authentication email format differences become a safe creation error", async () => {
  const authError = Object.assign(new Error("invalid email"), {
    code: "auth/invalid-email",
  });
  const dependencies = createDependencies({ authError });
  await assertCreateError(
    () => createStandaloneTemporaryUser(standaloneInput(dependencies)),
    CREATE_TEMPORARY_USER_ERROR_CODES.AUTH_EMAIL_INVALID,
  );
  assert.equal(
    dependencies.calls.some((call) => call.method === "firestore.runTransaction"),
    false,
  );
});
