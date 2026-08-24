import assert from "node:assert/strict";
import test from "node:test";

import { ROLE_PRESETS as CLIENT_ROLE_PRESETS } from "../../constants/rolePresets.js";
import { ROLE_PRESETS as SERVER_ROLE_PRESETS } from "../../functions/constants/rolePresets.js";

test("client and server role preset tables are identical", () => {
  assert.deepEqual(SERVER_ROLE_PRESETS, CLIENT_ROLE_PRESETS);
});

test("User provisioning permission is granted only by the approved presets", () => {
  const rolesWithProvision = Object.entries(SERVER_ROLE_PRESETS)
    .filter(([, preset]) => preset.permissions.includes("users:provision"))
    .map(([role]) => role)
    .sort();

  assert.deepEqual(rolesWithProvision, ["human-resource", "manager"]);

  const rolesWithUserWrite = Object.entries(SERVER_ROLE_PRESETS)
    .filter(([, preset]) => preset.permissions.includes("users:write"))
    .map(([role]) => role)
    .sort();
  assert.deepEqual(rolesWithUserWrite, ["manager"]);
});

test("Employee termination permission is granted only to human-resource", () => {
  const rolesWithTermination = Object.entries(SERVER_ROLE_PRESETS)
    .filter(([, preset]) =>
      preset.permissions.includes("employees:terminate"),
    )
    .map(([role]) => role)
    .sort();

  assert.deepEqual(rolesWithTermination, ["human-resource"]);
});
