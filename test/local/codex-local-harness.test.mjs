import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
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

let testEnvironment;

async function seedRegisteredUser({
  uid,
  pathCompanyId = CODEX_LOCAL_COMPANIES.primary.id,
  companyId = pathCompanyId,
  isTemporary = false,
  disabled = false,
  omit = [],
}) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const data = { companyId, isTemporary, disabled };
    for (const field of omit) delete data[field];
    await setDoc(
      doc(context.firestore(), "Companies", pathCompanyId, "Users", uid),
      data,
    );
  });
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
  "Employees",
  "Employees_archive",
  "meta",
  "OperationResults",
  "Outsourcers",
  "Outsourcers_archive",
  "Sites",
  "Sites_archive",
  "SiteOperationSchedules",
  "Users",
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
