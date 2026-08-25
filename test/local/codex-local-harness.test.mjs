import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  listAll,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  CODEX_LOCAL_COMPANIES,
  CODEX_LOCAL_PROJECT_ID,
  CODEX_LOCAL_USERS,
} from "../fixtures/codex-local-seed.mjs";
import {
  createUserEmailReservationId,
} from "../../functions/modules/auth/createTemporaryUser.js";

function parseEmulatorHost(name) {
  const value = process.env[name];
  assert.ok(value, `${name} must be set by Firebase Emulator Suite`);
  const separator = value.lastIndexOf(":");
  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  assert.equal(host, "127.0.0.1", `${name} must use loopback`);
  assert.ok(Number.isInteger(port), `${name} must use a numeric port`);
  return { host, port };
}

async function readDedicatedFunctionsHost() {
  const config = JSON.parse(
    await readFile(
      new URL("../../firebase.codex-test.json", import.meta.url),
      "utf8",
    ),
  );
  const { host, port } = config.emulators?.functions ?? {};
  assert.equal(host, "127.0.0.1", "Functions Emulator must use loopback");
  assert.ok(Number.isInteger(port), "Functions Emulator must use a numeric port");
  return { host, port };
}

let testEnvironment;
let rebuildApis;
const HISTORY_COMPANY_ID = "uwb07-history-reader-company";
const requireFromFunctions = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { getAuth: getAdminAuth } = requireFromFunctions("firebase-admin/auth");

async function loadRebuildApis() {
  if (!rebuildApis) {
    await import("../../functions/modules/firebase.init.js");
    rebuildApis = await import("../../functions/apis/index.js");
  }
  return rebuildApis;
}

function callableRequest({
  uid = "codex-callable-super-user",
  claims = {},
  data = { companyId: CODEX_LOCAL_COMPANIES.primary.id },
} = {}) {
  return {
    auth: {
      uid,
      token: {
        email: `${uid}@codex-test.invalid`,
        email_verified: true,
        companyId: CODEX_LOCAL_COMPANIES.primary.id,
        isSuperUser: true,
        ...claims,
      },
    },
    data,
  };
}

async function assertCallableError(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, expectedCode);
    return true;
  });
}

async function seedCallableAuthUser({
  uid,
  companyId = CODEX_LOCAL_COMPANIES.primary.id,
  email = `${uid}@codex-test.invalid`,
  emailVerified = true,
  disabled = false,
  isSuperUser = true,
}) {
  const auth = getAdminAuth();
  await auth.createUser({
    uid,
    email,
    emailVerified,
    disabled,
  });
  const customClaims = { isSuperUser };
  if (companyId !== null) customClaims.companyId = companyId;
  await auth.setCustomUserClaims(uid, customClaims);
}

async function seedRegisteredUser({
  uid,
  pathCompanyId = CODEX_LOCAL_COMPANIES.primary.id,
  companyId = pathCompanyId,
  isTemporary = false,
  disabled = false,
  isAdmin,
  email,
  displayName,
  employeeId,
  roles,
  omit = [],
}) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const data = { companyId, isTemporary, disabled };
    if (isAdmin !== undefined) data.isAdmin = isAdmin;
    if (email !== undefined) data.email = email;
    if (displayName !== undefined) data.displayName = displayName;
    if (employeeId !== undefined) data.employeeId = employeeId;
    if (roles !== undefined) data.roles = roles;
    for (const field of omit) delete data[field];
    await setDoc(
      doc(context.firestore(), "Companies", pathCompanyId, "Users", uid),
      data,
    );
  });
}

async function captureCallableError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("Callable was expected to reject");
}

async function readRegisteredUser(uid, companyId = CODEX_LOCAL_COMPANIES.primary.id) {
  let userData;
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(
      doc(context.firestore(), "Companies", companyId, "Users", uid),
    );
    assert.equal(snapshot.exists(), true);
    userData = snapshot.data();
  });
  return userData;
}

async function seedEmailReservation({ email, companyId, userId }) {
  const reservationId = createUserEmailReservationId(email);
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "UserEmailReservations", reservationId),
      { companyId, userId },
    );
  });
}

async function seedTemporaryManagementActor({
  uid,
  companyId = CODEX_LOCAL_COMPANIES.primary.id,
  isAdmin = false,
  roles = ["manager"],
  displayName = "管理担当",
}) {
  const email = `${uid}@codex-test.invalid`;
  await seedCallableAuthUser({
    uid,
    companyId,
    email,
    isSuperUser: false,
  });
  await seedRegisteredUser({
    uid,
    pathCompanyId: companyId,
    companyId,
    isAdmin,
    isTemporary: false,
    disabled: false,
    email,
    roles,
    displayName,
  });
  return { uid, companyId, email };
}

async function seedEmployee({
  employeeId,
  companyId = CODEX_LOCAL_COMPANIES.primary.id,
  displayName = "仮従業員",
  employmentStatus = "ACTIVE",
  dateOfHire = "2026-01-01",
  additionalData = {},
}) {
  const data = { displayName, employmentStatus, dateOfHire, ...additionalData };
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "Companies", companyId, "Employees", employeeId),
      data,
    );
  });
  return data;
}

function historyOperationId(index) {
  return `08000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function historyOperationRecord(index, overrides = {}) {
  const operationId = overrides.operationId ?? historyOperationId(index);
  const at =
    overrides.createdAt ??
    new Date(Date.UTC(2026, 7, 25, 0, Math.floor((index - 1) / 2)));
  return {
    schemaVersion: 1,
    operationId,
    operationType: "employee-retirement",
    state: "completed",
    actorUid: "uwb07-history-source-actor",
    actorDisplayName: "履歴担当",
    employeeId: `history-employee-${String(index).padStart(3, "0")}`,
    targetUserUid: null,
    targetDisplayName: null,
    reversesOperationId: null,
    terminationDate: "2026-08-20",
    reasonOfTermination: "本人都合",
    offboardingReason: null,
    correctionReasonCode: null,
    requestFingerprint: "b".repeat(64),
    authDisposition: "not-applicable",
    cleanupState: "not-applicable",
    attemptCount: 1,
    lastErrorPhase: null,
    lastErrorCode: null,
    createdAt: at,
    updatedAt: at,
    authDeletedAt: null,
    dataFinalizedAt: null,
    completedAt: at,
    ...overrides,
  };
}

async function seedHistoryOperations(records) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const batch = writeBatch(firestore);
    for (const record of records) {
      batch.set(
        doc(
          firestore,
          "Companies",
          HISTORY_COMPANY_ID,
          "LifecycleOperations",
          record.operationId,
        ),
        record,
      );
    }
    await batch.commit();
  });
}

async function removeHistoryOperations(operationIds) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const batch = writeBatch(firestore);
    for (const operationId of operationIds) {
      batch.delete(
        doc(
          firestore,
          "Companies",
          HISTORY_COMPANY_ID,
          "LifecycleOperations",
          operationId,
        ),
      );
    }
    await batch.commit();
  });
}

async function removeHistoryActor(uid) {
  let authCleanupError = null;
  try {
    await getAdminAuth().deleteUser(uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") authCleanupError = error;
  }
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(
      doc(
        context.firestore(),
        "Companies",
        HISTORY_COMPANY_ID,
        "Users",
        uid,
      ),
    );
  });
  if (authCleanupError) throw authCleanupError;
}

function actorCallableRequest({ actor, data }) {
  return callableRequest({
    uid: actor.uid,
    claims: {
      email: actor.email,
      companyId: actor.companyId,
      isSuperUser: false,
    },
    data,
  });
}

function splitSettled(results) {
  return {
    fulfilled: results.filter((result) => result.status === "fulfilled"),
    rejected: results.filter((result) => result.status === "rejected"),
  };
}

function authenticatedFirestore(uid, claims = {}) {
  return testEnvironment
    .authenticatedContext(uid, {
      email_verified: true,
      companyId: CODEX_LOCAL_COMPANIES.primary.id,
      ...claims,
    })
    .firestore();
}

function authenticatedStorage(uid, claims = {}) {
  return testEnvironment
    .authenticatedContext(uid, {
      email_verified: true,
      companyId: CODEX_LOCAL_COMPANIES.primary.id,
      ...claims,
    })
    .storage();
}

function securityReportRef(storage, companyId, fileName) {
  return storageRef(
    storage,
    `Companies/${companyId}/Operations/rules-operation/SecurityReports/${fileName}`,
  );
}

const TENANT_READ_WRITE_COLLECTIONS = [
  "ArrangementNotifications",
  "Articles",
  "Articles_archive",
  "Autonumbers",
  "Billings",
  "Customers",
  "Customers_archive",
  "Employees_archive",
  "meta",
  "OperationResults",
  "Outsourcers",
  "Outsourcers_archive",
  "Sites",
  "Sites_archive",
  "SiteOperationSchedules",
];

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, CODEX_LOCAL_PROJECT_ID);
  assert.equal(process.env.FUNCTIONS_EMULATOR, undefined);

  const firestoreHost = parseEmulatorHost("FIRESTORE_EMULATOR_HOST");
  const storageHost = parseEmulatorHost("FIREBASE_STORAGE_EMULATOR_HOST");
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
  const storageRules = await readFile(
    new URL("../../storage.rules", import.meta.url),
    "utf8",
  );
  testEnvironment = await initializeTestEnvironment({
    projectId: CODEX_LOCAL_PROJECT_ID,
    firestore: { ...firestoreHost, rules },
    storage: { ...storageHost, rules: storageRules },
  });
});

after(async () => {
  if (testEnvironment) await testEnvironment.cleanup();
});

test("dedicated seed contains only the expected synthetic company marker", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(
      doc(context.firestore(), "Companies", CODEX_LOCAL_COMPANIES.primary.id),
    );
    assert.equal(snapshot.exists(), true);
    assert.equal(snapshot.data().fixture, "codex-local-seed-v1");
  });
});

test("dedicated Functions entrypoint is ready over the Callable transport", async () => {
  const functionsHost = await readDedicatedFunctionsHost();
  const response = await fetch(
    `http://${functionsHost.host}:${functionsHost.port}/${CODEX_LOCAL_PROJECT_ID}/asia-northeast1/checkUserPreRegistration`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: {} }),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error?.status, "INVALID_ARGUMENT");
});

test("dedicated Auth seed accepts the synthetic fixture account", async () => {
  const authHost = parseEmulatorHost("FIREBASE_AUTH_EMULATOR_HOST");
  const app = initializeApp(
    { apiKey: "codex-local-only", projectId: CODEX_LOCAL_PROJECT_ID },
    `codex-test-auth-${process.pid}`,
  );
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${authHost.host}:${authHost.port}`, {
      disableWarnings: true,
    });
    const fixture = CODEX_LOCAL_USERS[0];
    const credential = await signInWithEmailAndPassword(
      auth,
      fixture.email,
      fixture.password,
    );
    assert.equal(credential.user.email, fixture.email);
  } finally {
    await deleteApp(app);
  }
});

test("Firestore Rules reject unauthenticated tenant access", async () => {
  const firestore = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
  );
});

test("Firestore Rules allow a verified active registered User in the matching tenant", async () => {
  const uid = "codex-rules-active-user";
  await seedRegisteredUser({ uid });
  const firestore = authenticatedFirestore(uid);

  await assertSucceeds(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
  );
  await assertFails(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.secondary.id)),
  );
});

test("Firestore Rules reject an unverified email", async () => {
  const uid = "codex-rules-unverified-user";
  await seedRegisteredUser({ uid });
  const firestore = authenticatedFirestore(uid, { email_verified: false });
  const missingClaimFirestore = testEnvironment
    .authenticatedContext(uid, {
      companyId: CODEX_LOCAL_COMPANIES.primary.id,
    })
    .firestore();

  await assertFails(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
  );
  await assertFails(
    getDoc(
      doc(
        missingClaimFirestore,
        "Companies",
        CODEX_LOCAL_COMPANIES.primary.id,
      ),
    ),
  );
});

test("Firestore Rules reject missing or malformed company claims", async () => {
  const uid = "codex-rules-invalid-claim-user";
  await seedRegisteredUser({ uid });
  const missingClaimFirestore = testEnvironment
    .authenticatedContext(uid, { email_verified: true })
    .firestore();

  await assertFails(
    getDoc(
      doc(
        missingClaimFirestore,
        "Companies",
        CODEX_LOCAL_COMPANIES.primary.id,
      ),
    ),
  );

  for (const companyId of [null, 1, true, ""]) {
    const firestore = authenticatedFirestore(uid, { companyId });
    await assertFails(
      getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
    );
  }
});

test("Firestore Rules reject a missing registered User", async () => {
  const firestore = authenticatedFirestore("codex-rules-missing-user");

  await assertFails(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
  );
});

test("Firestore Rules reject temporary and disabled Users", async () => {
  const temporaryUid = "codex-rules-temporary-user";
  const disabledUid = "codex-rules-disabled-user";
  await seedRegisteredUser({ uid: temporaryUid, isTemporary: true });
  await seedRegisteredUser({ uid: disabledUid, disabled: true });

  await assertFails(
    getDoc(
      doc(
        authenticatedFirestore(temporaryUid),
        "Companies",
        CODEX_LOCAL_COMPANIES.primary.id,
      ),
    ),
  );
  await assertFails(
    getDoc(
      doc(
        authenticatedFirestore(disabledUid),
        "Companies",
        CODEX_LOCAL_COMPANIES.primary.id,
      ),
    ),
  );
});

test("Firestore Rules reject malformed User registration states", async () => {
  const invalidTemporaryUid = "codex-rules-invalid-temporary-user";
  const invalidDisabledUid = "codex-rules-invalid-disabled-user";
  const missingTemporaryUid = "codex-rules-missing-temporary-user";
  const missingDisabledUid = "codex-rules-missing-disabled-user";
  await seedRegisteredUser({
    uid: invalidTemporaryUid,
    isTemporary: "false",
  });
  await seedRegisteredUser({ uid: invalidDisabledUid, disabled: "false" });
  await seedRegisteredUser({ uid: missingTemporaryUid, omit: ["isTemporary"] });
  await seedRegisteredUser({ uid: missingDisabledUid, omit: ["disabled"] });

  for (const uid of [
    invalidTemporaryUid,
    invalidDisabledUid,
    missingTemporaryUid,
    missingDisabledUid,
  ]) {
    const firestore = authenticatedFirestore(uid);
    await assertFails(
      getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
    );
  }
});

test("Firestore Rules reject a membership company mismatch", async () => {
  const uid = "codex-rules-membership-mismatch-user";
  await seedRegisteredUser({
    uid,
    companyId: CODEX_LOCAL_COMPANIES.secondary.id,
  });
  const firestore = authenticatedFirestore(uid);

  await assertFails(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
  );
});

test("Firestore Rules reject permanent super-user cross-tenant access", async () => {
  const uid = "codex-rules-super-user";
  await seedRegisteredUser({ uid });
  const firestore = authenticatedFirestore(uid, { isSuperUser: true });

  await assertSucceeds(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
  );
  await assertFails(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.secondary.id)),
  );
});

test("Firestore Rules apply the tenant identity gate to company descendants", async () => {
  const uid = "codex-rules-descendant-user";
  await seedRegisteredUser({ uid });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    for (const company of Object.values(CODEX_LOCAL_COMPANIES)) {
      await setDoc(
        doc(context.firestore(), "Companies", company.id, "RulesProbe", "probe"),
        { fixture: "tenant-identity-gate" },
      );
    }
  });
  const firestore = authenticatedFirestore(uid);

  await assertSucceeds(
    getDoc(
      doc(
        firestore,
        "Companies",
        CODEX_LOCAL_COMPANIES.primary.id,
        "RulesProbe",
        "probe",
      ),
    ),
  );
  await assertFails(
    getDoc(
      doc(
        firestore,
        "Companies",
        CODEX_LOCAL_COMPANIES.secondary.id,
        "RulesProbe",
        "probe",
      ),
    ),
  );
});

test("Firestore Rules allow Company document access only in the registered tenant", async () => {
  const uid = "codex-rules-company-document-user";
  await seedRegisteredUser({ uid });
  const firestore = authenticatedFirestore(uid);
  const sameTenant = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.primary.id,
  );
  const otherTenant = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.secondary.id,
  );

  await assertSucceeds(getDoc(sameTenant));
  await assertSucceeds(setDoc(sameTenant, { rulesProbe: true }, { merge: true }));
  await assertFails(getDoc(otherTenant));
  await assertFails(setDoc(otherTenant, { rulesProbe: true }, { merge: true }));
});

for (const collectionName of TENANT_READ_WRITE_COLLECTIONS) {
  test(`Firestore Rules enforce tenant read/write access for ${collectionName}`, async () => {
    const uid = `codex-rules-${collectionName.toLowerCase()}-user`;
    await seedRegisteredUser({ uid });
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          "Companies",
          CODEX_LOCAL_COMPANIES.secondary.id,
          collectionName,
          "rules-probe",
        ),
        { revision: 1 },
      );
    });
    const firestore = authenticatedFirestore(uid);
    const sameTenant = doc(
      firestore,
      "Companies",
      CODEX_LOCAL_COMPANIES.primary.id,
      collectionName,
      "rules-probe",
    );
    const otherTenant = doc(
      firestore,
      "Companies",
      CODEX_LOCAL_COMPANIES.secondary.id,
      collectionName,
      "rules-probe",
    );

    await assertSucceeds(setDoc(sameTenant, { revision: 1 }));
    await assertSucceeds(getDoc(sameTenant));
    await assertSucceeds(setDoc(sameTenant, { revision: 2 }));
    await assertSucceeds(deleteDoc(sameTenant));
    await assertFails(getDoc(otherTenant));
    await assertFails(setDoc(otherTenant, { revision: 2 }));
    await assertFails(deleteDoc(otherTenant));
  });
}

test("Firestore Rules keep User mutations server-only while allowing tenant reads", async () => {
  const actorUid = "uwb08-rules-user-actor";
  const targetUid = "uwb08-rules-user-target";
  await seedRegisteredUser({ uid: actorUid, isAdmin: true, roles: ["manager"] });
  await seedRegisteredUser({
    uid: targetUid,
    isAdmin: false,
    roles: ["controller"],
    displayName: "対象者",
  });
  const firestore = authenticatedFirestore(actorUid);
  const targetRef = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.primary.id,
    "Users",
    targetUid,
  );
  const newRef = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.primary.id,
    "Users",
    "uwb08-rules-forged-user",
  );

  await assertSucceeds(getDoc(targetRef));
  await assertFails(setDoc(targetRef, { displayName: "改変" }, { merge: true }));
  await assertFails(deleteDoc(targetRef));
  await assertFails(
    setDoc(newRef, {
      companyId: CODEX_LOCAL_COMPANIES.primary.id,
      isTemporary: false,
      disabled: false,
      isAdmin: true,
      roles: ["manager"],
    }),
  );
});

test("Firestore Rules keep legacy admin_users server-only", async () => {
  const uid = "uwb08-admin-users-actor";
  await seedRegisteredUser({ uid, isAdmin: true });
  const firestore = authenticatedFirestore(uid, { isSuperUser: true });
  const reference = doc(firestore, "admin_users", uid);
  await assertFails(getDoc(reference));
  await assertFails(setDoc(reference, { isAdmin: true }));
  await assertFails(deleteDoc(reference));
});

test("Firestore Rules reserve Employee lifecycle fields and deletion for Admin SDK", async () => {
  const actorUid = "uwb08-rules-employee-actor";
  await seedRegisteredUser({ uid: actorUid, roles: ["human-resource"] });
  const firestore = authenticatedFirestore(actorUid);
  const employeeRef = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.primary.id,
    "Employees",
    "uwb08-rules-employee",
  );
  const invalidEmployeeRef = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.primary.id,
    "Employees",
    "uwb08-rules-resigned-create",
  );

  await assertSucceeds(
    setDoc(employeeRef, {
      displayName: "規則社員",
      employmentStatus: "ACTIVE",
      dateOfTermination: null,
      reasonOfTermination: null,
    }),
  );
  await assertSucceeds(
    setDoc(employeeRef, { displayName: "更新社員" }, { merge: true }),
  );
  await assertFails(
    setDoc(
      employeeRef,
      {
        employmentStatus: "RESIGNED",
        dateOfTermination: new Date("2026-08-20T00:00:00+09:00"),
        reasonOfTermination: "直接退職",
      },
      { merge: true },
    ),
  );
  await assertFails(
    setDoc(
      employeeRef,
      { reasonOfTermination: "理由改変" },
      { merge: true },
    ),
  );
  await assertFails(deleteDoc(employeeRef));
  await assertFails(
    setDoc(invalidEmployeeRef, {
      displayName: "不正社員",
      employmentStatus: "RESIGNED",
      dateOfTermination: new Date("2026-08-20T00:00:00+09:00"),
      reasonOfTermination: "直接作成",
    }),
  );
});

test("Firestore Rules keep lifecycle ledger, events, locks, and heads server-only", async () => {
  const actorUid = "uwb08-rules-lifecycle-actor";
  const companyId = CODEX_LOCAL_COMPANIES.primary.id;
  await seedRegisteredUser({ uid: actorUid, isAdmin: true, roles: [] });
  const paths = [
    ["LifecycleOperations", "07000000-0000-4000-8000-000000000201"],
    [
      "LifecycleOperations",
      "07000000-0000-4000-8000-000000000201",
      "Events",
      "access-revoke-1",
    ],
    ["UserLifecycleLocks", "target-user"],
    ["EmployeeLifecycleLocks", "target-employee"],
    ["EmployeeLifecycleHeads", "target-employee"],
  ];
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    for (const path of paths) {
      await setDoc(
        doc(context.firestore(), "Companies", companyId, ...path),
        { fixture: true },
      );
    }
  });
  const firestore = authenticatedFirestore(actorUid, { isSuperUser: true });
  for (const path of paths) {
    const reference = doc(firestore, "Companies", companyId, ...path);
    await assertFails(getDoc(reference));
    await assertFails(setDoc(reference, { fixture: false }));
    await assertFails(deleteDoc(reference));
  }
});

test("Firestore Rules enforce exact FCM token create and owner transfer", async () => {
  const firstUid = "uwb08-fcm-first-owner";
  const secondUid = "uwb08-fcm-second-owner";
  const companyId = CODEX_LOCAL_COMPANIES.primary.id;
  const token = "uwb08-fcm-token";
  await seedRegisteredUser({ uid: firstUid });
  await seedRegisteredUser({ uid: secondUid });
  const firstFirestore = authenticatedFirestore(firstUid);
  const secondFirestore = authenticatedFirestore(secondUid);
  const firstRef = doc(firstFirestore, "FcmTokens", token);
  const secondRef = doc(secondFirestore, "FcmTokens", token);

  await assertSucceeds(
    setDoc(firstRef, {
      token,
      uid: firstUid,
      companyId,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(getDoc(firstRef));
  await assertFails(
    setDoc(firstRef, { updatedAt: serverTimestamp() }, { merge: true }),
  );
  await assertFails(
    setDoc(secondRef, {
      token,
      uid: secondUid,
      companyId,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(secondRef));
  await assertSucceeds(deleteDoc(firstRef));
  await assertSucceeds(
    setDoc(secondRef, {
      token,
      uid: secondUid,
      companyId,
      updatedAt: serverTimestamp(),
    }),
  );
});

test("Firestore Rules reject malformed or inactive FCM token owners", async () => {
  const companyId = CODEX_LOCAL_COMPANIES.primary.id;
  const activeUid = "uwb08-fcm-active";
  const disabledUid = "uwb08-fcm-disabled";
  const temporaryUid = "uwb08-fcm-temporary";
  await seedRegisteredUser({ uid: activeUid });
  await seedRegisteredUser({ uid: disabledUid, disabled: true });
  await seedRegisteredUser({ uid: temporaryUid, isTemporary: true });
  const activeFirestore = authenticatedFirestore(activeUid);
  const malformed = [
    {
      pathToken: "uwb08-fcm-mismatch-path",
      data: {
        token: "uwb08-fcm-other-token",
        uid: activeUid,
        companyId,
        updatedAt: serverTimestamp(),
      },
    },
    {
      pathToken: "uwb08-fcm-wrong-uid",
      data: {
        token: "uwb08-fcm-wrong-uid",
        uid: "another-user",
        companyId,
        updatedAt: serverTimestamp(),
      },
    },
    {
      pathToken: "uwb08-fcm-wrong-company",
      data: {
        token: "uwb08-fcm-wrong-company",
        uid: activeUid,
        companyId: CODEX_LOCAL_COMPANIES.secondary.id,
        updatedAt: serverTimestamp(),
      },
    },
    {
      pathToken: "uwb08-fcm-unknown-field",
      data: {
        token: "uwb08-fcm-unknown-field",
        uid: activeUid,
        companyId,
        updatedAt: serverTimestamp(),
        ownerOverride: true,
      },
    },
    {
      pathToken: "uwb08-fcm-invalid-time",
      data: {
        token: "uwb08-fcm-invalid-time",
        uid: activeUid,
        companyId,
        updatedAt: "now",
      },
    },
  ];
  for (const candidate of malformed) {
    await assertFails(
      setDoc(
        doc(activeFirestore, "FcmTokens", candidate.pathToken),
        candidate.data,
      ),
    );
  }
  for (const uid of [disabledUid, temporaryUid, "uwb08-fcm-missing"]) {
    const firestore = authenticatedFirestore(uid);
    const token = `${uid}-token`;
    await assertFails(
      setDoc(doc(firestore, "FcmTokens", token), {
        token,
        uid,
        companyId,
        updatedAt: serverTimestamp(),
      }),
    );
  }
});

test("Firestore Rules keep User reservation collections server-only", async () => {
  const companyId = CODEX_LOCAL_COMPANIES.primary.id;
  const sameTenantUid = "uwb04-rules-reservation-primary";
  const otherTenantUid = "uwb04-rules-reservation-secondary";
  const email = "uwb04-rules@codex-test.invalid";
  const emailReservationId = createUserEmailReservationId(email);
  const employeeId = "uwb04-rules-employee";
  await seedRegisteredUser({
    uid: sameTenantUid,
    isAdmin: true,
    roles: [],
  });
  await seedRegisteredUser({
    uid: otherTenantUid,
    pathCompanyId: CODEX_LOCAL_COMPANIES.secondary.id,
    isAdmin: true,
    roles: [],
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(
      doc(firestore, "UserEmailReservations", emailReservationId),
      { companyId, userId: "uwb04-rules-user" },
    );
    await setDoc(
      doc(
        firestore,
        "Companies",
        companyId,
        "EmployeeUserReservations",
        employeeId,
      ),
      { userId: "uwb04-rules-user" },
    );
    await setDoc(
      doc(
        firestore,
        "Companies",
        companyId,
        "EmployeeUserReservations",
        employeeId,
        "Nested",
        "probe",
      ),
      { fixture: true },
    );
  });

  const contexts = [
    authenticatedFirestore(sameTenantUid, { isSuperUser: true }),
    authenticatedFirestore(otherTenantUid, {
      companyId: CODEX_LOCAL_COMPANIES.secondary.id,
      isSuperUser: true,
    }),
    testEnvironment.unauthenticatedContext().firestore(),
  ];
  for (const firestore of contexts) {
    const emailReservation = doc(
      firestore,
      "UserEmailReservations",
      emailReservationId,
    );
    const employeeReservation = doc(
      firestore,
      "Companies",
      companyId,
      "EmployeeUserReservations",
      employeeId,
    );
    await assertFails(getDoc(emailReservation));
    await assertFails(setDoc(emailReservation, { companyId, userId: "forged" }));
    await assertFails(deleteDoc(emailReservation));
    await assertFails(getDoc(employeeReservation));
    await assertFails(setDoc(employeeReservation, { userId: "forged" }));
    await assertFails(deleteDoc(employeeReservation));
  }

  const sameTenantFirestore = contexts[0];
  await assertFails(
    getDocs(collection(sameTenantFirestore, "UserEmailReservations")),
  );
  await assertFails(
    getDocs(
      collection(
        sameTenantFirestore,
        "Companies",
        companyId,
        "EmployeeUserReservations",
      ),
    ),
  );
  const nestedReservation = doc(
    sameTenantFirestore,
    "Companies",
    companyId,
    "EmployeeUserReservations",
    employeeId,
    "Nested",
    "probe",
  );
  await assertFails(getDoc(nestedReservation));
  await assertFails(setDoc(nestedReservation, { fixture: false }));
  await assertFails(deleteDoc(nestedReservation));

  const allowedProbe = doc(
    sameTenantFirestore,
    "Companies",
    companyId,
    "RulesProbe",
    "uwb04-batch-smuggling",
  );
  const forbiddenProbe = doc(
    sameTenantFirestore,
    "UserEmailReservations",
    createUserEmailReservationId("uwb04-batch@codex-test.invalid"),
  );
  const batch = writeBatch(sameTenantFirestore);
  batch.set(allowedProbe, { fixture: true });
  batch.set(forbiddenProbe, { companyId, userId: "forged" });
  await assertFails(batch.commit());
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    assert.equal(
      (
        await getDoc(
          doc(
            context.firestore(),
            "Companies",
            companyId,
            "RulesProbe",
            "uwb04-batch-smuggling",
          ),
        )
      ).exists(),
      false,
    );
  });
});

test("Firestore Rules keep SecurityReportIndexes client writes denied", async () => {
  const uid = "codex-rules-security-report-index-user";
  await seedRegisteredUser({ uid });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    for (const company of Object.values(CODEX_LOCAL_COMPANIES)) {
      await setDoc(
        doc(
          context.firestore(),
          "Companies",
          company.id,
          "SecurityReportIndexes",
          "rules-probe",
        ),
        { fixture: true },
      );
    }
  });
  const firestore = authenticatedFirestore(uid);
  const sameTenant = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.primary.id,
    "SecurityReportIndexes",
    "rules-probe",
  );
  const otherTenant = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.secondary.id,
    "SecurityReportIndexes",
    "rules-probe",
  );

  await assertSucceeds(getDoc(sameTenant));
  await assertFails(setDoc(sameTenant, { fixture: false }));
  await assertFails(deleteDoc(sameTenant));
  await assertFails(getDoc(otherTenant));

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    for (const company of Object.values(CODEX_LOCAL_COMPANIES)) {
      await deleteDoc(
        doc(
          context.firestore(),
          "Companies",
          company.id,
          "SecurityReportIndexes",
          "rules-probe",
        ),
      );
    }
  });
});

test("Firestore Rules keep StripeData client update and delete denied", async () => {
  const uid = "codex-rules-stripe-data-user";
  await seedRegisteredUser({ uid });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    for (const company of Object.values(CODEX_LOCAL_COMPANIES)) {
      await setDoc(
        doc(
          context.firestore(),
          "Companies",
          company.id,
          "StripeData",
          "existing-session",
        ),
        { fixture: true },
      );
    }
  });
  const firestore = authenticatedFirestore(uid);
  const existingSameTenant = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.primary.id,
    "StripeData",
    "existing-session",
  );
  const newSameTenant = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.primary.id,
    "StripeData",
    "new-session",
  );
  const existingOtherTenant = doc(
    firestore,
    "Companies",
    CODEX_LOCAL_COMPANIES.secondary.id,
    "StripeData",
    "existing-session",
  );

  await assertSucceeds(getDoc(existingSameTenant));
  await assertSucceeds(setDoc(newSameTenant, { fixture: true }));
  await assertFails(setDoc(existingSameTenant, { fixture: false }));
  await assertFails(deleteDoc(existingSameTenant));
  await assertFails(getDoc(existingOtherTenant));
  await assertFails(setDoc(existingOtherTenant, { fixture: false }));
  await assertFails(deleteDoc(existingOtherTenant));
});

test("Storage Rules reject unauthenticated SecurityReports access", async () => {
  const storage = testEnvironment.unauthenticatedContext().storage();
  const report = securityReportRef(
    storage,
    CODEX_LOCAL_COMPANIES.primary.id,
    "unauthenticated.jpg",
  );

  await assertFails(uploadBytes(report, new Uint8Array([1])));
  await assertFails(getMetadata(report));
});

test("Storage Rules allow an active registered User only in the matching tenant", async () => {
  const uid = "codex-storage-active-user";
  await seedRegisteredUser({ uid });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(
      securityReportRef(
        context.storage(),
        CODEX_LOCAL_COMPANIES.secondary.id,
        "other-tenant.jpg",
      ),
      new Uint8Array([2]),
    );
  });
  const storage = authenticatedStorage(uid);
  const sameTenant = securityReportRef(
    storage,
    CODEX_LOCAL_COMPANIES.primary.id,
    "same-tenant.jpg",
  );
  const otherTenant = securityReportRef(
    storage,
    CODEX_LOCAL_COMPANIES.secondary.id,
    "other-tenant.jpg",
  );

  await assertSucceeds(
    uploadBytes(sameTenant, new Uint8Array([1]), {
      contentType: "image/jpeg",
      customMetadata: { uploadedBy: uid },
    }),
  );
  const metadata = await assertSucceeds(getMetadata(sameTenant));
  assert.equal(metadata.contentType, "image/jpeg");
  assert.equal(metadata.customMetadata.uploadedBy, uid);
  const folder = storageRef(
    storage,
    `Companies/${CODEX_LOCAL_COMPANIES.primary.id}/Operations/rules-operation/SecurityReports`,
  );
  const listed = await assertSucceeds(listAll(folder));
  assert.ok(listed.items.some((item) => item.fullPath === sameTenant.fullPath));
  const downloadUrl = await assertSucceeds(getDownloadURL(sameTenant));
  const downloadResponse = await fetch(downloadUrl);
  assert.equal(downloadResponse.ok, true);
  assert.deepEqual(
    new Uint8Array(await downloadResponse.arrayBuffer()),
    new Uint8Array([1]),
  );
  await assertSucceeds(deleteObject(sameTenant));
  await assert.rejects(
    getMetadata(sameTenant),
    (error) => error?.code === "storage/object-not-found",
  );
  await assertFails(uploadBytes(otherTenant, new Uint8Array([3])));
  await assertFails(getMetadata(otherTenant));
  await assertFails(deleteObject(otherTenant));
});

test("Storage Rules reject unverified and malformed identity claims", async () => {
  const uid = "codex-storage-invalid-claims-user";
  await seedRegisteredUser({ uid });

  for (const [index, claims] of [
    { email_verified: false },
    { email_verified: "true" },
    { companyId: null },
    { companyId: 1 },
    { companyId: true },
    { companyId: "" },
  ].entries()) {
    const report = securityReportRef(
      authenticatedStorage(uid, claims),
      CODEX_LOCAL_COMPANIES.primary.id,
      `invalid-${index}.jpg`,
    );
    await assertFails(uploadBytes(report, new Uint8Array([1])));
  }

  const missingClaimsStorage = testEnvironment
    .authenticatedContext(uid, {})
    .storage();
  await assertFails(
    uploadBytes(
      securityReportRef(
        missingClaimsStorage,
        CODEX_LOCAL_COMPANIES.primary.id,
        "missing-claims.jpg",
      ),
      new Uint8Array([1]),
    ),
  );
});

test("Storage Rules reject a missing registered User", async () => {
  const report = securityReportRef(
    authenticatedStorage("codex-storage-missing-user"),
    CODEX_LOCAL_COMPANIES.primary.id,
    "missing-user.jpg",
  );

  await assertFails(uploadBytes(report, new Uint8Array([1])));
});

test("Storage Rules reject temporary, disabled, and malformed Users", async () => {
  const cases = [
    ["temporary", { isTemporary: true }],
    ["disabled", { disabled: true }],
    ["invalid-temporary", { isTemporary: "false" }],
    ["invalid-disabled", { disabled: "false" }],
    ["missing-temporary", { omit: ["isTemporary"] }],
    ["missing-disabled", { omit: ["disabled"] }],
  ];

  for (const [name, user] of cases) {
    const uid = `codex-storage-${name}-user`;
    await seedRegisteredUser({ uid, ...user });
    const report = securityReportRef(
      authenticatedStorage(uid),
      CODEX_LOCAL_COMPANIES.primary.id,
      `${name}.jpg`,
    );
    await assertFails(uploadBytes(report, new Uint8Array([1])));
  }
});

test("Storage Rules reject a membership company mismatch", async () => {
  const uid = "codex-storage-membership-mismatch-user";
  await seedRegisteredUser({
    uid,
    companyId: CODEX_LOCAL_COMPANIES.secondary.id,
  });
  const report = securityReportRef(
    authenticatedStorage(uid),
    CODEX_LOCAL_COMPANIES.primary.id,
    "membership-mismatch.jpg",
  );

  await assertFails(uploadBytes(report, new Uint8Array([1])));
});

test("Storage Rules reject permanent super-user cross-tenant access", async () => {
  const uid = "codex-storage-super-user";
  await seedRegisteredUser({ uid });
  const storage = authenticatedStorage(uid, { isSuperUser: true });
  const sameTenant = securityReportRef(
    storage,
    CODEX_LOCAL_COMPANIES.primary.id,
    "super-user-same-tenant.jpg",
  );
  const otherTenant = securityReportRef(
    storage,
    CODEX_LOCAL_COMPANIES.secondary.id,
    "super-user-other-tenant.jpg",
  );

  await assertSucceeds(uploadBytes(sameTenant, new Uint8Array([1])));
  await assertFails(uploadBytes(otherTenant, new Uint8Array([1])));
});

test("rebuild Callables require authentication", async () => {
  const apis = await loadRebuildApis();
  const { rebuildAllHistories, rebuildSecurityReportIndexes } = apis;

  assert.equal("authorizeCompanyRebuild" in apis, false);

  await assertCallableError(
    rebuildAllHistories.run({
      data: { companyId: CODEX_LOCAL_COMPANIES.primary.id },
    }),
    "unauthenticated",
  );
  await assertCallableError(
    rebuildSecurityReportIndexes.run({
      data: { companyId: CODEX_LOCAL_COMPANIES.primary.id },
    }),
    "unauthenticated",
  );
});

test("rebuild Callables reject an unverified or non-super-user account", async () => {
  const { rebuildAllHistories, rebuildSecurityReportIndexes } =
    await loadRebuildApis();

  await assertCallableError(
    rebuildAllHistories.run(
      callableRequest({ claims: { email: undefined } }),
    ),
    "permission-denied",
  );
  await assertCallableError(
    rebuildAllHistories.run(
      callableRequest({ claims: { email_verified: false } }),
    ),
    "permission-denied",
  );
  await assertCallableError(
    rebuildSecurityReportIndexes.run(
      callableRequest({ claims: { isSuperUser: false } }),
    ),
    "permission-denied",
  );
});

test("rebuild Callables reject missing, malformed, and cross-tenant company identity", async () => {
  const { rebuildAllHistories } = await loadRebuildApis();
  const uid = "codex-callable-company-input-user";
  await seedCallableAuthUser({ uid });
  await seedRegisteredUser({ uid });

  await assertCallableError(
    rebuildAllHistories.run(callableRequest({ uid, data: {} })),
    "invalid-argument",
  );
  await assertCallableError(
    rebuildAllHistories.run(
      callableRequest({ uid, claims: { companyId: 1 } }),
    ),
    "permission-denied",
  );
  await assertCallableError(
    rebuildAllHistories.run(
      callableRequest({
        uid,
        data: { companyId: CODEX_LOCAL_COMPANIES.secondary.id },
      }),
    ),
    "permission-denied",
  );
});

test("rebuild Callables reject missing, temporary, disabled, and mismatched Users", async () => {
  const { rebuildAllHistories } = await loadRebuildApis();

  await seedCallableAuthUser({ uid: "codex-callable-missing-user" });
  await assertCallableError(
    rebuildAllHistories.run(
      callableRequest({ uid: "codex-callable-missing-user" }),
    ),
    "permission-denied",
  );

  for (const [name, user] of [
    ["temporary", { isTemporary: true }],
    ["disabled", { disabled: true }],
    ["invalid-temporary", { isTemporary: "false" }],
    ["invalid-disabled", { disabled: "false" }],
    [
      "company-mismatch",
      { companyId: CODEX_LOCAL_COMPANIES.secondary.id },
    ],
  ]) {
    const uid = `codex-callable-${name}-user`;
    await seedCallableAuthUser({ uid });
    await seedRegisteredUser({ uid, ...user });
    await assertCallableError(
      rebuildAllHistories.run(callableRequest({ uid })),
      "permission-denied",
    );
  }
});

test("rebuild history Callable allows an active registered same-tenant super-user", async () => {
  const { rebuildAllHistories } = await loadRebuildApis();
  const uid = "codex-callable-super-user";
  await seedCallableAuthUser({ uid });
  await seedRegisteredUser({ uid });

  const result = await rebuildAllHistories.run(callableRequest({ uid }));

  assert.deepEqual(result, {
    message: "Successfully rebuilt all histories.",
  });
});

test("rebuild Callables reject a disabled or inconsistent current Auth account", async () => {
  const { rebuildAllHistories } = await loadRebuildApis();
  const missingAuthUid = "codex-callable-missing-auth-user";
  await seedRegisteredUser({ uid: missingAuthUid });
  await assertCallableError(
    rebuildAllHistories.run(callableRequest({ uid: missingAuthUid })),
    "permission-denied",
  );

  const cases = [
    ["auth-disabled", { disabled: true }],
    ["auth-unverified", { emailVerified: false }],
    ["auth-not-super-user", { isSuperUser: false }],
    [
      "auth-company-mismatch",
      { companyId: CODEX_LOCAL_COMPANIES.secondary.id },
    ],
  ];

  for (const [name, authUser] of cases) {
    const uid = `codex-callable-${name}-user`;
    await seedCallableAuthUser({ uid, ...authUser });
    await seedRegisteredUser({ uid });
    await assertCallableError(
      rebuildAllHistories.run(callableRequest({ uid })),
      "permission-denied",
    );
  }
});

test("security report rebuild Callable allows an active registered same-tenant super-user", async () => {
  const { rebuildSecurityReportIndexes } = await loadRebuildApis();
  const uid = "codex-callable-super-user";

  const result = await rebuildSecurityReportIndexes.run(
    callableRequest({ uid }),
  );

  assert.equal(Number.isInteger(result.processedCount), true);
  assert.equal(Number.isInteger(result.indexedCount), true);
  assert.match(result.message, /^警備日報インデックスを再構築しました。/);
});

test("administrator signup email preflight validates its input", async () => {
  const { checkEmailAvailability } = await loadRebuildApis();

  await assertCallableError(
    checkEmailAvailability.run({ data: {} }),
    "invalid-argument",
  );
  await assertCallableError(
    checkEmailAvailability.run({
      data: { email: 123 },
    }),
    "invalid-argument",
  );
});

test("administrator signup email preflight rejects an existing Auth account", async () => {
  const { checkEmailAvailability } = await loadRebuildApis();
  const uid = "codex-signup-existing-auth";
  const email = `${uid}@codex-test.invalid`;
  await seedCallableAuthUser({ uid });

  await assertCallableError(
    checkEmailAvailability.run({ data: { email } }),
    "already-exists",
  );
});

test("administrator signup email preflight checks global User duplication", async () => {
  const { checkEmailAvailability } = await loadRebuildApis();
  const duplicateEmail = "signup-admin-duplicate@codex-test.invalid";
  await seedRegisteredUser({
    uid: "codex-signup-admin-existing-user",
    pathCompanyId: CODEX_LOCAL_COMPANIES.secondary.id,
    email: duplicateEmail,
  });
  await seedEmailReservation({
    email: duplicateEmail,
    companyId: CODEX_LOCAL_COMPANIES.secondary.id,
    userId: "codex-signup-admin-existing-user",
  });

  await assertCallableError(
    checkEmailAvailability.run({
      data: { email: duplicateEmail },
    }),
    "already-exists",
  );

  const result = await checkEmailAvailability.run({
    data: { email: "signup-admin-available@codex-test.invalid" },
  });
  assert.deepEqual(result, { available: true });
});

test("caller isAdmin cannot select a weaker email preflight policy", async () => {
  const { checkEmailAvailability } = await loadRebuildApis();
  const email = "signup-admin-existing-temporary@codex-test.invalid";
  await seedRegisteredUser({
    uid: "codex-signup-admin-existing-temporary",
    isTemporary: true,
    isAdmin: false,
    email,
  });
  await seedEmailReservation({
    email,
    companyId: CODEX_LOCAL_COMPANIES.primary.id,
    userId: "codex-signup-admin-existing-temporary",
  });

  await assertCallableError(
    checkEmailAvailability.run({ data: { email, isAdmin: false } }),
    "already-exists",
  );
});

test("API index exports every public Callable without internal request helpers", async () => {
  const apis = await loadRebuildApis();
  const publicCallables = [
    "changeAdminUser",
    "checkEmailAvailability",
    "checkUserPreRegistration",
    "createAdminAccount",
    "createEmployeeLinkedTemporaryUser",
    "createStandaloneTemporaryUser",
    "deleteStandaloneRegisteredUser",
    "deleteTemporaryUser",
    "disableUser",
    "enableUser",
    "rebuildAllHistories",
    "rebuildSecurityReportIndexes",
    "reinstateEmployee",
    "setupUserAccount",
    "terminateEmployee",
    "updateOwnUserProfile",
    "updateUserNotificationSettings",
    "updateUserRoles",
  ];

  for (const callable of publicCallables) {
    assert.equal(callable in apis, true, `${callable} must be exported`);
  }
  assert.equal("authorizeCompanyRebuild" in apis, false);
  assert.equal("handleUserEnabledStateChangeRequest" in apis, false);
});

test("pre-registration Callable validates email and returns only registration state", async () => {
  const { checkUserPreRegistration } = await loadRebuildApis();
  await assertCallableError(
    checkUserPreRegistration.run({ data: {} }),
    "invalid-argument",
  );

  const missingResult = await checkUserPreRegistration.run({
    data: { email: "codex-pre-registration-missing@codex-test.invalid" },
  });
  assert.deepEqual(missingResult, { isPreRegistered: false });

  const uid = "codex-pre-registration-user";
  const email = `${uid}@codex-test.invalid`;
  await seedRegisteredUser({ uid, isTemporary: true, isAdmin: false, email });
  await seedEmailReservation({
    email,
    companyId: CODEX_LOCAL_COMPANIES.primary.id,
    userId: uid,
  });
  const result = await checkUserPreRegistration.run({ data: { email } });

  assert.deepEqual(result, { isPreRegistered: true });
});

test("pre-registration Callable does not fall back to legacy duplicate User queries", async () => {
  const { checkUserPreRegistration } = await loadRebuildApis();
  const email = "pre-reg-duplicate@codex-test.invalid";
  await seedRegisteredUser({
    uid: "codex-pre-registration-duplicate-primary",
    email,
    isTemporary: true,
  });
  await seedRegisteredUser({
    uid: "codex-pre-registration-duplicate-secondary",
    pathCompanyId: CODEX_LOCAL_COMPANIES.secondary.id,
    email,
    isTemporary: true,
  });

  assert.deepEqual(
    await checkUserPreRegistration.run({ data: { email } }),
    { isPreRegistered: false },
  );
});

test("moved authenticated User Callables retain their entry guards", async () => {
  const {
    changeAdminUser,
    createEmployeeLinkedTemporaryUser,
    createStandaloneTemporaryUser,
    deleteStandaloneRegisteredUser,
    deleteTemporaryUser,
    disableUser,
    enableUser,
    listLifecycleOperations,
    setupUserAccount,
    terminateEmployee,
    reinstateEmployee,
    updateOwnUserProfile,
    updateUserNotificationSettings,
    updateUserRoles,
  } = await loadRebuildApis();

  for (const callable of [
    changeAdminUser,
    createEmployeeLinkedTemporaryUser,
    createStandaloneTemporaryUser,
    deleteStandaloneRegisteredUser,
    deleteTemporaryUser,
    disableUser,
    enableUser,
    listLifecycleOperations,
    setupUserAccount,
    terminateEmployee,
    reinstateEmployee,
    updateOwnUserProfile,
    updateUserNotificationSettings,
    updateUserRoles,
  ]) {
    await assertCallableError(callable.run({ data: {} }), "unauthenticated");
  }

});

test("company administrator pages lifecycle history through the public Callable", async () => {
  const { listLifecycleOperations } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb07-history-admin",
    companyId: HISTORY_COMPANY_ID,
    isAdmin: true,
    roles: [],
  });
  const records = Array.from({ length: 22 }, (_, index) =>
    historyOperationRecord(index + 1),
  );
  const operationIds = records.map((record) => record.operationId);
  const request = (cursor) =>
    listLifecycleOperations.run(
      actorCallableRequest({ actor, data: { cursor } }),
    );

  try {
    await seedHistoryOperations(records.slice(0, 20));
    const twenty = await request(null);
    assert.equal(twenty.schemaVersion, 1);
    assert.equal(twenty.items.length, 20);
    assert.equal(twenty.nextCursor, null);
    assert.deepEqual(
      twenty.items.map((item) => item.employeeId),
      Array.from(
        { length: 20 },
        (_, index) => `history-employee-${String(20 - index).padStart(3, "0")}`,
      ),
    );

    await seedHistoryOperations([records[20]]);
    const twentyOne = await request(null);
    assert.equal(twentyOne.items.length, 20);
    assert.equal(twentyOne.nextCursor, historyOperationId(2));
    assert.equal(twentyOne.items[0].employeeId, "history-employee-021");
    assert.equal(twentyOne.items.at(-1).employeeId, "history-employee-002");

    await seedHistoryOperations([records[21]]);
    const firstPage = await request(null);
    assert.equal(firstPage.items.length, 20);
    assert.equal(firstPage.nextCursor, historyOperationId(3));
    assert.deepEqual(
      firstPage.items.slice(0, 3).map((item) => item.employeeId),
      [
        "history-employee-022",
        "history-employee-021",
        "history-employee-020",
      ],
    );
    assert.equal(firstPage.items[0].createdAt, firstPage.items[1].createdAt);
    assert.notEqual(firstPage.items[1].createdAt, firstPage.items[2].createdAt);

    const secondPage = await request(firstPage.nextCursor);
    assert.deepEqual(
      secondPage.items.map((item) => item.employeeId),
      ["history-employee-002", "history-employee-001"],
    );
    assert.equal(secondPage.nextCursor, null);

    const item = firstPage.items[0];
    assert.deepEqual(Object.keys(item).sort(), [
      "actorDisplayName",
      "completedAt",
      "createdAt",
      "effectiveDate",
      "employeeId",
      "includesUserAccountDeletion",
      "operationType",
      "reason",
      "status",
      "subjectDisplayName",
    ]);
    assert.deepEqual(item, {
      operationType: "employee-retirement",
      status: "completed",
      actorDisplayName: "履歴担当",
      employeeId: "history-employee-022",
      subjectDisplayName: null,
      includesUserAccountDeletion: false,
      effectiveDate: "2026-08-20",
      reason: "本人都合",
      createdAt: records[21].createdAt.toISOString(),
      completedAt: records[21].completedAt.toISOString(),
    });
    const serializedItems = JSON.stringify(firstPage.items);
    for (const forbidden of [
      "uwb07-history-source-actor",
      "b".repeat(64),
      "requestFingerprint",
      "targetUserUid",
      "authDisposition",
      "cleanupState",
      "attemptCount",
      "lastErrorCode",
      "operationId",
    ]) {
      assert.equal(serializedItems.includes(forbidden), false, forbidden);
    }
  } finally {
    await removeHistoryOperations(operationIds);
  }
});

test("lifecycle history Callable rejects every non-company-admin actor class", async () => {
  const { listLifecycleOperations } = await loadRebuildApis();
  const deniedActors = [
    { name: "manager", isAdmin: false, roles: ["manager"] },
    {
      name: "human-resource",
      isAdmin: false,
      roles: ["human-resource"],
    },
    { name: "direct-permission", isAdmin: false, roles: ["users:write"] },
    { name: "super-user", isAdmin: true, roles: [], isSuperUser: true },
    { name: "temporary", isAdmin: true, roles: [], isTemporary: true },
    {
      name: "disabled",
      isAdmin: true,
      roles: [],
      disabled: true,
      authDisabled: true,
      expectedCode: "failed-precondition",
    },
    {
      name: "other-tenant",
      isAdmin: true,
      roles: [],
      userCompanyId: "uwb07-history-other-company",
    },
  ];

  for (const denied of deniedActors) {
    const uid = `uwb07-history-denied-${denied.name}`;
    const isSuperUser = denied.isSuperUser ?? false;
    try {
      await seedCallableAuthUser({
        uid,
        companyId: HISTORY_COMPANY_ID,
        disabled: denied.authDisabled ?? false,
        isSuperUser,
      });
      await seedRegisteredUser({
        uid,
        pathCompanyId: HISTORY_COMPANY_ID,
        companyId: denied.userCompanyId ?? HISTORY_COMPANY_ID,
        isTemporary: denied.isTemporary ?? false,
        disabled: denied.disabled ?? false,
        isAdmin: denied.isAdmin,
        displayName: "拒否利用者",
        roles: denied.roles,
      });

      await assertCallableError(
        listLifecycleOperations.run(
          callableRequest({
            uid,
            claims: {
              companyId: HISTORY_COMPANY_ID,
              isSuperUser,
            },
            data: { cursor: null },
          }),
        ),
        denied.expectedCode ?? "permission-denied",
      );
    } finally {
      await removeHistoryActor(uid);
    }
  }
});

test("lifecycle history cursor failures expose one uniform Callable error", async () => {
  const { listLifecycleOperations } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb07-history-cursor-admin",
    companyId: HISTORY_COMPANY_ID,
    isAdmin: true,
    roles: [],
  });
  const corruptSchema = {
    ...historyOperationRecord(901),
    internalSecret: "must-not-leak",
  };
  const corruptTimestamp = {
    ...historyOperationRecord(902),
    createdAt: "not-a-firestore-timestamp",
  };
  const corruptIds = [
    corruptSchema.operationId,
    corruptTimestamp.operationId,
  ];
  const cursors = [historyOperationId(900), ...corruptIds];

  try {
    await seedHistoryOperations([corruptSchema, corruptTimestamp]);
    const errors = [];
    for (const cursor of cursors) {
      errors.push(
        await captureCallableError(
          listLifecycleOperations.run(
            actorCallableRequest({ actor, data: { cursor } }),
          ),
        ),
      );
    }
    assert.equal(
      new Set(errors.map((error) => `${error.code}|${error.message}`)).size,
      1,
    );
    assert.equal(errors[0].code, "invalid-argument");
    const serializedErrors = JSON.stringify(
      errors.map((error) => ({ code: error.code, message: error.message })),
    );
    assert.equal(serializedErrors.includes("must-not-leak"), false);
    assert.equal(serializedErrors.includes("not-a-firestore-timestamp"), false);
  } finally {
    await removeHistoryOperations(corruptIds);
  }
});

test("Firestore Rules deny company-admin direct lifecycle history reads", async () => {
  const uid = "uwb07-history-rules-admin";
  const record = historyOperationRecord(950);
  await seedRegisteredUser({
    uid,
    pathCompanyId: HISTORY_COMPANY_ID,
    companyId: HISTORY_COMPANY_ID,
    isAdmin: true,
    roles: [],
  });

  try {
    await seedHistoryOperations([record]);
    const firestore = authenticatedFirestore(uid, {
      companyId: HISTORY_COMPANY_ID,
      isSuperUser: false,
    });
    await assertFails(
      getDoc(
        doc(
          firestore,
          "Companies",
          HISTORY_COMPANY_ID,
          "LifecycleOperations",
          record.operationId,
        ),
      ),
    );
    await assertFails(
      getDocs(
        collection(
          firestore,
          "Companies",
          HISTORY_COMPANY_ID,
          "LifecycleOperations",
        ),
      ),
    );
  } finally {
    await removeHistoryOperations([record.operationId]);
  }
});

test("Employee-only retirement completes atomically through the public Callable", async () => {
  const { terminateEmployee } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb07-retire-employee-only-actor",
    roles: ["human-resource"],
  });
  const employeeId = "uwb07-retire-employee-only";
  const operationId = "07000000-0000-4000-8000-000000000001";
  await seedEmployee({ employeeId, displayName: "単独社員" });

  const result = await terminateEmployee.run(
    actorCallableRequest({
      actor,
      data: {
        operationId,
        employeeId,
        terminationDate: "2026-08-20",
        reasonOfTermination: "本人都合",
      },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    operationId,
    status: "completed",
    employeeId,
    userDeletion: { kind: "none", userAccessDeleted: false },
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const employee = (
      await getDoc(
        doc(firestore, "Companies", actor.companyId, "Employees", employeeId),
      )
    ).data();
    const operation = (
      await getDoc(
        doc(
          firestore,
          "Companies",
          actor.companyId,
          "LifecycleOperations",
          operationId,
        ),
      )
    ).data();
    const lock = await getDoc(
      doc(
        firestore,
        "Companies",
        actor.companyId,
        "EmployeeLifecycleLocks",
        employeeId,
      ),
    );

    assert.equal(employee.employmentStatus, "RESIGNED");
    assert.equal(employee.reasonOfTermination, "本人都合");
    assert.equal(operation.state, "completed");
    assert.equal(operation.targetUserUid, null);
    assert.equal(lock.exists(), false);
  });
});

test("registered Employee retirement deletes Auth, User, and reservation pointers", async () => {
  const { terminateEmployee } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb07-retire-registered-actor",
    roles: ["human-resource"],
  });
  const employeeId = "uwb07-retire-registered-employee";
  const targetUid = "uwb07-retire-registered-user";
  const targetEmail = `${targetUid}@codex-test.invalid`;
  const operationId = "07000000-0000-4000-8000-000000000002";
  await seedEmployee({ employeeId, displayName: "登録社員" });
  await seedCallableAuthUser({
    uid: targetUid,
    companyId: actor.companyId,
    email: targetEmail,
    isSuperUser: false,
  });
  await seedRegisteredUser({
    uid: targetUid,
    companyId: actor.companyId,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    email: targetEmail,
    displayName: "登録社員",
    employeeId,
    roles: ["controller"],
  });
  await seedEmailReservation({
    email: targetEmail,
    companyId: actor.companyId,
    userId: targetUid,
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(
        context.firestore(),
        "Companies",
        actor.companyId,
        "EmployeeUserReservations",
        employeeId,
      ),
      { userId: targetUid },
    );
  });

  const result = await terminateEmployee.run(
    actorCallableRequest({
      actor,
      data: {
        operationId,
        employeeId,
        terminationDate: "2026-08-20",
        reasonOfTermination: "契約満了",
      },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    operationId,
    status: "completed",
    employeeId,
    userDeletion: { kind: "registered", userAccessDeleted: true },
  });
  await assert.rejects(
    () => getAdminAuth().getUser(targetUid),
    (error) => error.code === "auth/user-not-found",
  );
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const employee = (
      await getDoc(
        doc(firestore, "Companies", actor.companyId, "Employees", employeeId),
      )
    ).data();
    const operation = (
      await getDoc(
        doc(
          firestore,
          "Companies",
          actor.companyId,
          "LifecycleOperations",
          operationId,
        ),
      )
    ).data();
    const targetUser = await getDoc(
      doc(firestore, "Companies", actor.companyId, "Users", targetUid),
    );
    const employeeReservation = await getDoc(
      doc(
        firestore,
        "Companies",
        actor.companyId,
        "EmployeeUserReservations",
        employeeId,
      ),
    );
    const emailReservation = await getDoc(
      doc(
        firestore,
        "UserEmailReservations",
        createUserEmailReservationId(targetEmail),
      ),
    );

    assert.equal(employee.employmentStatus, "RESIGNED");
    assert.equal(operation.state, "completed");
    assert.equal(operation.authDisposition, "deleted");
    assert.equal(operation.cleanupState, "completed");
    assert.equal(targetUser.exists(), false);
    assert.equal(employeeReservation.exists(), false);
    assert.equal(emailReservation.exists(), false);
  });
});

test("company administrator offboards a standalone registered User", async () => {
  const { deleteStandaloneRegisteredUser } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb07-offboard-admin",
    isAdmin: true,
  });
  const targetUid = "uwb07-offboard-standalone-user";
  const targetEmail = `${targetUid}@codex-test.invalid`;
  const operationId = "07000000-0000-4000-8000-000000000003";
  await seedCallableAuthUser({
    uid: targetUid,
    companyId: actor.companyId,
    email: targetEmail,
    isSuperUser: false,
  });
  await seedRegisteredUser({
    uid: targetUid,
    companyId: actor.companyId,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    email: targetEmail,
    displayName: "単独利用",
    roles: ["controller"],
  });
  await seedEmailReservation({
    email: targetEmail,
    companyId: actor.companyId,
    userId: targetUid,
  });

  const result = await deleteStandaloneRegisteredUser.run(
    actorCallableRequest({
      actor,
      data: {
        operationId,
        targetUserId: targetUid,
        reason: "利用終了",
      },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    operationId,
    status: "completed",
    userId: targetUid,
  });
  await assert.rejects(
    () => getAdminAuth().getUser(targetUid),
    (error) => error.code === "auth/user-not-found",
  );
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    assert.equal(
      (
        await getDoc(
          doc(firestore, "Companies", actor.companyId, "Users", targetUid),
        )
      ).exists(),
      false,
    );
    assert.equal(
      (
        await getDoc(
          doc(
            firestore,
            "UserEmailReservations",
            createUserEmailReservationId(targetEmail),
          ),
        )
      ).exists(),
      false,
    );
    const operation = (
      await getDoc(
        doc(
          firestore,
          "Companies",
          actor.companyId,
          "LifecycleOperations",
          operationId,
        ),
      )
    ).data();
    assert.equal(operation.state, "completed");
    assert.equal(operation.offboardingReason, "利用終了");
    assert.equal(operation.employeeId, null);
  });
});

test("non-administrator cannot offboard a standalone registered User", async () => {
  const { deleteStandaloneRegisteredUser } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb07-offboard-manager-denied",
    isAdmin: false,
  });
  const targetUid = "uwb07-offboard-denied-target";
  const targetEmail = `${targetUid}@codex-test.invalid`;
  await seedCallableAuthUser({
    uid: targetUid,
    companyId: actor.companyId,
    email: targetEmail,
    isSuperUser: false,
  });
  await seedRegisteredUser({
    uid: targetUid,
    companyId: actor.companyId,
    isTemporary: false,
    disabled: false,
    isAdmin: false,
    email: targetEmail,
    displayName: "拒否対象",
    roles: ["controller"],
  });
  await seedEmailReservation({
    email: targetEmail,
    companyId: actor.companyId,
    userId: targetUid,
  });

  await assertCallableError(
    deleteStandaloneRegisteredUser.run(
      actorCallableRequest({
        actor,
        data: {
          operationId: "07000000-0000-4000-8000-000000000004",
          targetUserId: targetUid,
          reason: "利用終了",
        },
      }),
    ),
    "permission-denied",
  );
  assert.equal((await getAdminAuth().getUser(targetUid)).disabled, false);
});

test("company administrator corrects a completed mistaken retirement idempotently", async () => {
  const {
    getEmployeeReinstatementContext,
    reinstateEmployee,
    terminateEmployee,
  } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb07-reinstate-admin",
    isAdmin: true,
  });
  const employeeId = "uwb07-reinstate-employee";
  const retirementOperationId = "07000000-0000-4000-8000-000000000005";
  const reinstatementOperationId = "07000000-0000-4000-8000-000000000006";
  await seedEmployee({ employeeId, displayName: "訂正社員" });
  await terminateEmployee.run(
    actorCallableRequest({
      actor,
      data: {
        operationId: retirementOperationId,
        employeeId,
        terminationDate: "2026-08-20",
        reasonOfTermination: "誤操作",
      },
    }),
  );
  const correctionContext = await getEmployeeReinstatementContext.run(
    actorCallableRequest({
      actor,
      data: { employeeId },
    }),
  );
  assert.deepEqual(correctionContext, {
    eligible: true,
    employeeId,
    reversesOperationId: retirementOperationId,
    requiresUserReprovisioning: false,
  });
  const request = actorCallableRequest({
    actor,
    data: {
      operationId: reinstatementOperationId,
      employeeId,
      reversesOperationId: retirementOperationId,
      correctionReasonCode: "MISTAKEN_RETIREMENT",
    },
  });

  const first = await reinstateEmployee.run(request);
  const repeated = await reinstateEmployee.run(request);
  const expected = {
    success: true,
    operationId: reinstatementOperationId,
    status: "completed",
    employeeId,
    employeeReinstated: true,
    userAccessRestored: false,
    requiresUserReprovisioning: false,
  };
  assert.deepEqual(first, expected);
  assert.deepEqual(repeated, expected);

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const employee = (
      await getDoc(
        doc(firestore, "Companies", actor.companyId, "Employees", employeeId),
      )
    ).data();
    const source = (
      await getDoc(
        doc(
          firestore,
          "Companies",
          actor.companyId,
          "LifecycleOperations",
          retirementOperationId,
        ),
      )
    ).data();
    const correction = (
      await getDoc(
        doc(
          firestore,
          "Companies",
          actor.companyId,
          "LifecycleOperations",
          reinstatementOperationId,
        ),
      )
    ).data();
    const head = (
      await getDoc(
        doc(
          firestore,
          "Companies",
          actor.companyId,
          "EmployeeLifecycleHeads",
          employeeId,
        ),
      )
    ).data();

    assert.equal(employee.employmentStatus, "ACTIVE");
    assert.equal("dateOfTermination" in employee, false);
    assert.equal("reasonOfTermination" in employee, false);
    assert.equal(source.state, "completed");
    assert.equal(source.reasonOfTermination, "誤操作");
    assert.equal(correction.reversesOperationId, retirementOperationId);
    assert.equal(head.revision, 2);
    assert.equal(head.latestOperationId, reinstatementOperationId);
    assert.equal(head.latestOperationType, "employee-reinstatement");
  });
});

test("own profile Callable updates only displayName and tagSize", async () => {
  const { updateOwnUserProfile } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb05-own-profile",
    roles: ["controller"],
  });

  const result = await updateOwnUserProfile.run(
    actorCallableRequest({
      actor,
      data: { displayName: "新表示", tagSize: "LARGE" },
    }),
  );
  assert.deepEqual(result, { success: true, userId: actor.uid });

  const user = await readRegisteredUser(actor.uid);
  assert.equal(user.displayName, "新表示");
  assert.equal(user.tagSize, "LARGE");
  assert.equal(user.email, actor.email);
  assert.deepEqual(user.roles, ["controller"]);
  assert.equal(user.isAdmin, false);
  assert.equal(user.isTemporary, false);
  assert.equal(user.disabled, false);
});

test("managed notification Callable updates only three notification flags", async () => {
  const { updateUserNotificationSettings } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb05-notification-manager",
  });
  const targetUid = "uwb05-notification-target";
  await seedRegisteredUser({
    uid: targetUid,
    isAdmin: false,
    email: `${targetUid}@codex-test.invalid`,
    displayName: "通知対象",
    roles: ["controller"],
  });

  const result = await updateUserNotificationSettings.run(
    actorCallableRequest({
      actor,
      data: {
        targetUserId: targetUid,
        receiveConfirmedArrangementNotification: true,
        receiveArrivedArrangementNotification: false,
        receiveLeavedArrangementNotification: true,
      },
    }),
  );
  assert.deepEqual(result, { success: true, userId: targetUid });

  const user = await readRegisteredUser(targetUid);
  assert.equal(user.receiveConfirmedArrangementNotification, true);
  assert.equal(user.receiveArrivedArrangementNotification, false);
  assert.equal(user.receiveLeavedArrangementNotification, true);
  assert.equal(user.displayName, "通知対象");
  assert.equal(user.email, `${targetUid}@codex-test.invalid`);
  assert.deepEqual(user.roles, ["controller"]);
});

test("managed role Callable accepts known presets and protects other fields", async () => {
  const { updateUserRoles } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb05-role-manager",
  });
  const targetUid = "uwb05-role-target";
  await seedRegisteredUser({
    uid: targetUid,
    isAdmin: false,
    email: `${targetUid}@codex-test.invalid`,
    displayName: "役割対象",
    roles: ["controller"],
  });

  const result = await updateUserRoles.run(
    actorCallableRequest({
      actor,
      data: { targetUserId: targetUid, roles: ["human-resource", "labor"] },
    }),
  );
  assert.deepEqual(result, { success: true, userId: targetUid });

  const user = await readRegisteredUser(targetUid);
  assert.deepEqual(user.roles, ["human-resource", "labor"]);
  assert.equal(user.displayName, "役割対象");
  assert.equal(user.email, `${targetUid}@codex-test.invalid`);
  assert.equal(user.isAdmin, false);
});

test("provision-only actor cannot update managed User fields", async () => {
  const { updateUserNotificationSettings, updateUserRoles } =
    await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb05-provision-only",
    roles: ["human-resource"],
  });
  const targetUid = "uwb05-provision-only-target";
  await seedRegisteredUser({
    uid: targetUid,
    isAdmin: false,
    roles: [],
  });

  await assertCallableError(
    updateUserNotificationSettings.run(
      actorCallableRequest({
        actor,
        data: {
          targetUserId: targetUid,
          receiveConfirmedArrangementNotification: false,
          receiveArrivedArrangementNotification: false,
          receiveLeavedArrangementNotification: false,
        },
      }),
    ),
    "permission-denied",
  );
  await assertCallableError(
    updateUserRoles.run(
      actorCallableRequest({
        actor,
        data: { targetUserId: targetUid, roles: ["controller"] },
      }),
    ),
    "permission-denied",
  );
});

test("field Callables reject protected-field injection and self role changes", async () => {
  const { updateOwnUserProfile, updateUserRoles } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb05-negative-manager",
  });

  await assertCallableError(
    updateOwnUserProfile.run(
      actorCallableRequest({
        actor,
        data: {
          displayName: "利用者",
          tagSize: "MEDIUM",
          isAdmin: true,
        },
      }),
    ),
    "invalid-argument",
  );
  await assertCallableError(
    updateUserRoles.run(
      actorCallableRequest({
        actor,
        data: { targetUserId: actor.uid, roles: [] },
      }),
    ),
    "failed-precondition",
  );
});

test("standalone temporary User creation writes canonical User and email reservation", async () => {
  const { createStandaloneTemporaryUser } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb04-standalone-manager",
  });
  const email = "uwb04-standalone@codex-test.invalid";
  const result = await createStandaloneTemporaryUser.run(
    actorCallableRequest({
      actor,
      data: {
        email: ` ${email.toUpperCase()} `,
        displayName: "仮利用者",
        roles: ["human-resource"],
        tagSize: "SMALL",
        receiveConfirmedArrangementNotification: true,
      },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    userId: result.userId,
    linkType: "standalone",
    employeeId: null,
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const user = await getDoc(
      doc(firestore, "Companies", actor.companyId, "Users", result.userId),
    );
    assert.equal(user.exists(), true);
    assert.equal(user.data().email, email);
    assert.equal(user.data().displayName, "仮利用者");
    assert.deepEqual(user.data().roles, ["human-resource"]);
    assert.equal(user.data().companyId, actor.companyId);
    assert.equal(user.data().isTemporary, true);
    assert.equal(user.data().isAdmin, false);
    assert.equal(user.data().disabled, false);
    assert.equal(user.data().tagSize, "SMALL");
    assert.equal(user.data().receiveConfirmedArrangementNotification, true);
    assert.equal(user.data().receiveArrivedArrangementNotification, false);
    assert.equal(user.data().receiveLeavedArrangementNotification, false);
    const reservation = await getDoc(
      doc(
        firestore,
        "UserEmailReservations",
        createUserEmailReservationId(email),
      ),
    );
    assert.deepEqual(reservation.data(), {
      companyId: actor.companyId,
      userId: result.userId,
    });
  });
  await assert.rejects(
    () => getAdminAuth().getUserByEmail(email),
    (error) => error.code === "auth/user-not-found",
  );
});

test("provision-only Employee-linked creation forces roleless Users", async () => {
  const { createEmployeeLinkedTemporaryUser } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb04-linked-hr",
    roles: ["human-resource"],
  });
  const employeeId = "uwb04-linked-employee";
  const employee = await seedEmployee({
    employeeId,
    displayName: "連携社員",
  });
  const email = "uwb04-linked@codex-test.invalid";
  await assertCallableError(
    createEmployeeLinkedTemporaryUser.run(
      actorCallableRequest({
        actor,
        data: { employeeId, email, roles: ["manager"] },
      }),
    ),
    "permission-denied",
  );
  const result = await createEmployeeLinkedTemporaryUser.run(
    actorCallableRequest({
      actor,
      data: { employeeId, email, roles: [] },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    userId: result.userId,
    linkType: "employee-linked",
    employeeId,
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const user = await getDoc(
      doc(firestore, "Companies", actor.companyId, "Users", result.userId),
    );
    assert.equal(user.data().displayName, employee.displayName);
    assert.equal(user.data().employeeId, employeeId);
    assert.deepEqual(user.data().roles, []);
    assert.equal(user.data().isTemporary, true);
    assert.equal(user.data().isAdmin, false);
    assert.equal(user.data().disabled, false);
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "UserEmailReservations",
            createUserEmailReservationId(email),
          ),
        )
      ).data(),
      { companyId: actor.companyId, userId: result.userId },
    );
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "Companies",
            actor.companyId,
            "EmployeeUserReservations",
            employeeId,
          ),
        )
      ).data(),
      { userId: result.userId },
    );
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "Companies",
            actor.companyId,
            "Employees",
            employeeId,
          ),
        )
      ).data(),
      employee,
    );
  });
});

test("concurrent cross-tenant creation commits one User for the same email", async () => {
  const { createStandaloneTemporaryUser } = await loadRebuildApis();
  const actors = [
    await seedTemporaryManagementActor({
      uid: "uwb04-email-race-primary",
    }),
    await seedTemporaryManagementActor({
      uid: "uwb04-email-race-secondary",
      companyId: CODEX_LOCAL_COMPANIES.secondary.id,
    }),
  ];
  const email = "uwb04-email-race@codex-test.invalid";
  const results = await Promise.allSettled(
    actors.map((actor) =>
      createStandaloneTemporaryUser.run(
        actorCallableRequest({
          actor,
          data: { email, displayName: "競合作成" },
        }),
      ),
    ),
  );
  const { fulfilled, rejected } = splitSettled(results);

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "already-exists");
  const winner = fulfilled[0].value;
  const winnerActor =
    actors[results.findIndex((result) => result.status === "fulfilled")];
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const usersByCompany = await Promise.all(
      actors.map((actor) =>
        getDocs(
          query(
            collection(firestore, "Companies", actor.companyId, "Users"),
            where("email", "==", email),
          ),
        ),
      ),
    );
    assert.equal(
      usersByCompany.reduce((count, users) => count + users.size, 0),
      1,
    );
    assert.equal(
      usersByCompany.find((users) => users.size === 1).docs[0].id,
      winner.userId,
    );
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "UserEmailReservations",
            createUserEmailReservationId(email),
          ),
        )
      ).data(),
      { companyId: winnerActor.companyId, userId: winner.userId },
    );
  });
});

test("concurrent Employee-linked creation commits one User and winner reservations", async () => {
  const { createEmployeeLinkedTemporaryUser } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb04-employee-race-manager",
  });
  const employeeId = "uwb04-race-employee";
  await seedEmployee({ employeeId, displayName: "競合社員" });
  const emails = [
    "uwb04-race-a@codex-test.invalid",
    "uwb04-race-b@codex-test.invalid",
  ];
  const { fulfilled, rejected } = splitSettled(
    await Promise.allSettled(
      emails.map((email) =>
        createEmployeeLinkedTemporaryUser.run(
          actorCallableRequest({
            actor,
            data: { employeeId, email },
          }),
        ),
      ),
    ),
  );

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "already-exists");
  const winner = fulfilled[0].value;
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const users = await getDocs(
      query(
        collection(firestore, "Companies", actor.companyId, "Users"),
        where("employeeId", "==", employeeId),
      ),
    );
    assert.equal(users.size, 1);
    assert.equal(users.docs[0].id, winner.userId);
    const winnerEmail = users.docs[0].data().email;
    assert.equal(emails.includes(winnerEmail), true);
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "Companies",
            actor.companyId,
            "EmployeeUserReservations",
            employeeId,
          ),
        )
      ).data(),
      { userId: winner.userId },
    );
    for (const email of emails) {
      const reservation = await getDoc(
        doc(
          firestore,
          "UserEmailReservations",
          createUserEmailReservationId(email),
        ),
      );
      assert.equal(reservation.exists(), email === winnerEmail);
      if (reservation.exists()) {
        assert.deepEqual(reservation.data(), {
          companyId: actor.companyId,
          userId: winner.userId,
        });
      }
    }
  });
});

test("Employee-linked deletion removes the User and both reservations", async () => {
  const { createEmployeeLinkedTemporaryUser, deleteTemporaryUser } =
    await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb04-delete-manager",
  });
  const employeeId = "uwb04-delete-employee";
  const employee = await seedEmployee({
    employeeId,
    displayName: "削除社員",
  });
  const email = "uwb04-delete@codex-test.invalid";
  const created = await createEmployeeLinkedTemporaryUser.run(
    actorCallableRequest({
      actor,
      data: { employeeId, email },
    }),
  );
  let actorUserBefore;
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    actorUserBefore = (
      await getDoc(
        doc(
          context.firestore(),
          "Companies",
          actor.companyId,
          "Users",
          actor.uid,
        ),
      )
    ).data();
  });
  const actorAuthBefore = await getAdminAuth().getUser(actor.uid);
  const actorAuthStateBefore = {
    email: actorAuthBefore.email,
    emailVerified: actorAuthBefore.emailVerified,
    disabled: actorAuthBefore.disabled,
    customClaims: actorAuthBefore.customClaims,
  };
  const deleted = await deleteTemporaryUser.run(
    actorCallableRequest({
      actor,
      data: { targetUserId: created.userId },
    }),
  );

  assert.deepEqual(deleted, {
    success: true,
    userId: created.userId,
    linkType: "employee-linked",
    employeeId,
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    assert.equal(
      (
        await getDoc(
          doc(firestore, "Companies", actor.companyId, "Users", created.userId),
        )
      ).exists(),
      false,
    );
    assert.equal(
      (
        await getDoc(
          doc(
            firestore,
            "Companies",
            actor.companyId,
            "EmployeeUserReservations",
            employeeId,
          ),
        )
      ).exists(),
      false,
    );
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "Companies",
            actor.companyId,
            "Employees",
            employeeId,
          ),
        )
      ).data(),
      employee,
    );
    assert.equal(
      (
        await getDoc(
          doc(
            firestore,
            "UserEmailReservations",
            createUserEmailReservationId(email),
          ),
        )
      ).exists(),
      false,
    );
    assert.deepEqual(
      (
        await getDoc(
          doc(firestore, "Companies", actor.companyId, "Users", actor.uid),
        )
      ).data(),
      actorUserBefore,
    );
  });
  const actorAuthAfter = await getAdminAuth().getUser(actor.uid);
  assert.deepEqual(
    {
      email: actorAuthAfter.email,
      emailVerified: actorAuthAfter.emailVerified,
      disabled: actorAuthAfter.disabled,
      customClaims: actorAuthAfter.customClaims,
    },
    actorAuthStateBefore,
  );
  await assert.rejects(
    () => getAdminAuth().getUserByEmail(email),
    (error) => error.code === "auth/user-not-found",
  );
});

test("Employee-linked signup converts the temporary User and both reservations", async () => {
  const {
    checkUserPreRegistration,
    createEmployeeLinkedTemporaryUser,
    setupUserAccount,
  } = await loadRebuildApis();
  const actor = await seedTemporaryManagementActor({
    uid: "uwb04-signup-manager",
  });
  const employeeId = "uwb04-signup-employee";
  const employee = await seedEmployee({
    employeeId,
    displayName: "登録社員",
  });
  const email = "uwb04-signup@codex-test.invalid";
  const temporary = await createEmployeeLinkedTemporaryUser.run(
    actorCallableRequest({
      actor,
      data: { employeeId, email, roles: ["human-resource"] },
    }),
  );
  assert.deepEqual(
    await checkUserPreRegistration.run({ data: { email } }),
    { isPreRegistered: true },
  );

  const authUid = "uwb04-signup-auth-user";
  await getAdminAuth().createUser({ uid: authUid, email, emailVerified: true });
  const setupRequest = {
    auth: {
      uid: authUid,
      token: { email, email_verified: true },
    },
    data: {},
  };
  const registered = await setupUserAccount.run(setupRequest);
  assert.deepEqual(registered, {
    success: true,
    companyId: actor.companyId,
    userId: authUid,
  });

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    assert.equal(
      (
        await getDoc(
          doc(
            firestore,
            "Companies",
            actor.companyId,
            "Users",
            temporary.userId,
          ),
        )
      ).exists(),
      false,
    );
    const user = await getDoc(
      doc(firestore, "Companies", actor.companyId, "Users", authUid),
    );
    assert.equal(user.data().email, email);
    assert.equal(user.data().isTemporary, false);
    assert.equal(user.data().isAdmin, false);
    assert.equal(user.data().disabled, false);
    assert.equal(user.data().employeeId, employeeId);
    assert.deepEqual(user.data().roles, ["human-resource"]);
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "UserEmailReservations",
            createUserEmailReservationId(email),
          ),
        )
      ).data(),
      { companyId: actor.companyId, userId: authUid },
    );
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "Companies",
            actor.companyId,
            "EmployeeUserReservations",
            employeeId,
          ),
        )
      ).data(),
      { userId: authUid },
    );
    assert.deepEqual(
      (
        await getDoc(
          doc(
            firestore,
            "Companies",
            actor.companyId,
            "Employees",
            employeeId,
          ),
        )
      ).data(),
      employee,
    );
  });
  assert.deepEqual((await getAdminAuth().getUser(authUid)).customClaims, {
    companyId: actor.companyId,
    isSuperUser: false,
  });
  assert.deepEqual(
    await checkUserPreRegistration.run({ data: { email } }),
    { isPreRegistered: false },
  );
  assert.deepEqual(await setupUserAccount.run(setupRequest), registered);
});

test("enabled state Callables reject incomplete and inactive actor identities", async () => {
  const { disableUser, enableUser } = await loadRebuildApis();
  const targetUid = "codex-enabled-state-rejected-target";

  await assertCallableError(
    disableUser.run(
      callableRequest({ data: {}, claims: { email: undefined } }),
    ),
    "permission-denied",
  );

  await assertCallableError(
    disableUser.run(
      callableRequest({
        data: { uid: targetUid },
        claims: { email: undefined },
      }),
    ),
    "permission-denied",
  );

  const disabledActorUid = "codex-enabled-state-disabled-actor";
  const disabledActorEmail = `${disabledActorUid}@codex-test.invalid`;
  await seedCallableAuthUser({
    uid: disabledActorUid,
    email: disabledActorEmail,
    disabled: true,
  });

  await assertCallableError(
    enableUser.run(
      callableRequest({
        uid: disabledActorUid,
        claims: { email: disabledActorEmail },
        data: { uid: targetUid },
      }),
    ),
    "permission-denied",
  );
});

test("enabled state Callables allow a consistent active company administrator", async () => {
  const { disableUser, enableUser } = await loadRebuildApis();
  const actorUid = "codex-enabled-state-admin";
  const actorEmail = `${actorUid}@codex-test.invalid`;
  const targetUid = "codex-enabled-state-target";

  await seedCallableAuthUser({ uid: actorUid, email: actorEmail });
  await seedRegisteredUser({
    uid: actorUid,
    email: actorEmail,
    isAdmin: true,
  });
  await seedCallableAuthUser({
    uid: targetUid,
    email: `${targetUid}@codex-test.invalid`,
    isSuperUser: false,
  });
  await seedRegisteredUser({
    uid: targetUid,
    email: `${targetUid}@codex-test.invalid`,
    isAdmin: false,
  });

  const request = callableRequest({
    uid: actorUid,
    claims: { email: actorEmail },
    data: { uid: targetUid },
  });

  await assertCallableError(
    disableUser.run({ ...request, data: {} }),
    "invalid-argument",
  );

  assert.deepEqual(await disableUser.run(request), {
    success: true,
    uid: targetUid,
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(
      doc(
        context.firestore(),
        "Companies",
        CODEX_LOCAL_COMPANIES.primary.id,
        "Users",
        targetUid,
      ),
    );
    assert.equal(snapshot.data().disabled, true);
  });

  assert.deepEqual(await enableUser.run(request), {
    success: true,
    uid: targetUid,
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(
      doc(
        context.firestore(),
        "Companies",
        CODEX_LOCAL_COMPANIES.primary.id,
        "Users",
        targetUid,
      ),
    );
    assert.equal(snapshot.data().disabled, false);
  });
});

test("admin transfer Callable rejects incomplete and inactive actor identities", async () => {
  const { changeAdminUser } = await loadRebuildApis();
  const targetUid = "codex-admin-transfer-rejected-target";

  await assertCallableError(
    changeAdminUser.run(
      callableRequest({
        claims: { email: undefined },
        data: {
          from: "codex-admin-transfer-rejected-actor",
          to: targetUid,
        },
      }),
    ),
    "permission-denied",
  );

  const companyId = "codex-admin-transfer-disabled-company";
  const actorUid = "codex-admin-transfer-disabled-actor";
  const actorEmail = `${actorUid}@codex-test.invalid`;
  await seedCallableAuthUser({
    uid: actorUid,
    companyId,
    email: actorEmail,
    disabled: true,
    isSuperUser: false,
  });

  await assertCallableError(
    changeAdminUser.run(
      callableRequest({
        uid: actorUid,
        claims: { email: actorEmail, companyId, isSuperUser: false },
        data: { from: actorUid, to: targetUid },
      }),
    ),
    "permission-denied",
  );
});

test("admin transfer Callable allows a consistent active company administrator", async () => {
  const { changeAdminUser } = await loadRebuildApis();
  const companyId = "codex-admin-transfer-company";
  const actorUid = "codex-admin-transfer-actor";
  const actorEmail = `${actorUid}@codex-test.invalid`;
  const targetUid = "codex-admin-transfer-target";
  const targetEmail = `${targetUid}@codex-test.invalid`;

  await seedCallableAuthUser({
    uid: actorUid,
    companyId,
    email: actorEmail,
    isSuperUser: false,
  });
  await seedRegisteredUser({
    uid: actorUid,
    pathCompanyId: companyId,
    companyId,
    email: actorEmail,
    isAdmin: true,
  });
  await seedCallableAuthUser({
    uid: targetUid,
    companyId,
    email: targetEmail,
    isSuperUser: false,
  });
  await seedRegisteredUser({
    uid: targetUid,
    pathCompanyId: companyId,
    companyId,
    email: targetEmail,
    isAdmin: false,
  });

  const result = await changeAdminUser.run(
    callableRequest({
      uid: actorUid,
      claims: { email: actorEmail, companyId, isSuperUser: false },
      data: { from: actorUid, to: targetUid },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    from: actorUid,
    to: targetUid,
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const actorSnapshot = await getDoc(
      doc(context.firestore(), "Companies", companyId, "Users", actorUid),
    );
    const targetSnapshot = await getDoc(
      doc(context.firestore(), "Companies", companyId, "Users", targetUid),
    );
    assert.equal(actorSnapshot.data().isAdmin, false);
    assert.equal(targetSnapshot.data().isAdmin, true);
    assert.deepEqual(targetSnapshot.data().roles, []);
  });
});

test("admin account creation Callable validates authentication and required input", async () => {
  const { createAdminAccount } = await loadRebuildApis();

  await assertCallableError(
    createAdminAccount.run({ data: {} }),
    "unauthenticated",
  );
  await assertCallableError(
    createAdminAccount.run(callableRequest({ data: {} })),
    "invalid-argument",
  );
});

test("admin account creation Callable rejects an unverified current Auth account", async () => {
  const { createAdminAccount } = await loadRebuildApis();
  const uid = "codex-create-admin-unverified";
  const email = `${uid}@codex-test.invalid`;
  await seedCallableAuthUser({
    uid,
    companyId: null,
    emailVerified: false,
    isSuperUser: false,
  });

  await assertCallableError(
    createAdminAccount.run(
      callableRequest({
        uid,
        claims: { companyId: undefined, email, isSuperUser: false },
        data: {
          companyName: "未確認会社",
          companyNameKana: "ミカクニンガイシャ",
          displayName: "管理者",
        },
      }),
    ),
    "failed-precondition",
  );
});

test("admin account creation Callable rejects disabled, mismatched, and already assigned Auth identities", async () => {
  const { createAdminAccount } = await loadRebuildApis();
  const cases = [
    {
      name: "disabled",
      auth: { companyId: null, disabled: true, isSuperUser: false },
      claims: { companyId: undefined, isSuperUser: false },
    },
    {
      name: "unverified-token",
      auth: { companyId: null, isSuperUser: false },
      claims: {
        companyId: undefined,
        email_verified: false,
        isSuperUser: false,
      },
    },
    {
      name: "email-mismatch",
      auth: {
        companyId: null,
        email: "canonical-admin@codex-test.invalid",
        isSuperUser: false,
      },
      claims: {
        companyId: undefined,
        email: "stale-admin@codex-test.invalid",
        isSuperUser: false,
      },
    },
    {
      name: "assigned-company",
      auth: { isSuperUser: false },
      claims: { isSuperUser: false },
    },
  ];

  for (const testCase of cases) {
    const uid = `codex-create-admin-${testCase.name}`;
    const email = testCase.auth.email ?? `${uid}@codex-test.invalid`;
    await seedCallableAuthUser({ uid, email, ...testCase.auth });

    await assertCallableError(
      createAdminAccount.run(
        callableRequest({
          uid,
          claims: { email, ...testCase.claims },
          data: {
            companyName: "拒否会社",
            companyNameKana: "キョヒガイシャ",
            displayName: "管理者",
          },
        }),
      ),
      "failed-precondition",
    );
  }
});

test("admin account creation Callable rejects an existing User email in any registration state", async () => {
  const { createAdminAccount } = await loadRebuildApis();

  for (const isTemporary of [false, true]) {
    const state = isTemporary ? "temporary" : "registered";
    const uid = `codex-admin-exists-${isTemporary ? "temp" : "reg"}`;
    const email = `${uid}@codex-test.invalid`;
    await seedCallableAuthUser({
      uid,
      companyId: null,
      email,
      isSuperUser: false,
    });
    await seedRegisteredUser({
      uid: `${uid}-user-document`,
      pathCompanyId: CODEX_LOCAL_COMPANIES.secondary.id,
      email,
      isTemporary,
    });
    await seedEmailReservation({
      email,
      companyId: CODEX_LOCAL_COMPANIES.secondary.id,
      userId: `${uid}-user-document`,
    });

    await assertCallableError(
      createAdminAccount.run(
        callableRequest({
          uid,
          claims: {
            companyId: undefined,
            email,
            isSuperUser: false,
          },
          data: {
            companyName: "既存User拒否会社",
            companyNameKana: "キソンユーザーキョヒガイシャ",
            displayName: "管理者",
          },
        }),
      ),
      "already-exists",
    );
  }
});

test("admin account creation Callable resumes claims for one matching initial administrator", async () => {
  const { createAdminAccount } = await loadRebuildApis();
  const uid = "codex-admin-resume";
  const email = `${uid}@codex-test.invalid`;
  const companyId = CODEX_LOCAL_COMPANIES.secondary.id;
  await seedCallableAuthUser({
    uid,
    companyId: null,
    email,
    isSuperUser: true,
  });
  await seedRegisteredUser({
    uid,
    pathCompanyId: companyId,
    email,
    isAdmin: true,
  });
  await seedEmailReservation({ email, companyId, userId: uid });

  const result = await createAdminAccount.run(
    callableRequest({
      uid,
      claims: {
        companyId: undefined,
        email,
        isSuperUser: true,
      },
      data: {
        companyName: "再開時未使用会社",
        companyNameKana: "サイカイジミシヨウガイシャ",
        displayName: "再開管理者",
      },
    }),
  );

  assert.deepEqual(result, { success: true, companyId, userId: uid });
  const authUser = await getAdminAuth().getUser(uid);
  assert.deepEqual(authUser.customClaims, {
    companyId,
    isSuperUser: true,
  });
});

test("admin account creation Callable is idempotent after matching claims exist", async () => {
  const { createAdminAccount } = await loadRebuildApis();
  const uid = "codex-admin-idempotent";
  const email = `${uid}@codex-test.invalid`;
  const companyId = CODEX_LOCAL_COMPANIES.secondary.id;
  await seedCallableAuthUser({
    uid,
    companyId,
    email,
    isSuperUser: false,
  });
  await seedRegisteredUser({
    uid,
    pathCompanyId: companyId,
    email,
    isAdmin: true,
  });
  await seedEmailReservation({ email, companyId, userId: uid });

  const result = await createAdminAccount.run(
    callableRequest({
      uid,
      claims: { companyId, email, isSuperUser: false },
      data: {
        companyName: "完了時未使用会社",
        companyNameKana: "カンリョウジミシヨウガイシャ",
        displayName: "完了管理者",
      },
    }),
  );

  assert.deepEqual(result, { success: true, companyId, userId: uid });
});

test("admin account creation Callable fails closed for inconsistent existing membership", async () => {
  const { createAdminAccount } = await loadRebuildApis();
  const cases = [
    {
      name: "wrong-uid",
      user: { uid: "another-admin", isAdmin: true },
      expectedCode: "already-exists",
    },
    {
      name: "temporary",
      user: { isAdmin: true, isTemporary: true },
    },
    {
      name: "regular-user",
      user: { isAdmin: false },
    },
    {
      name: "disabled",
      user: { isAdmin: true, disabled: true },
    },
    {
      name: "missing-company",
      pathCompanyId: "codex-missing-admin-company",
      user: { isAdmin: true },
    },
  ];

  for (const testCase of cases) {
    const uid = `codex-admin-bad-${testCase.name}`;
    const email = `${uid}@codex-test.invalid`;
    const pathCompanyId =
      testCase.pathCompanyId ?? CODEX_LOCAL_COMPANIES.secondary.id;
    await seedCallableAuthUser({
      uid,
      companyId: null,
      email,
      isSuperUser: false,
    });
    await seedRegisteredUser({
      uid: testCase.user.uid ?? uid,
      pathCompanyId,
      email,
      ...testCase.user,
    });
    await seedEmailReservation({
      email,
      companyId: pathCompanyId,
      userId: testCase.user.uid ?? uid,
    });

    await assertCallableError(
      createAdminAccount.run(
        callableRequest({
          uid,
          claims: {
            companyId: undefined,
            email,
            isSuperUser: false,
          },
          data: {
            companyName: "不整合拒否会社",
            companyNameKana: "フセイゴウキョヒガイシャ",
            displayName: "管理者",
          },
        }),
      ),
      testCase.expectedCode ?? "failed-precondition",
    );
  }
});

test("admin account creation Callable creates the Company, User, and custom claims", async () => {
  const { createAdminAccount } = await loadRebuildApis();
  const uid = "codex-create-admin-account";
  const email = `${uid}@codex-test.invalid`;
  await seedCallableAuthUser({
    uid,
    companyId: null,
    isSuperUser: false,
  });

  const result = await createAdminAccount.run(
    callableRequest({
      uid,
      claims: { companyId: undefined, email, isSuperUser: false },
      data: {
        companyName: "Codex新規会社",
        companyNameKana: "コーデックスシンキガイシャ",
        displayName: "管理者",
      },
    }),
  );

  assert.equal(result.success, true);
  assert.equal(result.userId, uid);
  assert.equal(typeof result.companyId, "string");
  assert.ok(result.companyId.length > 0);

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const company = await getDoc(
      doc(context.firestore(), "Companies", result.companyId),
    );
    const user = await getDoc(
      doc(
        context.firestore(),
        "Companies",
        result.companyId,
        "Users",
        uid,
      ),
    );
    assert.equal(company.exists(), true);
    assert.equal(company.data().companyName, "Codex新規会社");
    assert.equal(user.exists(), true);
    assert.equal(user.data().companyId, result.companyId);
    assert.equal(user.data().email, email);
    assert.equal(user.data().displayName, "管理者");
    assert.equal(user.data().isAdmin, true);
    assert.equal(user.data().isTemporary, false);
  });

  const authUser = await getAdminAuth().getUser(uid);
  assert.deepEqual(authUser.customClaims, {
    companyId: result.companyId,
    isSuperUser: false,
  });
});
