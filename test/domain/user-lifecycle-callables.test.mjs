import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { deleteStandaloneRegisteredUser } from "../../functions/apis/deleteStandaloneRegisteredUser.js";
import { reinstateEmployee } from "../../functions/apis/reinstateEmployee.js";
import { getEmployeeReinstatementContext } from "../../functions/apis/getEmployeeReinstatementContext.js";

const apiIndexSourceUrl = new URL(
  "../../functions/apis/index.js",
  import.meta.url,
);

test("UWB-07B and UWB-07C Callables reject missing authentication", async () => {
  for (const callable of [
    deleteStandaloneRegisteredUser,
    getEmployeeReinstatementContext,
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

test("UWB-07B and UWB-07C expose no dependency replacement surface", () => {
  for (const callable of [
    deleteStandaloneRegisteredUser,
    getEmployeeReinstatementContext,
    reinstateEmployee,
  ]) {
    assert.deepEqual(Object.keys(callable).sort(), [
      "__endpoint",
      "run",
      "stream",
    ]);
  }
});

test("UWB-07B and UWB-07C derive identity and tenant on the server", async () => {
  for (const file of [
    "../../functions/apis/deleteStandaloneRegisteredUser.js",
    "../../functions/apis/getEmployeeReinstatementContext.js",
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

test("UWB-07B and UWB-07C log no request payload or lifecycle reason", async () => {
  for (const file of [
    "../../functions/apis/deleteStandaloneRegisteredUser.js",
    "../../functions/apis/getEmployeeReinstatementContext.js",
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

test("API index exports three lifecycle operations and the minimal correction context", async () => {
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
    /export \{ reinstateEmployee \} from "\.\/reinstateEmployee\.js";/,
  );
  assert.match(
    source,
    /export \{ terminateEmployee \} from "\.\/terminateEmployee\.js";/,
  );
  for (const internal of [
    "deleteStandaloneRegisteredUserUseCase",
    "getContextUseCase",
    "reinstateEmployeeUseCase",
    "terminateEmployeeUseCase",
    "mapLifecycleOperationError",
  ]) {
    assert.equal(source.includes(internal), false);
  }
});
