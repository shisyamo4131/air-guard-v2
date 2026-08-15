import assert from "node:assert/strict";
import test from "node:test";

import { shouldDeleteAuthUser } from "../../functions/triggers/user.js";

test("registered User deletion may continue to Authentication", () => {
  assert.equal(shouldDeleteAuthUser({ isTemporary: false }), true);
});

test("temporary User deletion never continues to Authentication", () => {
  assert.equal(shouldDeleteAuthUser({ isTemporary: true }), false);
});

test("missing or invalid registration state fails closed", () => {
  assert.equal(shouldDeleteAuthUser(), false);
  assert.equal(shouldDeleteAuthUser({}), false);
  assert.equal(shouldDeleteAuthUser({ isTemporary: "false" }), false);
});

test("deletion policy does not mutate User data", () => {
  const userData = { isTemporary: false, displayName: "Test User" };
  const before = structuredClone(userData);

  shouldDeleteAuthUser(userData);

  assert.deepEqual(userData, before);
});
