import assert from "node:assert/strict";
import test from "node:test";

import { createUserEmailReservationId } from "../../functions/modules/auth/createTemporaryUser.js";
import {
  TerminateEmployeeError,
  terminateEmployee,
} from "../../functions/modules/auth/lifecycle/terminateEmployee.js";
import {
  createFirestoreLifecycleOperationStore,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationStore.js";
import {
  employeeLifecycleHeadPath,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_OPERATION_STATES,
  lifecycleOperationPath,
} from "../../functions/modules/auth/lifecycle/lifecycleOperationSchema.js";

const COMPANY_ID = "company-a";
const ACTOR_UID = "actor-a";
const EMPLOYEE_ID = "employee-a";
const TARGET_UID = "target-a";
const EMAIL = "target@example.test";
const OPERATION_ID = "018f0f5e-7b4a-4a1f-8f35-cd5658b762d1";
const ACTOR_PATH = `Companies/${COMPANY_ID}/Users/${ACTOR_UID}`;
const EMPLOYEE_PATH = `Companies/${COMPANY_ID}/Employees/${EMPLOYEE_ID}`;
const TARGET_PATH = `Companies/${COMPANY_ID}/Users/${TARGET_UID}`;
const EMPLOYEE_RESERVATION_PATH =
  `Companies/${COMPANY_ID}/EmployeeUserReservations/${EMPLOYEE_ID}`;
const EMAIL_RESERVATION_PATH =
  `UserEmailReservations/${createUserEmailReservationId(EMAIL)}`;
const TIMESTAMP = Object.freeze({ kind: "server-timestamp" });

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function documentSnapshot(path, data) {
  const exists = data !== undefined;
  const id = path.split("/").at(-1);
  return {
    exists,
    id,
    ref: { path, id },
    data: () => clone(data),
  };
}

function createFakeFirestore(initial = {}) {
  const documents = new Map(
    Object.entries(initial).map(([path, data]) => [path, clone(data)]),
  );
  const calls = [];

  const readReference = (reference) => {
    if (reference.kind === "query") {
      const docs = [];
      const prefix = `${reference.collectionPath}/`;
      for (const [path, data] of documents.entries()) {
        if (!path.startsWith(prefix) || path.slice(prefix.length).includes("/")) {
          continue;
        }
        if (data[reference.field] !== reference.value) continue;
        docs.push(documentSnapshot(path, data));
        if (docs.length >= reference.max) break;
      }
      return { docs };
    }
    return documentSnapshot(reference.path, documents.get(reference.path));
  };

  const firestore = {
    doc(path) {
      return {
        kind: "doc",
        path,
        id: path.split("/").at(-1),
        async get() {
          calls.push(["get", path]);
          return readReference(this);
        },
      };
    },
    collection(collectionPath) {
      return {
        where(field, operator, value) {
          assert.equal(operator, "==");
          return {
            limit(max) {
              return {
                kind: "query",
                collectionPath,
                field,
                value,
                max,
                async get() {
                  calls.push(["query", collectionPath, field, value, max]);
                  return readReference(this);
                },
              };
            },
          };
        },
      };
    },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        async get(reference) {
          calls.push(["transaction.get", reference.path ?? reference.collectionPath]);
          return readReference(reference);
        },
        create(reference, data) {
          writes.push(["create", reference.path, clone(data)]);
        },
        set(reference, data) {
          writes.push(["set", reference.path, clone(data)]);
        },
        update(reference, data) {
          writes.push(["update", reference.path, clone(data)]);
        },
        delete(reference) {
          writes.push(["delete", reference.path]);
        },
      };
      const result = await callback(transaction);
      for (const [method, path, data] of writes) {
        if (method === "create") {
          if (documents.has(path)) throw new Error("already exists");
          documents.set(path, data);
        } else if (method === "set") {
          documents.set(path, data);
        } else if (method === "update") {
          if (!documents.has(path)) throw new Error("not found");
          documents.set(path, { ...documents.get(path), ...data });
        } else {
          documents.delete(path);
        }
      }
      return result;
    },
  };
  return { firestore, documents, calls };
}

function authRecord(overrides = {}) {
  return {
    uid: TARGET_UID,
    email: EMAIL,
    emailVerified: true,
    disabled: false,
    customClaims: { companyId: COMPANY_ID, isSuperUser: false },
    ...overrides,
  };
}

function createFakeAuth(initial = authRecord()) {
  let current = initial ? clone(initial) : null;
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
        return clone(current);
      },
      async updateUser(uid, update) {
        calls.push(["updateUser", uid, clone(update)]);
        if (!current) throw notFound();
        current = { ...current, ...update };
        return clone(current);
      },
      async deleteUser(uid) {
        calls.push(["deleteUser", uid]);
        if (!current) throw notFound();
        current = null;
      },
    },
    get current() {
      return current && clone(current);
    },
  };
}

function baseDocuments(overrides = {}) {
  return {
    [ACTOR_PATH]: {
      companyId: COMPANY_ID,
      displayName: "担当者",
      isTemporary: false,
      disabled: false,
      isAdmin: false,
      roles: ["human-resource"],
    },
    [EMPLOYEE_PATH]: {
      displayName: "退職者",
      employmentStatus: "ACTIVE",
      dateOfHire: "2020-04-01",
      dateOfTermination: null,
      reasonOfTermination: null,
    },
    ...overrides,
  };
}

function registeredDocuments(overrides = {}) {
  return baseDocuments({
    [TARGET_PATH]: {
      companyId: COMPANY_ID,
      displayName: "退職者",
      email: EMAIL,
      employeeId: EMPLOYEE_ID,
      isTemporary: false,
      disabled: false,
      isAdmin: false,
      roles: [],
    },
    [EMPLOYEE_RESERVATION_PATH]: { userId: TARGET_UID },
    [EMAIL_RESERVATION_PATH]: { companyId: COMPANY_ID, userId: TARGET_UID },
    ...overrides,
  });
}

function input(overrides = {}) {
  return {
    operationId: OPERATION_ID,
    employeeId: EMPLOYEE_ID,
    terminationDate: "2026-08-24",
    reasonOfTermination: "契約満了",
    ...overrides,
  };
}

async function run({ documents, auth = createFakeAuth(), cleanupFcm, store } = {}) {
  const fake = createFakeFirestore(documents ?? baseDocuments());
  const resolvedStore = store ?? createFirestoreLifecycleOperationStore({
    firestore: fake.firestore,
    timestampFactory: () => TIMESTAMP,
  });
  const cleanupCalls = [];
  const response = await terminateEmployee({
    firestore: fake.firestore,
    auth: auth.auth,
    cleanupFcm: cleanupFcm ?? (async (context) => cleanupCalls.push(context)),
    identity: { uid: ACTOR_UID, companyId: COMPANY_ID, isSuperUser: false },
    input: input(),
    serverTodayJst: "2026-08-24",
    store: resolvedStore,
  });
  return { response, fake, auth, cleanupCalls, store: resolvedStore };
}

test("Employee-only retirement updates only Employee and completes atomically", async () => {
  const result = await run();
  assert.deepEqual(result.response.userDeletion, {
    kind: "none",
    userAccessDeleted: false,
  });
  assert.equal(result.response.status, "completed");
  assert.equal(
    result.fake.documents.get(EMPLOYEE_PATH).employmentStatus,
    "RESIGNED",
  );
  assert.ok(
    result.fake.documents.get(EMPLOYEE_PATH).dateOfTermination instanceof Date,
  );
  assert.equal(result.auth.calls.length, 0);
  assert.equal(result.cleanupCalls.length, 0);
  assert.equal(
    result.fake.documents.get(employeeLifecycleHeadPath(COMPANY_ID, EMPLOYEE_ID))
      .revision,
    1,
  );

  const replay = await terminateEmployee({
    firestore: result.fake.firestore,
    auth: result.auth.auth,
    cleanupFcm: async () => {},
    identity: { uid: ACTOR_UID, companyId: COMPANY_ID, isSuperUser: false },
    input: input(),
    serverTodayJst: "2026-08-24",
    store: result.store,
  });
  assert.equal(replay.status, "completed");
  assert.equal(
    result.fake.documents.get(employeeLifecycleHeadPath(COMPANY_ID, EMPLOYEE_ID))
      .revision,
    1,
  );
});

test("registered Employee retirement disables and deletes Auth, User, and both reservations", async () => {
  const result = await run({ documents: registeredDocuments() });
  assert.deepEqual(result.response.userDeletion, {
    kind: "registered",
    userAccessDeleted: true,
  });
  assert.equal(result.response.status, "completed");
  assert.equal(result.auth.current, null);
  assert.equal(result.fake.documents.has(TARGET_PATH), false);
  assert.equal(result.fake.documents.has(EMPLOYEE_RESERVATION_PATH), false);
  assert.equal(result.fake.documents.has(EMAIL_RESERVATION_PATH), false);
  assert.equal(result.fake.documents.has(EMPLOYEE_PATH), true);
  assert.equal(result.cleanupCalls.length, 1);
  assert.equal(result.cleanupCalls[0].targetUserUid, TARGET_UID);
  assert.equal(
    result.auth.calls.some(([method]) => method === "updateUser"),
    true,
  );
  assert.equal(
    result.auth.calls.some(([method]) => method === "deleteUser"),
    true,
  );
});

test("registered retirement reports cleanup pending and resumes without restoring core data", async () => {
  let failCleanup = true;
  const cleanupFcm = async () => {
    if (failCleanup) throw new Error("cleanup unavailable");
  };
  const first = await run({ documents: registeredDocuments(), cleanupFcm });
  assert.equal(first.response.status, "completed-cleanup-pending");
  assert.equal(first.fake.documents.has(TARGET_PATH), false);
  const operationPath = lifecycleOperationPath(COMPANY_ID, OPERATION_ID);
  assert.equal(
    first.fake.documents.get(operationPath).state,
    LIFECYCLE_OPERATION_STATES.DATA_FINALIZED,
  );

  failCleanup = false;
  const resumed = await terminateEmployee({
    firestore: first.fake.firestore,
    auth: first.auth.auth,
    cleanupFcm,
    identity: { uid: ACTOR_UID, companyId: COMPANY_ID, isSuperUser: false },
    input: input(),
    serverTodayJst: "2026-08-24",
    store: first.store,
  });
  assert.equal(resumed.status, "completed");
  assert.equal(first.fake.documents.has(TARGET_PATH), false);
});

test("temporary User relation is rejected before operation and Auth mutation", async () => {
  const fake = createFakeFirestore(
    registeredDocuments({
      [TARGET_PATH]: {
        ...registeredDocuments()[TARGET_PATH],
        isTemporary: true,
      },
    }),
  );
  const auth = createFakeAuth();
  await assert.rejects(
    terminateEmployee({
      firestore: fake.firestore,
      auth: auth.auth,
      cleanupFcm: async () => {},
      identity: { uid: ACTOR_UID, companyId: COMPANY_ID, isSuperUser: false },
      input: input(),
      serverTodayJst: "2026-08-24",
      store: createFirestoreLifecycleOperationStore({
        firestore: fake.firestore,
        timestampFactory: () => TIMESTAMP,
      }),
    }),
    (error) =>
      error instanceof TerminateEmployeeError &&
      error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.TEMPORARY_USER_LINKED,
  );
  assert.equal(
    fake.documents.has(lifecycleOperationPath(COMPANY_ID, OPERATION_ID)),
    false,
  );
  assert.equal(auth.calls.length, 0);
});

test("missing reservation with an Employee-linked User fails closed without query fallback", async () => {
  const fake = createFakeFirestore(
    baseDocuments({
      [TARGET_PATH]: registeredDocuments()[TARGET_PATH],
    }),
  );
  const auth = createFakeAuth();
  await assert.rejects(
    terminateEmployee({
      firestore: fake.firestore,
      auth: auth.auth,
      cleanupFcm: async () => {},
      identity: { uid: ACTOR_UID, companyId: COMPANY_ID, isSuperUser: false },
      input: input(),
      serverTodayJst: "2026-08-24",
      store: createFirestoreLifecycleOperationStore({
        firestore: fake.firestore,
        timestampFactory: () => TIMESTAMP,
      }),
    }),
    (error) =>
      error instanceof TerminateEmployeeError &&
      error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.RELATIONSHIP_INCONSISTENT,
  );
  assert.equal(auth.calls.length, 0);
});

test("super-user target mismatch is rejected before durable operation", async () => {
  const fake = createFakeFirestore(registeredDocuments());
  const auth = createFakeAuth(
    authRecord({
      customClaims: { companyId: COMPANY_ID, isSuperUser: true },
    }),
  );
  await assert.rejects(
    terminateEmployee({
      firestore: fake.firestore,
      auth: auth.auth,
      cleanupFcm: async () => {},
      identity: { uid: ACTOR_UID, companyId: COMPANY_ID, isSuperUser: false },
      input: input(),
      serverTodayJst: "2026-08-24",
      store: createFirestoreLifecycleOperationStore({
        firestore: fake.firestore,
        timestampFactory: () => TIMESTAMP,
      }),
    }),
    (error) => error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
  );
  assert.equal(
    fake.documents.has(lifecycleOperationPath(COMPANY_ID, OPERATION_ID)),
    false,
  );
  assert.equal(auth.current.customClaims.isSuperUser, true);
});

test("company administrator linked to an Employee is not retired", async () => {
  const fake = createFakeFirestore(
    registeredDocuments({
      [TARGET_PATH]: {
        ...registeredDocuments()[TARGET_PATH],
        isAdmin: true,
      },
    }),
  );
  const auth = createFakeAuth();
  await assert.rejects(
    terminateEmployee({
      firestore: fake.firestore,
      auth: auth.auth,
      cleanupFcm: async () => {},
      identity: { uid: ACTOR_UID, companyId: COMPANY_ID, isSuperUser: false },
      input: input(),
      serverTodayJst: "2026-08-24",
      store: createFirestoreLifecycleOperationStore({
        firestore: fake.firestore,
        timestampFactory: () => TIMESTAMP,
      }),
    }),
    (error) =>
      error instanceof TerminateEmployeeError &&
      error.domainCode === LIFECYCLE_DOMAIN_ERROR_CODES.ADMIN_TARGET_DENIED,
  );
  assert.equal(auth.calls.length, 0);
  assert.equal(
    fake.documents.has(lifecycleOperationPath(COMPANY_ID, OPERATION_ID)),
    false,
  );
});
