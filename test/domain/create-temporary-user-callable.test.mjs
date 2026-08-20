import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createEmployeeLinkedTemporaryUser,
  createStandaloneTemporaryUser,
} from "../../functions/apis/createTemporaryUser.js";

const apiSourceUrl = new URL(
  "../../functions/apis/createTemporaryUser.js",
  import.meta.url,
);
const apiIndexSourceUrl = new URL(
  "../../functions/apis/index.js",
  import.meta.url,
);

test("both temporary User creation Callables reject unauthenticated requests", async () => {
  for (const callable of [
    createStandaloneTemporaryUser,
    createEmployeeLinkedTemporaryUser,
  ]) {
    await assert.rejects(callable.run({ data: {} }), (error) => {
      assert.equal(error.constructor.name, "HttpsError");
      assert.equal(error.code, "unauthenticated");
      assert.equal(error.message, "認証が必要です。");
      return true;
    });
  }
});

test("Callables expose no dependency or policy replacement API", () => {
  for (const callable of [
    createStandaloneTemporaryUser,
    createEmployeeLinkedTemporaryUser,
  ]) {
    assert.deepEqual(Object.keys(callable).sort(), [
      "__endpoint",
      "run",
      "stream",
    ]);
  }
});

test("both operations share server-derived identity and pass only request data", async () => {
  const source = await readFile(apiSourceUrl, "utf8");

  assert.match(source, /resolveCallableAuthIdentity\s*\(/);
  assert.match(source, /companyId:\s*actorIdentity\.companyId/);
  assert.match(source, /actorUid:\s*actorIdentity\.uid/);
  assert.match(source, /input:\s*request\.data/);
  assert.equal(source.includes("request.data?.companyId"), false);
  assert.equal(source.includes("request.data?.actorUid"), false);
  assert.match(
    source,
    /export const createStandaloneTemporaryUser = onCall/,
  );
  assert.match(
    source,
    /export const createEmployeeLinkedTemporaryUser = onCall/,
  );
  assert.equal(source.includes("export { handleCreateRequest"), false);
  assert.equal(source.includes("export async function handleCreateRequest"), false);
});

test("failure logging records only fixed operation and error classifications", async () => {
  const source = await readFile(apiSourceUrl, "utf8");
  const loggingBlock = source.match(
    /logger\.error\("Temporary User creation failed", \{[\s\S]*?\}\);/,
  )?.[0];

  assert.ok(loggingBlock);
  for (const forbidden of [
    "request.data",
    "token.email",
    "companyId",
    "actorIdentity.uid",
    "employeeId",
    "normalizedEmail",
    "error.message",
    "error.stack",
    "error.cause",
  ]) {
    assert.equal(loggingBlock.includes(forbidden), false, forbidden);
  }
});

test("new Callables remain unreachable until the public index segment", async () => {
  const indexSource = await readFile(apiIndexSourceUrl, "utf8");
  assert.equal(indexSource.includes("createStandaloneTemporaryUser"), false);
  assert.equal(indexSource.includes("createEmployeeLinkedTemporaryUser"), false);
});
