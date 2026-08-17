import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { deleteTemporaryUser } from "../../functions/apis/deleteTemporaryUser.js";

const apiSourceUrl = new URL(
  "../../functions/apis/deleteTemporaryUser.js",
  import.meta.url,
);
const apiIndexSourceUrl = new URL(
  "../../functions/apis/index.js",
  import.meta.url,
);

test("unauthenticated temporary User deletion is rejected", async () => {
  await assert.rejects(
    deleteTemporaryUser.run({ data: { targetUserId: "temporary-a" } }),
    (error) => {
      assert.equal(error.constructor.name, "HttpsError");
      assert.equal(error.code, "unauthenticated");
      assert.equal(error.message, "認証が必要です。");
      return true;
    },
  );
});

test("Callable exposes no dependency or policy replacement API", () => {
  assert.deepEqual(Object.keys(deleteTemporaryUser).sort(), [
    "__endpoint",
    "run",
    "stream",
  ]);
});

test("Callable derives actor identity on the server and accepts only the target ID", async () => {
  const source = await readFile(apiSourceUrl, "utf8");

  assert.match(source, /resolveCallableAuthIdentity\s*\(/);
  assert.match(source, /targetUserId:\s*request\.data\?\.targetUserId/);
  assert.match(source, /companyId:\s*actorIdentity\.companyId/);
  assert.match(source, /actorUid:\s*actorIdentity\.uid/);
  assert.equal(source.includes("request.data?.companyId"), false);
  assert.equal(source.includes("request.data?.actorUid"), false);
  assert.equal(source.includes("auth: auth"), false);
});

test("API index exports the Callable without exporting internal helpers", async () => {
  const source = await readFile(apiIndexSourceUrl, "utf8");

  assert.match(
    source,
    /export \{ deleteTemporaryUser \} from "\.\/deleteTemporaryUser\.js";/,
  );
  assert.equal(source.includes("deleteTemporaryUserUseCase"), false);
  assert.equal(source.includes("mapDeleteTemporaryUserError"), false);
  assert.equal(source.includes("assertTemporaryUserCanBeDeleted"), false);
  assert.equal(source.includes("assertActorCanManageTemporaryUsers"), false);
});
