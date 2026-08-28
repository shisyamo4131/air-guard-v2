import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "demo-air-guard-v2-codex";
const PRIMARY_COMPANY = "ccb-rules-primary";
const OTHER_COMPANY = "ccb-rules-other";
const ACTIVE_COMPANY = "ccb-rules-active";
const SCHEMA_ONLY_COMPANY = "ccb-rules-schema-only";
const STATE_ONLY_COMPANY = "ccb-rules-state-only";
const LEGACY_CREATED_AT = Timestamp.fromMillis(1_700_000_000_000);
const LEGACY_UPDATED_AT = Timestamp.fromMillis(1_700_000_100_000);

const ACTORS = [
  { name: "normal tenant User", uid: "ccb-rules-user", companyId: PRIMARY_COMPANY },
  {
    name: "company admin",
    uid: "ccb-rules-admin",
    companyId: PRIMARY_COMPANY,
    user: { isAdmin: true },
  },
  {
    name: "super-user",
    uid: "ccb-rules-super-user",
    companyId: PRIMARY_COMPANY,
    claims: { isSuperUser: true, superUser: true },
  },
  { name: "other tenant", uid: "ccb-rules-other", companyId: OTHER_COMPANY },
  { name: "unauthenticated" },
];

let testEnvironment;

function parseFirestoreHost() {
  const value = process.env.FIRESTORE_EMULATOR_HOST;
  assert.equal(value, "127.0.0.1:18080");
  return { host: "127.0.0.1", port: 18080 };
}

function actorFirestore(actor) {
  if (!actor.uid) return testEnvironment.unauthenticatedContext().firestore();
  return testEnvironment.authenticatedContext(actor.uid, {
    email_verified: true,
    companyId: actor.companyId,
    ...actor.claims,
  }).firestore();
}

async function seedRegisteredUser(firestore, actor) {
  if (!actor.uid) return;
  await setDoc(
    doc(firestore, "Companies", actor.companyId, "Users", actor.uid),
    {
      companyId: actor.companyId,
      isTemporary: false,
      disabled: false,
      ...actor.user,
    },
  );
}

async function seedFixture() {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, "Companies", PRIMARY_COMPANY), {
      companyName: "Legacy Primary",
      createdAt: LEGACY_CREATED_AT,
      updatedAt: LEGACY_UPDATED_AT,
      legacyValue: "before",
    });
    await setDoc(doc(firestore, "Companies", OTHER_COMPANY), {
      companyName: "Legacy Other",
      createdAt: LEGACY_CREATED_AT,
      updatedAt: LEGACY_UPDATED_AT,
    });
    await setDoc(doc(firestore, "Companies", "ccb-rules-no-created-at"), {
      companyName: "Legacy without createdAt",
      legacyValue: "before",
    });
    await setDoc(doc(firestore, "Companies", ACTIVE_COMPANY), {
      schemaVersion: 1,
      configurationState: "CCB_V1_ACTIVE",
      status: "ACTIVE",
      createdAt: LEGACY_CREATED_AT,
      createdBy: "ccb-rules-service",
      updatedAt: LEGACY_UPDATED_AT,
      updatedBy: "ccb-rules-service",
      legacyValue: "before",
    });
    await setDoc(doc(firestore, "Companies", SCHEMA_ONLY_COMPANY), {
      schemaVersion: 1,
      updatedAt: LEGACY_UPDATED_AT,
      legacyValue: "before",
    });
    await setDoc(doc(firestore, "Companies", STATE_ONLY_COMPANY), {
      configurationState: "CCB_V1_ACTIVE",
      updatedAt: LEGACY_UPDATED_AT,
      legacyValue: "before",
    });

    for (const actor of ACTORS) await seedRegisteredUser(firestore, actor);
    for (const companyId of [ACTIVE_COMPANY, SCHEMA_ONLY_COMPANY, STATE_ONLY_COMPANY]) {
      await setDoc(doc(firestore, "Companies", companyId, "Users", ACTORS[0].uid), {
        companyId,
        isTemporary: false,
        disabled: false,
      });
    }

    for (const collectionName of ["Settings", "PrivateSettings", "SettingAudits"]) {
      await setDoc(
        doc(firestore, "Companies", PRIMARY_COMPANY, collectionName, "existing"),
        { fixture: true },
      );
      await setDoc(
        doc(
          firestore,
          "Companies",
          PRIMARY_COMPANY,
          collectionName,
          "parent",
          "Nested",
          "child",
        ),
        { fixture: true },
      );
      await setDoc(
        doc(
          firestore,
          "Companies",
          PRIMARY_COMPANY,
          collectionName,
          "missing-parent",
          "Nested",
          "orphan",
        ),
        { fixture: true },
      );
    }

    await setDoc(
      doc(firestore, "Companies", PRIMARY_COMPANY, "CcbRulesRegression", "existing"),
      { revision: 1 },
    );
  });
}

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, PROJECT_ID);
  assert.equal(process.env.AIR_GUARD_EXTERNAL_EFFECTS, "deny");
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { ...parseFirestoreHost(), rules },
  });
});

beforeEach(seedFixture);

after(async () => {
  if (testEnvironment) await testEnvironment.cleanup();
});

test("all actors are denied every direct operation on CCB collections", async () => {
  for (const actor of ACTORS) {
    const firestore = actorFirestore(actor);
    for (const collectionName of ["Settings", "PrivateSettings", "SettingAudits"]) {
      const existing = doc(
        firestore,
        "Companies",
        PRIMARY_COMPANY,
        collectionName,
        "existing",
      );
      const created = doc(
        firestore,
        "Companies",
        PRIMARY_COMPANY,
        collectionName,
        `created-${actor.name.replaceAll(" ", "-")}`,
      );
      await assertFails(getDoc(existing));
      await assertFails(
        getDocs(collection(firestore, "Companies", PRIMARY_COMPANY, collectionName)),
      );
      await assertFails(getDocs(collectionGroup(firestore, collectionName)));
      await assertFails(setDoc(created, { fixture: false }));
      await assertFails(updateDoc(existing, { fixture: false }));
      await assertFails(deleteDoc(existing));
    }
  }
});

test("recursive CCB denial covers nested and orphan descendants", async () => {
  for (const actor of ACTORS) {
    const firestore = actorFirestore(actor);
    for (const collectionName of ["Settings", "PrivateSettings", "SettingAudits"]) {
      for (const parent of ["parent", "missing-parent"]) {
        const descendant = doc(
          firestore,
          "Companies",
          PRIMARY_COMPANY,
          collectionName,
          parent,
          "Nested",
          parent === "parent" ? "child" : "orphan",
        );
        const createdDescendant = doc(
          firestore,
          "Companies",
          PRIMARY_COMPANY,
          collectionName,
          parent,
          "Nested",
          `created-${actor.name.replaceAll(" ", "-")}`,
        );
        await assertFails(getDoc(descendant));
        await assertFails(
          getDocs(
            collection(
              firestore,
              "Companies",
              PRIMARY_COMPANY,
              collectionName,
              parent,
              "Nested",
            ),
          ),
        );
        await assertFails(setDoc(createdDescendant, { fixture: false }));
        await assertFails(updateDoc(descendant, { fixture: false }));
        await assertFails(deleteDoc(descendant));
      }
    }
  }
});

test("generic non-CCB fallback keeps same-tenant CRUD and tenant isolation", async () => {
  const sameTenant = actorFirestore(ACTORS[0]);
  const otherTenant = actorFirestore(ACTORS[3]);
  const existingSame = doc(
    sameTenant,
    "Companies",
    PRIMARY_COMPANY,
    "CcbRulesRegression",
    "existing",
  );
  const createdSame = doc(
    sameTenant,
    "Companies",
    PRIMARY_COMPANY,
    "CcbRulesRegression",
    "created",
  );
  const existingOther = doc(
    otherTenant,
    "Companies",
    PRIMARY_COMPANY,
    "CcbRulesRegression",
    "existing",
  );

  await assertSucceeds(getDoc(existingSame));
  await assertSucceeds(
    getDocs(collection(sameTenant, "Companies", PRIMARY_COMPANY, "CcbRulesRegression")),
  );
  await assertSucceeds(setDoc(createdSame, { revision: 1 }));
  await assertSucceeds(updateDoc(existingSame, { revision: 2 }));
  await assertSucceeds(deleteDoc(createdSame));

  await assertFails(getDoc(existingOther));
  await assertFails(
    getDocs(collection(otherTenant, "Companies", PRIMARY_COMPANY, "CcbRulesRegression")),
  );
  await assertFails(setDoc(existingOther, { revision: 3 }));
  await assertFails(deleteDoc(existingOther));
});

test("Company root rejects reserved additions, changes, and removals", async () => {
  const firestore = actorFirestore(ACTORS[0]);
  const root = doc(firestore, "Companies", PRIMARY_COMPANY);
  const additions = {
    status: "ACTIVE",
    schemaVersion: 1,
    configurationState: "CCB_V1_ACTIVE",
    createdBy: "ccb-rules-actor",
    updatedBy: "ccb-rules-actor",
  };

  for (const [field, value] of Object.entries(additions)) {
    await assertFails(updateDoc(root, { [field]: value }));
  }

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "Companies", PRIMARY_COMPANY), additions);
  });

  for (const [field, value] of Object.entries({
    status: "SUSPENDED",
    schemaVersion: 2,
    configurationState: "OTHER",
    createdBy: "changed",
    updatedBy: "changed",
  })) {
    await assertFails(updateDoc(root, { [field]: value }));
    await assertFails(updateDoc(root, { [field]: deleteField() }));
  }
});

test("Company root preserves existing createdAt while legacy updates remain compatible", async () => {
  const firestore = actorFirestore(ACTORS[0]);
  const root = doc(firestore, "Companies", PRIMARY_COMPANY);
  await assertFails(updateDoc(root, { createdAt: Timestamp.fromMillis(1_800_000_000_000) }));
  await assertFails(updateDoc(root, { createdAt: deleteField() }));

  await assertSucceeds(
    updateDoc(root, {
      updatedAt: Timestamp.fromMillis(1_700_000_200_000),
      legacyValue: "after",
    }),
  );
  await assertSucceeds(updateDoc(root, { updatedAt: deleteField() }));

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "Companies", "ccb-rules-no-created-at", "Users", ACTORS[0].uid),
      {
        companyId: "ccb-rules-no-created-at",
        isTemporary: false,
        disabled: false,
      },
    );
  });
  const noCreatedAt = testEnvironment.authenticatedContext(ACTORS[0].uid, {
    email_verified: true,
    companyId: "ccb-rules-no-created-at",
  }).firestore();
  await assertSucceeds(
    updateDoc(doc(noCreatedAt, "Companies", "ccb-rules-no-created-at"), {
      createdAt: LEGACY_CREATED_AT,
    }),
  );
});

test("activated CCB v1 root rejects every client update with reserved fields unchanged", async () => {
  const firestore = testEnvironment.authenticatedContext(ACTORS[0].uid, {
    email_verified: true,
    companyId: ACTIVE_COMPANY,
  }).firestore();
  const root = doc(firestore, "Companies", ACTIVE_COMPANY);

  await assertFails(updateDoc(root, { legacyValue: "after" }));
  await assertFails(
    updateDoc(root, { updatedAt: Timestamp.fromMillis(1_700_000_200_000) }),
  );
});

test("partial activation keys allow unrelated patches but reject legacy whole-document replacement", async () => {
  for (const companyId of [SCHEMA_ONLY_COMPANY, STATE_ONLY_COMPANY]) {
    const firestore = testEnvironment.authenticatedContext(ACTORS[0].uid, {
      email_verified: true,
      companyId,
    }).firestore();
    const root = doc(firestore, "Companies", companyId);
    await assertSucceeds(
      updateDoc(root, {
        legacyValue: "after",
        updatedAt: Timestamp.fromMillis(1_700_000_200_000),
      }),
    );
    await assertFails(
      setDoc(root, {
        companyName: "Legacy serialized body",
        legacyValue: "replacement",
        updatedAt: Timestamp.fromMillis(1_700_000_300_000),
      }),
    );
  }
});

test("Company root create and delete remain denied", async () => {
  const firestore = actorFirestore(ACTORS[0]);
  await assertFails(
    setDoc(doc(firestore, "Companies", "ccb-rules-created"), { companyName: "Denied" }),
  );
  await assertFails(deleteDoc(doc(firestore, "Companies", PRIMARY_COMPANY)));
});
