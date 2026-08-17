import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { hasPresetPermission } from "../../utils/auth/authorization.js";

test("approved presets expose users:write", () => {
  assert.equal(hasPresetPermission(["manager"], "users:write"), true);
  assert.equal(
    hasPresetPermission(["human-resource"], "users:write"),
    true,
  );
});

test("preset write permissions imply the matching read permission", () => {
  assert.equal(hasPresetPermission(["manager"], "users:read"), true);
});

test("presets without users:write are denied", () => {
  for (const role of ["controller", "accountant", "labor", "legal"]) {
    assert.equal(hasPresetPermission([role], "users:write"), false);
  }
});

test("special roles and direct permission strings are not presets", () => {
  for (const role of ["admin", "super-user", "developer", "users:write"]) {
    assert.equal(hasPresetPermission([role], "users:write"), false);
  }
});

test("unknown or malformed role collections fail closed", () => {
  for (const roles of [
    ["manager", "unknown-role"],
    ["manager", ""],
    ["manager", null],
    "manager",
    null,
  ]) {
    assert.equal(hasPresetPermission(roles, "users:write"), false);
  }
});

test("invalid permission input is rejected", () => {
  for (const permission of [undefined, null, "", " users:write", 1]) {
    assert.equal(hasPresetPermission(["manager"], permission), false);
  }
});

test("useAuthStore exposes preset permission checks for the current User roles", async () => {
  const source = await readFile(
    new URL("../../stores/useAuthStore.js", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /hasPresetPermission as checkPresetPermission/,
  );
  assert.match(
    source,
    /function hasPresetPermission\(permission\)\s*\{\s*return checkPresetPermission\(userInstance\.roles, permission\);\s*\}/,
  );
  assert.match(source, /return \{[\s\S]*hasPresetPermission,[\s\S]*\};/);
});
