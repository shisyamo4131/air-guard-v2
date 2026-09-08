import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function createAuthActionsHarness(failureStage) {
  let source = await readFile(
    new URL(
      "../../composables/application/auth/useAuthActions.js",
      import.meta.url,
    ),
    "utf8",
  );
  source = source.replace(/^import[\s\S]*?;\r?\n/gm, "");
  source = source.replace("export function useAuthActions", "function useAuthActions");

  const calls = [];
  let currentFailureStage = failureStage;
  const makeModel = (kind) => ({
    docId: "old-user",
    companyId: "old-company",
    disabled: false,
    isTemporary: false,
    isAdmin: true,
    roles: ["manager"],
    unsubscribe() {
      calls.push(`${kind}:unsubscribe`);
    },
    initialize() {
      calls.push(`${kind}:initialize`);
      this.docId = null;
      this.companyId = null;
      this.disabled = false;
      this.isTemporary = false;
      this.isAdmin = false;
      this.roles = [];
    },
    async fetch({ docId }) {
      calls.push(`${kind}:fetch`);
      if (currentFailureStage === `${kind}-fetch`) {
        throw new Error(currentFailureStage);
      }
      this.docId = docId;
      this.companyId = "company-new";
      this.disabled = false;
      this.isTemporary = false;
      this.isAdmin = false;
      this.roles = ["manager"];
    },
    subscribe() {
      calls.push(`${kind}:subscribe`);
    },
  });
  const auth = {
    uid: "old-user",
    companyId: "old-company",
    isEmailVerified: true,
    isSuperUser: false,
    isSuperUserClaimValid: true,
    isDeveloper: false,
    isDeveloperClaimValid: true,
    sessionInitializationFailed: false,
    isReady: true,
    user: makeModel("user"),
  };
  const company = makeModel("company");
  let signOutCalls = 0;
  const loggerErrors = [];

  const bindings = {
    signInWithEmailAndPassword: async () => {},
    authSignOut: async () => {
      signOutCalls += 1;
    },
    useAuthStore: () => auth,
    useCompanyStore: () => ({ company }),
    useLogger: () => ({
      clearError() {},
      error(value) {
        loggerErrors.push(value);
      },
    }),
    useErrorsStore: () => ({}),
    FireModel: {
      setConfig(value) {
        calls.push(`prefix:${value.prefix}`);
      },
    },
    useNotification: () => ({
      async registFCMToken() {
        calls.push("notification:register");
      },
    }),
    useNuxtApp: () => ({ $auth: {} }),
  };
  const makeActions = new Function(
    ...Object.keys(bindings),
    `${source}; return useAuthActions;`,
  )(...Object.values(bindings));

  return {
    auth,
    calls,
    loggerErrors,
    actions: makeActions(),
    setFailureStage(value) {
      currentFailureStage = value;
    },
    signOutCalls: () => signOutCalls,
  };
}

test("auth session observes token refreshes and serializes store updates", async () => {
  const source = await readFile(
    new URL("../../plugins/02.firebase.auth.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /onIdTokenChanged/);
  assert.doesNotMatch(source, /onAuthStateChanged/);
  assert.match(source, /sessionUpdate\s*=\s*sessionUpdate\s*\.then/);
});

test("auth session accepts only exact boolean special claims", async () => {
  const [actions, store] = await Promise.all([
    readFile(
      new URL(
        "../../composables/application/auth/useAuthActions.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../../stores/useAuthStore.js", import.meta.url), "utf8"),
  ]);

  assert.match(actions, /auth\.isSuperUser\s*=\s*rawIsSuperUserClaim === true/);
  assert.match(actions, /rawIsDeveloperClaim === undefined/);
  assert.match(actions, /auth\.isDeveloper\s*=\s*rawIsDeveloperClaim === true/);
  assert.match(actions, /auth\.isDeveloperClaimValid\s*=\s*false/);
  assert.match(store, /const isDeveloperClaimValid = ref\(false\)/);
  assert.match(store, /isDeveloperClaimValid,/);
});

test("session initialization failures clear old access and a normal retry recovers", async () => {
  for (const failureStage of ["token", "user-fetch", "company-fetch"]) {
    const harness = await createAuthActionsHarness(failureStage);
    let failToken = failureStage === "token";
    const user = {
      uid: "user-new",
      emailVerified: true,
      async getIdTokenResult() {
        if (failToken) throw new Error(failureStage);
        return {
          claims: {
            companyId: "company-new",
            isSuperUser: false,
          },
        };
      },
    };

    await harness.actions.setUser(user);
    assert.equal(harness.auth.isReady, true);
    assert.equal(harness.auth.sessionInitializationFailed, true);
    assert.equal(harness.auth.uid, "user-new");
    assert.equal(harness.auth.companyId, null);
    assert.equal(harness.auth.user.docId, null);
    assert.equal(harness.signOutCalls(), 0);
    assert.equal(harness.loggerErrors.length, 1);

    harness.setFailureStage(null);
    failToken = false;
    await harness.actions.setUser(user);
    assert.equal(harness.auth.isReady, true);
    assert.equal(harness.auth.sessionInitializationFailed, false);
    assert.equal(harness.auth.uid, "user-new");
    assert.equal(harness.auth.companyId, "company-new");
    assert.equal(harness.auth.user.docId, "user-new");
    assert.equal(harness.auth.user.companyId, "company-new");
    assert.equal(harness.calls.includes("user:subscribe"), true);
    assert.equal(harness.calls.includes("company:subscribe"), true);

    await harness.actions.setUser(null);
    assert.equal(harness.auth.sessionInitializationFailed, false);
    assert.equal(harness.auth.uid, null);
  }
});
