import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  CODEX_LOCAL_COMPANIES,
  CODEX_LOCAL_PROJECT_ID,
  CODEX_LOCAL_USERS,
} from "../test/fixtures/codex-local-seed.mjs";

function parseEmulatorHost(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set by Firebase Emulator Suite.`);

  const separator = value.lastIndexOf(":");
  if (separator <= 0) throw new Error(`${name} has an invalid host:port value.`);

  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  if (host !== "127.0.0.1" || !Number.isInteger(port)) {
    throw new Error(`${name} must point to a loopback host and numeric port.`);
  }
  return { host, port };
}

if (process.env.GCLOUD_PROJECT !== CODEX_LOCAL_PROJECT_ID) {
  throw new Error("The seed command must use the dedicated demo project.");
}
if (process.env.FUNCTIONS_EMULATOR) {
  throw new Error("Functions Emulator must not run while creating the base seed.");
}

const authHost = parseEmulatorHost("FIREBASE_AUTH_EMULATOR_HOST");
const firestoreHost = parseEmulatorHost("FIRESTORE_EMULATOR_HOST");
const app = initializeApp(
  {
    apiKey: "codex-local-only",
    projectId: CODEX_LOCAL_PROJECT_ID,
  },
  `codex-seed-${process.pid}`,
);
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${authHost.host}:${authHost.port}`, {
  disableWarnings: true,
});
const createdUsers = [];
let testEnvironment;

try {
  for (const fixture of CODEX_LOCAL_USERS) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      fixture.email,
      fixture.password,
    );
    await updateProfile(credential.user, { displayName: fixture.displayName });
    createdUsers.push({ ...fixture, uid: credential.user.uid });
  }

  testEnvironment = await initializeTestEnvironment({
    projectId: CODEX_LOCAL_PROJECT_ID,
    firestore: firestoreHost,
  });

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();

    await setDoc(doc(firestore, "System", "system"), {
      isMaintenance: false,
      fixture: "codex-local-seed-v1",
    });

    for (const company of Object.values(CODEX_LOCAL_COMPANIES)) {
      await setDoc(doc(firestore, "Companies", company.id), {
        companyName: company.name,
        companyNameKana: "コーデックスカクウケイビ",
        fixture: "codex-local-seed-v1",
      });
    }

    for (const user of createdUsers) {
      await setDoc(
        doc(firestore, "Companies", user.companyId, "Users", user.uid),
        {
          docId: user.uid,
          email: user.email,
          displayName: user.displayName,
          companyId: user.companyId,
          isAdmin: false,
          isTemporary: false,
          disabled: false,
          roles: [],
          fixture: "codex-local-seed-v1",
        },
      );
    }
  });

  process.stdout.write(
    `${JSON.stringify({
      projectId: CODEX_LOCAL_PROJECT_ID,
      companies: Object.keys(CODEX_LOCAL_COMPANIES).length,
      authUsers: createdUsers.length,
      syntheticOnly: true,
      purpose: "isolated-rules-callable-fixture",
    })}\n`,
  );
} finally {
  if (testEnvironment) await testEnvironment.cleanup();
  await deleteApp(app);
}
