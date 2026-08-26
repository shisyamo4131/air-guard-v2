import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { deleteStandaloneRegisteredUser } from "../../functions/apis/deleteStandaloneRegisteredUser.js";
import { reinstateEmployee } from "../../functions/apis/reinstateEmployee.js";
import { getEmployeeReinstatementContext } from "../../functions/apis/getEmployeeReinstatementContext.js";
import { listLifecycleOperations } from "../../functions/apis/listLifecycleOperations.js";

const apiIndexSourceUrl = new URL(
  "../../functions/apis/index.js",
  import.meta.url,
);

async function loadHistoryCallableHarness(freshIdentityOrError) {
  const sourceUrl = new URL(
    "../../functions/apis/listLifecycleOperations.js",
    import.meta.url,
  );
  const source = (await readFile(sourceUrl, "utf8")).replace(
    /^import .*;\r?$/gm,
    "",
  );
  const initialIdentity = {
    uid: "actor-a",
    companyId: "company-a",
    isSuperUser: false,
    email: "actor@example.invalid",
  };
  let resolverCalls = 0;
  let useCaseCalls = 0;
  class HarnessHttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  globalThis.__historyApiHarness = {
    getAuth: () => ({ name: "auth" }),
    getFirestore: () => ({ name: "firestore" }),
    logger: { error() {} },
    HttpsError: HarnessHttpsError,
    onCall: (handler) => ({ run: handler }),
    listHistoryUseCase: async () => {
      useCaseCalls += 1;
      return { secretResponse: true };
    },
    LIFECYCLE_DOMAIN_ERROR_CODES: {
      AUTH_IDENTITY_INVALID: "AUTH_IDENTITY_INVALID",
    },
    mapLifecycleOperationError: () => ({
      code: "permission-denied",
      message: "履歴を取得できません。",
    }),
    resolveCallableAuthIdentity: async () => {
      resolverCalls += 1;
      if (resolverCalls === 1) return initialIdentity;
      if (freshIdentityOrError instanceof Error) throw freshIdentityOrError;
      return freshIdentityOrError;
    },
  };
  const prelude = `const {
    getAuth, getFirestore, logger, HttpsError, onCall,
    listHistoryUseCase, LIFECYCLE_DOMAIN_ERROR_CODES,
    mapLifecycleOperationError, resolveCallableAuthIdentity
  } = globalThis.__historyApiHarness;`;
  const encoded = Buffer.from(
    `${prelude}\n${source}\n// harness:${Math.random()}`,
    "utf8",
  ).toString("base64");
  const module = await import(`data:text/javascript;base64,${encoded}`);
  delete globalThis.__historyApiHarness;
  return {
    callable: module.listLifecycleOperations,
    counts: () => ({ resolverCalls, useCaseCalls }),
  };
}

test("UWB-07 lifecycle Callables reject missing authentication", async () => {
  for (const callable of [
    deleteStandaloneRegisteredUser,
    getEmployeeReinstatementContext,
    listLifecycleOperations,
    reinstateEmployee,
  ]) {
    await assert.rejects(callable.run({ data: {} }), (error) => {
      assert.equal(error.constructor.name, "HttpsError");
      assert.equal(error.code, "unauthenticated");
      assert.equal(error.message, "認証が必要です。");
      return true;
    });
  }
});

test("UWB-07 lifecycle Callables expose no dependency replacement surface", () => {
  for (const callable of [
    deleteStandaloneRegisteredUser,
    getEmployeeReinstatementContext,
    listLifecycleOperations,
    reinstateEmployee,
  ]) {
    assert.deepEqual(Object.keys(callable).sort(), [
      "__endpoint",
      "run",
      "stream",
    ]);
  }
});

test("UWB-07 lifecycle Callables derive identity and tenant on the server", async () => {
  for (const file of [
    "../../functions/apis/deleteStandaloneRegisteredUser.js",
    "../../functions/apis/getEmployeeReinstatementContext.js",
    "../../functions/apis/listLifecycleOperations.js",
    "../../functions/apis/reinstateEmployee.js",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /resolveCallableAuthIdentity\s*\(/);
    assert.match(
      source,
      /identity(?:\s*:\s*(actorIdentity|identity)|\s*,)/,
    );
    assert.match(source, /input:\s*request\.data/);
    assert.equal(source.includes("request.data?.companyId"), false);
    assert.equal(source.includes("request.data?.actorUid"), false);
    assert.equal(source.includes("request.data?.identity"), false);
  }
});

test("UWB-07 lifecycle Callables log no request payload or lifecycle reason", async () => {
  for (const file of [
    "../../functions/apis/deleteStandaloneRegisteredUser.js",
    "../../functions/apis/getEmployeeReinstatementContext.js",
    "../../functions/apis/listLifecycleOperations.js",
    "../../functions/apis/reinstateEmployee.js",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const loggerCall = source.slice(source.indexOf("logger.error("));
    for (const forbidden of [
      "request.data",
      "actorIdentity",
      "targetUserId",
      "employeeId",
      "reason",
      "email",
    ]) {
      assert.equal(loggerCall.includes(forbidden), false, `${file}: ${forbidden}`);
    }
  }
});

test("history Callable revalidates current Auth identity before returning", async () => {
  const source = await readFile(
    new URL("../../functions/apis/listLifecycleOperations.js", import.meta.url),
    "utf8",
  );
  const resolverCalls = source.match(
    /await resolveCallableAuthIdentity\s*\(/g,
  );
  assert.equal(resolverCalls?.length, 2);
  assert.match(source, /const auth = getAuth\(\);/);
  assert.match(
    source,
    /const response = await listHistoryUseCase\([\s\S]*const freshIdentity = await resolveCallableAuthIdentity\([\s\S]*assertVerifiedIdentityUnchanged\(identity, freshIdentity\);[\s\S]*return response;/,
  );
  assert.match(
    source,
    /tokenUid: request\.auth\.uid,[\s\S]*tokenCompanyId: actorToken\.companyId,[\s\S]*tokenIsSuperUser: actorToken\.isSuperUser,/,
  );
  assert.match(source, /Object\.keys\(initialIdentity\)\.sort\(\)/);
  assert.match(source, /Object\.keys\(freshIdentity\)\.sort\(\)/);
  assert.match(
    source,
    /!Object\.is\(initialIdentity\[field\], freshIdentity\[field\]\)/,
  );
  assert.match(
    source,
    /domainCode = LIFECYCLE_DOMAIN_ERROR_CODES\.AUTH_IDENTITY_INVALID/,
  );
});

test("history Callable withholds the response when current Auth is revoked or changed", async () => {
  const revokedAuthCases = [
    Object.assign(new Error("current Auth disabled"), {
      code: "current-auth-not-active",
    }),
    Object.assign(new Error("current Auth company changed"), {
      code: "current-auth-company-mismatch",
    }),
    Object.assign(new Error("current Auth became super-user"), {
      code: "current-auth-super-user",
    }),
    {
      uid: "actor-b",
      companyId: "company-a",
      isSuperUser: false,
      email: "actor@example.invalid",
    },
    {
      uid: "actor-a",
      companyId: "company-b",
      isSuperUser: false,
      email: "actor@example.invalid",
    },
    {
      uid: "actor-a",
      companyId: "company-a",
      isSuperUser: true,
      email: "actor@example.invalid",
    },
  ];

  for (const freshIdentityOrError of revokedAuthCases) {
    const harness = await loadHistoryCallableHarness(freshIdentityOrError);
    await assert.rejects(
      harness.callable.run({
        auth: {
          uid: "actor-a",
          token: {
            email: "actor@example.invalid",
            email_verified: true,
            companyId: "company-a",
            isSuperUser: false,
          },
        },
        data: { cursor: null },
      }),
      (error) =>
        error.code === "permission-denied" &&
        error.message === "履歴を取得できません。",
    );
    assert.deepEqual(harness.counts(), {
      resolverCalls: 2,
      useCaseCalls: 1,
    });
  }
});

test("API index exports lifecycle operations, history, and minimal correction context", async () => {
  const source = await readFile(apiIndexSourceUrl, "utf8");
  assert.match(
    source,
    /export \{ getEmployeeReinstatementContext \} from "\.\/getEmployeeReinstatementContext\.js";/,
  );
  assert.match(
    source,
    /export \{ deleteStandaloneRegisteredUser \} from "\.\/deleteStandaloneRegisteredUser\.js";/,
  );
  assert.match(
    source,
    /export \{ listLifecycleOperations \} from "\.\/listLifecycleOperations\.js";/,
  );
  assert.match(
    source,
    /export \{ reinstateEmployee \} from "\.\/reinstateEmployee\.js";/,
  );
  assert.match(
    source,
    /export \{ terminateEmployee \} from "\.\/terminateEmployee\.js";/,
  );
  for (const internal of [
    "deleteStandaloneRegisteredUserUseCase",
    "getContextUseCase",
    "listHistoryUseCase",
    "reinstateEmployeeUseCase",
    "terminateEmployeeUseCase",
    "mapLifecycleOperationError",
  ]) {
    assert.equal(source.includes(internal), false);
  }
});
