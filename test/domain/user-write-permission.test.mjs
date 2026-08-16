import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ROLE_PRESETS } from "../../constants/rolePresets.js";

const USER_WRITE = "users:write";

test("manager and human-resource receive the User provisioning permission", () => {
  assert.equal(ROLE_PRESETS.manager.permissions.includes(USER_WRITE), true);
  assert.equal(
    ROLE_PRESETS["human-resource"].permissions.includes(USER_WRITE),
    true,
  );
});

test("other role presets do not receive the User provisioning permission", () => {
  for (const role of ["controller", "accountant", "labor", "legal"]) {
    assert.equal(
      ROLE_PRESETS[role].permissions.includes(USER_WRITE),
      false,
      `${role} must not receive ${USER_WRITE}`,
    );
  }
});

test("Employee write permission is not translated into User provisioning permission", async () => {
  const authorizationSource = await readFile(
    new URL("../../utils/auth/authorization.js", import.meta.url),
    "utf8",
  );

  assert.equal(authorizationSource.includes('"employees:write"'), false);
  assert.equal(authorizationSource.includes('"users:write"'), false);
  assert.match(authorizationSource, /permission\.replace\(\/:write\$\/, ":read"\)/);
});

test("existing manager and human-resource permissions remain available", () => {
  assert.equal(
    ROLE_PRESETS.manager.permissions.includes("operation-results:write"),
    true,
  );
  assert.equal(
    ROLE_PRESETS["human-resource"].permissions.includes("employees:write"),
    true,
  );
});
