import assert from "node:assert/strict";
import test from "node:test";

import {
  ROLE_PERMISSION_ERROR_CODES,
  RolePermissionError,
  resolveRolePermissions,
} from "../../functions/modules/auth/rolePermissions.js";

test("manager and human-resource resolve the approved User permissions", () => {
  for (const role of ["manager", "human-resource"]) {
    const permissions = resolveRolePermissions([role]);

    assert.equal(permissions.includes("users:write"), true);
    assert.equal(permissions.includes("users:read"), true);
    assert.equal(permissions.includes("employees:write"), true);
    assert.equal(permissions.includes("employees:read"), true);
  }
});

test("other presets do not resolve User provisioning permission", () => {
  for (const role of ["controller", "accountant", "labor", "legal"]) {
    assert.equal(
      resolveRolePermissions([role]).includes("users:write"),
      false,
    );
  }
});

test("multiple presets are merged without duplicate permissions", () => {
  const permissions = resolveRolePermissions(["manager", "human-resource"]);

  assert.equal(permissions.length, new Set(permissions).size);
  assert.equal(permissions.includes("users:write"), true);
  assert.equal(permissions.includes("operation-results:write"), true);
  assert.equal(permissions.includes("operation-results:read"), true);
});

test("an empty role list resolves no permissions", () => {
  assert.deepEqual(resolveRolePermissions([]), []);
});

test("a non-array role value is rejected", () => {
  assert.throws(
    () => resolveRolePermissions("manager"),
    (error) => {
      assert.ok(error instanceof RolePermissionError);
      assert.equal(error.code, ROLE_PERMISSION_ERROR_CODES.ROLES_INVALID);
      return true;
    },
  );
});

test("unknown, empty, and non-string roles are rejected", () => {
  for (const role of ["users:write", "", " ", null, 1]) {
    assert.throws(
      () => resolveRolePermissions([role]),
      (error) => {
        assert.ok(error instanceof RolePermissionError);
        assert.equal(
          error.code,
          typeof role === "string" && role.trim()
            ? ROLE_PERMISSION_ERROR_CODES.UNKNOWN_ROLE
            : ROLE_PERMISSION_ERROR_CODES.ROLE_INVALID,
        );
        return true;
      },
    );
  }
});
