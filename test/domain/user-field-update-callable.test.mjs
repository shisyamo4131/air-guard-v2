import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  updateOwnUserProfile,
  updateUserNotificationSettings,
  updateUserRoles,
} from "../../functions/apis/updateUserFields.js";

const apiSourceUrl = new URL(
  "../../functions/apis/updateUserFields.js",
  import.meta.url,
);
const apiIndexSourceUrl = new URL("../../functions/apis/index.js", import.meta.url);

test("all User field update Callables require authentication", async () => {
  for (const callable of [
    updateOwnUserProfile,
    updateUserNotificationSettings,
    updateUserRoles,
  ]) {
    await assert.rejects(callable.run({ data: {} }), (error) => {
      assert.equal(error.code, "unauthenticated");
      return true;
    });
  }
});

test("field update API derives identity and passes request data only", async () => {
  const source = await readFile(apiSourceUrl, "utf8");
  assert.match(source, /resolveCallableAuthIdentity\s*\(/);
  assert.match(source, /companyId:\s*actorIdentity\.companyId/);
  assert.match(source, /actorUid:\s*actorIdentity\.uid/);
  assert.match(source, /input:\s*request\.data/);
  assert.equal(source.includes("request.data?.companyId"), false);
  assert.equal(source.includes("request.data?.actorUid"), false);
  assert.equal(source.includes("export { handleUserFieldUpdateRequest"), false);
});

test("API index exports the three public Callables only", async () => {
  const source = await readFile(apiIndexSourceUrl, "utf8");
  for (const name of [
    "updateOwnUserProfile",
    "updateUserNotificationSettings",
    "updateUserRoles",
  ]) {
    assert.match(source, new RegExp(`\\b${name}\\b`));
  }
  assert.equal(source.includes("handleUserFieldUpdateRequest"), false);
});
