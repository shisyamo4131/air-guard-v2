import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const usersUrl = new URL(
  "../../components/Users/Manager/index.vue",
  import.meta.url,
);
const employeeUrl = new URL(
  "../../components/Employee/UserManager.vue",
  import.meta.url,
);
const pageSettingsUrl = new URL("../../utils/pageSettings.js", import.meta.url);

test("UsersManager creates through the standalone feature operation", async () => {
  const source = await readFile(usersUrl, "utf8");
  assert.match(source, /useTemporaryUserCreation/);
  assert.match(
    source,
    /const \{ createStandaloneTemporaryUser, canCreate, canAssignRoles \} =\s*useTemporaryUserCreation\(\)/,
  );
  assert.match(
    source,
    /async function handleCreate\(item\)\s*\{\s*await createStandaloneTemporaryUser\(item\);\s*\}/,
  );
  assert.match(source, /:disabled="!canCreate\(\)"/);
  assert.match(source, /:show-create="props\.showCreate && canCreate\(\)"/);
  assert.match(source, /v-if="canAssignRoles\(\)"/);
  assert.equal(source.includes("checkEmailAvailabilityGlobal"), false);
  assert.equal(/item\.create\s*\(/.test(source), false);
});

test("Employee UserManager exposes preset roles only to role assigners", async () => {
  const source = await readFile(employeeUrl, "utf8");
  assert.match(source, /useTemporaryUserCreation/);
  assert.match(
    source,
    /createEmployeeLinkedTemporaryUser\(item, \{\s*employeeId: props\.employee\.docId,\s*\}\)/,
  );
  assert.match(source, /<template #\[`input\.roles`\]="inputProps">/);
  assert.match(source, /v-for="option in roleOptions"/);
  assert.match(source, /v-if="canAssignRoles\(\)"/);
  assert.match(
    source,
    /\.\.\.\(canAssignRoles\(\) \? \[\] : \["roles"\]\)/,
  );
  assert.match(source, /:excluded-keys="excludedKeys"/);
  assert.match(source, /roles: \[\]/);
  assert.match(
    source,
    /:action-text="canCreate\(\) \? 'ユーザーを登録する' : undefined"/,
  );
  assert.equal(source.includes("...props.employee"), false);
  assert.equal(source.includes("checkEmailAvailabilityGlobal"), false);
  assert.equal(/item\.create\s*\(/.test(source), false);
});

test("users:write grants the User settings route without opening Company settings", async () => {
  const source = await readFile(pageSettingsUrl, "utf8");
  const adminSettings = source.slice(
    source.indexOf('id: "admin-settings"'),
    source.indexOf("// 他のページやグループを追加"),
  );
  assert.match(adminSettings, /roles: \["admin", "users:write"\]/);
  assert.match(adminSettings, /strictPresetPermissions: \["users:write"\]/);
  const companySetting = adminSettings.slice(
    adminSettings.indexOf('id: "company-setting"'),
    adminSettings.indexOf('id: "users-setting"'),
  );
  assert.match(companySetting, /roles: \["admin"\]/);
  const usersSetting = adminSettings.slice(
    adminSettings.indexOf('id: "users-setting"'),
    adminSettings.indexOf('id: "checkout"'),
  );
  assert.match(usersSetting, /roles: \["users:write"\]/);
  assert.match(usersSetting, /strictPresetPermissions: \["users:write"\]/);
  assert.match(usersSetting, /allowAdmin: true/);
});

for (const [name, url] of [
  ["UsersManager", usersUrl],
  ["EmployeeUserManager", employeeUrl],
]) {
  test(`${name} compiles after temporary User creation migration`, async () => {
    const source = await readFile(url, "utf8");
    const { descriptor, errors } = parse(source, { filename: url.pathname });
    assert.deepEqual(errors, []);
    compileScript(descriptor, { id: name });
    const result = compileTemplate({
      id: name,
      filename: url.pathname,
      source: descriptor.template.content,
    });
    assert.deepEqual(result.errors, []);
  });
}
