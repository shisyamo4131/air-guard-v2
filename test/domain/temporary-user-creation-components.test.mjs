import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { PAGE_ACCESS_POLICIES } from "../../utils/auth/policies/pageAccessPolicy.js";
import { getPageConfig } from "../../utils/pageSettings.js";

const usersUrl = new URL(
  "../../components/Users/Manager/index.vue",
  import.meta.url,
);
const employeeUrl = new URL(
  "../../components/Employee/UserManager.vue",
  import.meta.url,
);

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

test("User and Company settings use distinct access policies", () => {
  const companySetting = getPageConfig("/settings/company");
  const usersSetting = getPageConfig("/settings/users");

  assert.equal(companySetting.accessPolicy, PAGE_ACCESS_POLICIES.ADMIN);
  assert.equal(
    usersSetting.accessPolicy,
    PAGE_ACCESS_POLICIES.USER_MANAGEMENT,
  );
  for (const config of [companySetting, usersSetting]) {
    assert.equal(Object.hasOwn(config, "roles"), false);
    assert.equal(Object.hasOwn(config, "strictPresetPermissions"), false);
    assert.equal(Object.hasOwn(config, "allowAdmin"), false);
  }
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
