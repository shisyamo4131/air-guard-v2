import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, CODEX_LOCAL_PROJECT_ID);
  assert.equal(process.env.FUNCTIONS_EMULATOR, undefined);

  const firestoreHost = parseEmulatorHost("FIRESTORE_EMULATOR_HOST");
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
  testEnvironment = await initializeTestEnvironment({
    projectId: CODEX_LOCAL_PROJECT_ID,
    firestore: { ...firestoreHost, rules },
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

test("Firestore Rules allow the matching company claim and reject another tenant", async () => {
  const firestore = testEnvironment
    .authenticatedContext("codex-rules-user", {
      companyId: CODEX_LOCAL_COMPANIES.primary.id,
    })
    .firestore();

  await assertSucceeds(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.primary.id)),
  );
  await assertFails(
    getDoc(doc(firestore, "Companies", CODEX_LOCAL_COMPANIES.secondary.id)),
  );
});
