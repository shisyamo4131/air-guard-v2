import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { terminateEmployee } from "../../functions/apis/terminateEmployee.js";

const apiSourceUrl = new URL(
  "../../functions/apis/terminateEmployee.js",
  import.meta.url,
);
const apiIndexSourceUrl = new URL(
  "../../functions/apis/index.js",
  import.meta.url,
);

test("unauthenticated Employee retirement is rejected", async () => {
  await assert.rejects(
    terminateEmployee.run({ data: {} }),
    (error) => {
      assert.equal(error.constructor.name, "HttpsError");
      assert.equal(error.code, "unauthenticated");
      assert.equal(error.message, "認証が必要です。");
      return true;
    },
  );
});
test("Employee retirement Callable exposes no dependency replacement API", () => {
  assert.deepEqual(Object.keys(terminateEmployee).sort(), [
    "__endpoint",
    "run",
    "stream",
  ]);
});

test("Employee retirement Callable derives identity and company on the server", async () => {
  const source = await readFile(apiSourceUrl, "utf8");

  assert.match(source, /resolveCallableAuthIdentity\s*\(/);
  assert.match(source, /identity:\s*actorIdentity/);
  assert.match(source, /input:\s*request\.data/);
  assert.equal(source.includes("request.data?.companyId"), false);
  assert.equal(source.includes("request.data?.actorUid"), false);
  assert.equal(source.includes("request.data?.identity"), false);
  assert.equal(source.includes("request.data?.cleanupFcm"), false);
});

test("Employee retirement Callable logs no request payload or identity values", async () => {
  const source = await readFile(apiSourceUrl, "utf8");
  const loggerCall = source.slice(source.indexOf('logger.error("Employee retirement failed"'));

  assert.equal(loggerCall.includes("request.data"), false);
  assert.equal(loggerCall.includes("actorIdentity"), false);
  assert.equal(loggerCall.includes("employeeId"), false);
  assert.equal(loggerCall.includes("reasonOfTermination"), false);
  assert.equal(loggerCall.includes("email"), false);
});

test("API index exports only the Employee retirement Callable surface", async () => {
  const source = await readFile(apiIndexSourceUrl, "utf8");

  assert.match(
    source,
    /export \{ terminateEmployee \} from "\.\/terminateEmployee\.js";/,
  );
  assert.equal(source.includes("terminateEmployeeUseCase"), false);
  assert.equal(source.includes("mapLifecycleOperationError"), false);
  assert.equal(source.includes("cleanupUserFcmTokens"), false);
});
